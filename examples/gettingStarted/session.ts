import {
  SendableMessageInfo,
  OnSessionMessage,
  OnError,
  MessagingError,
  delay,
  ServiceBusMessage,
  Namespace,
  MessageSession
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";
const topicName = process.env.TOPIC_NAME || "";
const subscriptionName = process.env.SUBSCRIPTION_NAME || "";
const receiveClienTimeoutInMilliseconds = 1000;

console.log("Connection string value: ", connectionString);
console.log("Queue name: ", queueName);
console.log("Topic name: ", topicName);
console.log("Subscription name: ", subscriptionName);

let ns: Namespace;

/*
  This sample demonstrates how Service Bus Messages can be sent to and received from individual
  sessions as created on session enabled queues/topic subscriptions.
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    await sendMessages("session-1");
    await sendMessages("session-2");
    await sendMessages("session-3");
    await sendMessages("session-4");

    await receiveMessages();
  } finally {
    await ns.close();
  }
}

async function sendMessages(sessionId: string): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to send to a queue
  // const client = ns.createTopicClient(topicName); // Use this API to send to a topic
  const data = [
    { step: 1, title: "Shop" },
    { step: 2, title: "Unpack" },
    { step: 3, title: "Prepare" },
    { step: 4, title: "Cook" },
    { step: 5, title: "Eat" }
  ];

  for (let index = 0; index < data.length; index++) {
    const element = data[index];
    const message: SendableMessageInfo = {
      sessionId: sessionId,
      body: `${element.step} ${element.title}`,
      label: "RecipeStep"
    };

    console.log(`Message sent: ${message.body} SessionId : ${sessionId}`);
    await client.send(message);
  }
  await client.close();
}

async function receiveMessages(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to receive from a queue
  // const client = ns.createSubscriptionClient(topicName, subscriptionName); // Use this API to receive from a topic subscription

  const onMessage: OnSessionMessage = async (
    messageSession: MessageSession,
    brokeredMessage: ServiceBusMessage
  ) => {
    console.log(
      `Message received: ${brokeredMessage.body} SessionId : ${brokeredMessage.sessionId}`
    );
  };
  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };
  await client.receiveMessagesFromSessions(onMessage, onError);
  await delay(receiveClienTimeoutInMilliseconds);

  await client.close();
}

main();
