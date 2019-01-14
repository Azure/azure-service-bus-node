import { Namespace } from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";
const topicName = process.env.TOPIC_NAME || "";
const subscriptionName = process.env.SUBSCRIPTION_NAME || "";

console.log("Connection string value: ", connectionString);
console.log("Queue name: ", queueName);
console.log("Topic name: ", topicName);
console.log("Subscription name: ", subscriptionName);

let ns: Namespace;

/*
  This sample demonstrates how .peek() API can be used to browse a Service Bus message.
  Please run "sendMessages.ts" sample before running this to populate the queue/topic
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    await browseMessages();
  } finally {
    await ns.close();
  }
}

async function browseMessages(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to peek from a queue
  // const client = ns.createSubscriptionClient(topicName, subscriptionName); // Use this API to peek from a topic subscription

  const messages = await client.peek(10); // Peeks one message
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]) {
      console.log(`Peeking message: ${messages[i].body} - ${messages[i].label}`);
    }
  }

  await client.close();
}

main();
