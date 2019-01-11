import { Namespace } from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";
const topicName = process.env.TOPIC_NAME || "";
const subscriptionName = process.env.SUBSCRIPTION_NAME || "";
const NUM_OF_MESSAGES = 10;

console.log("Connection string value: ", connectionString);
console.log("Queue name: ", queueName);
console.log("Topic name: ", topicName);
console.log("Subscription name: ", subscriptionName);

let ns: Namespace;

/*
  This sample demonstrates how .receiveBatch() API can be used to receive fixed number of
  Service Bus messages.
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
  const client = ns.createQueueClient(queueName); // Use this API to receive from a queue
  // const client = ns.createSubscriptionClient(topicName, subscriptionName); // Use this API to receive from a topic subscription

  for (let i = 0; i < NUM_OF_MESSAGES; i++) {
    const messages = await client.receiveBatch(1); // retrieve one message at a time.
    await messages[0].complete();
    console.log(`Received message: ${messages[0].body} - ${messages[0].label}`);
  }
  await client.close();
}

main();
