import {
  OnMessage,
  OnError,
  MessagingError,
  delay,
  ServiceBusMessage,
  generateUuid,
  Namespace,
  SendableMessageInfo,
  SubscriptionClient,
  TopicClient
} from "../../lib";
import * as dotenv from "dotenv";
import { CorrelationFilter } from "../../lib/core/managementClient";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const topic = process.env.TOPIC_NAME || "";
const subscription1 = process.env.SUBSCRIPTION_NAME1 || "";
const subscription2 = process.env.SUBSCRIPTION_NAME2 || "";
const subscription3 = process.env.SUBSCRIPTION_NAME3 || "";

console.log(`str: ${str}`);
console.log(`path: ${topic}`);
console.log(`Subscription 1: ${subscription1}`);
console.log(`Subscription 2: ${subscription2}`);
console.log(`Subscription 3: ${subscription3}\n`);

let ns: Namespace;

async function sendMessages(topicClient: TopicClient): Promise<void> {
  for (let index = 0; index < 100; index++) {
    const element = `Message#${index}`;
    const message: SendableMessageInfo = {
      body: element,
      userProperties: { priority: Math.ceil(Math.random() * 3) },
      label: "Random String",
      timeToLive: 2 * 60 * 1000, // 2 minutes
      messageId: generateUuid()
    };

    console.log(` Sending message ${index} - ${message.body}`);
    await topicClient.send(message);
  }
}

async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  const client = ns.createTopicClient(topic);

  const subscription1Client = ns.createSubscriptionClient(topic, subscription1);
  await removeAllRules(subscription1Client);
  await addRules(subscription1Client, "Priority_1", "priority = 1");

  const subscription2Client = ns.createSubscriptionClient(topic, subscription2);
  await removeAllRules(subscription2Client);
  await addRules(subscription2Client, "Priority_2", "priority = 2");

  const subscription3Client = ns.createSubscriptionClient(topic, subscription3);
  await removeAllRules(subscription3Client);
  await addRules(subscription3Client, "Priority_3", "priority = 3");

  await sendMessages(client);
  // Setting up receive handlers

  await setupReceiveHandlers(subscription1Client);
  await setupReceiveHandlers(subscription2Client);
  await setupReceiveHandlers(subscription3Client);

  await subscription1Client.close();
  await subscription2Client.close();
  await subscription3Client.close();

  await client.close();
  return ns.close();
}

async function setupReceiveHandlers(client: SubscriptionClient): Promise<void> {
  // retrieve messages from the queue
  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(
      `### Received message- Subscription: ${client.name}, Priority: ${
        brokeredMessage.userProperties ? brokeredMessage.userProperties["priority"] : undefined
      }`
    );
  };

  const onError: OnError = (err: MessagingError | Error) => {
    console.log("\n>>>>> Error occurred: ", err);
  };

  const rcvHandler = client.receive(onMessage, onError);
  await delay(10000);
  await rcvHandler.stop();
}

async function removeAllRules(client: SubscriptionClient): Promise<boolean> {
  let rules = await client.getRules();
  console.log(`${rules.length} rules found for ${client.name}`);

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    console.log(`Rule Name: ${rule.name}`);
    console.log(`Filter: ${JSON.stringify(rule.filter)}`);
    if (rule.action) {
      console.log(`Action: ${JSON.stringify(rule.action)}`);
    }
    await client.removeRule(rule.name);
  }

  rules = await client.getRules();
  if (rules.length) {
    console.log(`Failed to remove all rules from ${client.name}`);
    return false;
  } else {
    console.log(`All rules removed from ${client.name}`);
  }

  return true;
}

async function addRules(
  client: SubscriptionClient,
  ruleName: string,
  filter: boolean | string | CorrelationFilter,
  sqlRuleActionExpression?: string
): Promise<void> {
  await client.addRule(ruleName, filter, sqlRuleActionExpression);
  const rules = await client.getRules();
  if (rules.find((rule) => rule.name === ruleName)) {
    console.log(`Rule ${ruleName} has been added \n`);
  } else {
    console.log(`Nooooo.... Where is the ${ruleName} rule??`);
    return;
  }
}

main()
  .then(() => {
    console.log("\n>>>> Sample Done!");
  })
  .catch((err) => {
    console.log("error: ", err);
    return ns.close();
  });
