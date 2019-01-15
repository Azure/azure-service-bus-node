import { OnMessage, OnError, MessagingError, delay, ServiceBusMessage, Namespace } from "../../lib";
import { config } from "dotenv";
config();

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";
const topicName = process.env.TOPIC_NAME || "";
const subscriptionName = process.env.SUBSCRIPTION_NAME || "";
const receiveClienTimeoutInMilliseconds = 5000;

console.log("Connection string value: ", connectionString);
console.log("Queue name: ", queueName);
console.log("Topic name: ", topicName);
console.log("Subscription name: ", subscriptionName);

let ns: Namespace;

/*
  This sample demonstrates how .receive() API can be used to receive Service Bus messages in a
  stream that is open for a fixed amount of time.
  Please run "sendMessages.ts" sample before running this to populate the queue/topic
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    await receiveMessages();
  } finally {
    await ns.close();
  }
}

async function receiveMessages(): Promise<void> {
  // If using Topics, use createSubscriptionClient to receive from a topic subscription
  const client = ns.createQueueClient(queueName);

  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(`Received message: ${brokeredMessage.body} - ${brokeredMessage.label}`);

    await brokeredMessage.complete();
  };
  const onError: OnError = (err: MessagingError | Error) => {
    console.log("Error occurred: ", err);
  };

  const receiveHandler = client.receive(onMessage, onError, { autoComplete: false });
  await delay(receiveClienTimeoutInMilliseconds);
  await receiveHandler.stop();

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
