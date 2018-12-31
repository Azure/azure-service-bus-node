import {
  OnMessage,
  OnError,
  MessagingError,
  delay,
  MessageHandlerOptions,
  ServiceBusMessage,
  generateUuid,
  Namespace,
  ReceiveMode,
  SendableMessageInfo,
  SubscriptionClient,
  TopicClient
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

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

function randomstring(num: number): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < 7; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

async function sendMessages(topicClient: TopicClient): Promise<void> {
  for (let index = 0; index < 100; index++) {
    const element = randomstring(index);
    const message: SendableMessageInfo = {
      body: element,
      userProperties: { priority: Math.floor(Math.random() * 3) + 1 },
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

  const subscription1Client = ns.createSubscriptionClient(topic, subscription1, {
    receiveMode: ReceiveMode.peekLock
  });
  const subscription2Client = ns.createSubscriptionClient(topic, subscription2, {
    receiveMode: ReceiveMode.peekLock
  });
  const subscription3Client = ns.createSubscriptionClient(topic, subscription3, {
    receiveMode: ReceiveMode.peekLock
  });

  await sendMessages(client);
  // Setting up receive handlers

  await setupReceiveHandlers(subscription1Client, { maxConcurrentCalls: 10, autoComplete: true });
  await setupReceiveHandlers(subscription2Client, { maxConcurrentCalls: 5, autoComplete: true });
  await setupReceiveHandlers(subscription3Client, { maxConcurrentCalls: 1, autoComplete: true });

  await subscription1Client.close();
  await subscription2Client.close();
  await subscription3Client.close();

  await client.close();
  return ns.close();
}

async function setupReceiveHandlers(
  client: SubscriptionClient,
  options: MessageHandlerOptions
): Promise<void> {
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

  const rcvHandler = client.receive(onMessage, onError, options);
  await delay(10000);
  await rcvHandler.stop();
}

main()
  .then(() => {
    console.log("\n>>>> Sample Done!");
  })
  .catch((err) => {
    console.log("error: ", err);
    return ns.close();
  });
