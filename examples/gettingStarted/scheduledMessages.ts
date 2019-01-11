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
  This sample demonstrates how .scheduleMessage() API can be used to schedule messages to appear
  on a Service Bus entity at a specified later time.
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    // schedule messages to appear on queue/topic at a later time.
    await sendScheduledMessages();

    // retrieve all the messages that were sent to the queue
    await receiveMessages();
  } finally {
    await ns.close();
  }
}

async function sendScheduledMessages(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to send to a queue
  // const client = ns.createTopicClient(topicName); // Use this API to send to a topic

  const data = [
    { name: "Einstein", firstName: "Albert" },
    { name: "Heisenberg", firstName: "Werner" },
    { name: "Curie", firstName: "Marie" },
    { name: "Hawking", firstName: "Steven" },
    { name: "Newton", firstName: "Isaac" },
    { name: "Bohr", firstName: "Niels" },
    { name: "Faraday", firstName: "Michael" },
    { name: "Galilei", firstName: "Galileo" },
    { name: "Kepler", firstName: "Johannes" },
    { name: "Kopernikus", firstName: "Nikolaus" }
  ];

  for (let index = 0; index < NUM_OF_MESSAGES; index++) {
    const element = data[index];
    const message = {
      body: `${element.firstName} ${element.name}`,
      label: "Scientist"
    };
    const scheduledEnqueueTimeUtc = new Date(Date.now() + 30000 + index * 1000); // scheduling message to be sent (30 + index) seconds from now
    console.log(
      `>>>> Sending message:\t ${message.body}, scheduled for UTC: ${scheduledEnqueueTimeUtc}`
    );
    await client.scheduleMessage(message, scheduledEnqueueTimeUtc);
  }
}

async function receiveMessages(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to receive from a queue
  // const client = ns.createSubscriptionClient(topicName, subscriptionName); // Use this API to receive from a topic subscription

  for (let index = 0; index < NUM_OF_MESSAGES; index++) {
    // retrieve one message at a time.
    const msg = await client.receiveBatch(1, 30 + index); // (30 + index) is the maximum wait time in seconds for which the Receiver will wait to receive the message.

    console.log(`Retrieved: ${msg[0].body} - ${msg[0].label}`);
  }

  await client.close();
}

main();
