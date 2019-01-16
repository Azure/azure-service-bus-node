/*
  This sample demonstrates how .scheduleMessage() function can be used to schedule messages to appear
  on a Service Bus entity at a specified later time.
*/

import { Namespace, SendableMessageInfo } from "../../lib";
import { delay } from "rhea-promise";

// Define connection string and related Service Bus entity names here
const connectionString = "";
const queueName = "";

let ns: Namespace;

const listOfScientists = [
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

// Scheduling messages to be sent after 30 seconds from now
async function sendScheduledMessages(): Promise<void> {
  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);

  const messages: SendableMessageInfo[] = listOfScientists.map((scientist) => ({
    body: `${scientist.firstName} ${scientist.name}`,
    label: "Scientist"
  }));

  const scheduledEnqueueTimeUtc = new Date(Date.now() + 30000);
  console.log(`>>>> Sending all messages, scheduled for UTC: ${scheduledEnqueueTimeUtc}`);
  await client.scheduleMessages(scheduledEnqueueTimeUtc, messages);
}

async function receiveMessages(): Promise<void> {
  // If using Topics, use createSubscriptionClient to receive from a topic subscription
  const client = ns.createQueueClient(queueName);

  const peekedMessages = await client.peek(10);
  console.log(`Looking up queue immediately, received ${peekedMessages.length} messages.`);

  await delay(30000);

  const receivedMessages = await client.receiveBatch(10);
  console.log(`Looking up queue after scheduled time, received ${peekedMessages.length} messages.`);
  for (let index = 0; index < receivedMessages.length; index++) {
    console.log(`Retrieved: ${receivedMessages[0].body} - ${receivedMessages[0].label}`);
  }

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
