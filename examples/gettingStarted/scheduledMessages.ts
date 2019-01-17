/*
  This sample demonstrates how .scheduleMessage() function can be used to schedule messages to appear
  on a Service Bus entity at a specified later time.
*/

import {
  Namespace,
  SendableMessageInfo,
  OnMessage,
  MessagingError,
  OnError,
  ServiceBusMessage
} from "../../lib";
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
    await sendScheduledMessages();

    await receiveMessages();
  } finally {
    await ns.close();
  }
}

// Scheduling messages to be sent after 10 seconds from now
async function sendScheduledMessages(): Promise<void> {
  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);

  const messages: SendableMessageInfo[] = listOfScientists.map((scientist) => ({
    body: `${scientist.firstName} ${scientist.name}`,
    label: "Scientist"
  }));

  const timeNowUtc = new Date(Date.now());
  const scheduledEnqueueTimeUtc = new Date(Date.now() + 10000);
  console.log(`>>>> Time now in UTC: ${timeNowUtc}`);
  console.log(`>>>> Messages will appear in Service Bus at UTC: ${scheduledEnqueueTimeUtc}`);

  await client.scheduleMessages(scheduledEnqueueTimeUtc, messages);
  for (let index = 0; index < messages.length; index++) {
    console.log(`Sent: ${messages[index].body} - ${messages[index].label}`);
  }
}

async function receiveMessages(): Promise<void> {
  // If using Topics, use createSubscriptionClient to receive from a topic subscription
  const client = ns.createQueueClient(queueName);

  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    numOfMessagesReceived++;
    console.log(`Received message: ${brokeredMessage.body} - ${brokeredMessage.label}`);

    await brokeredMessage.complete();
  };
  const onError: OnError = (err: MessagingError | Error) => {
    console.log("Error occurred: ", err);
  };

  let numOfMessagesReceived = 0;
  const receiveListenerFirst = client.receive(onMessage, onError);
  await delay(5000);
  await receiveListenerFirst.stop();
  console.log(
    `\nStarted looking up immediately while having receive listener wait for 5 seconds. Found ${numOfMessagesReceived} messages.\n`
  );

  await delay(5000);

  const receiveListenerSecond = client.receive(onMessage, onError);
  await delay(5000);
  await receiveListenerSecond.stop();
  console.log(
    `\nStarted looking up after 10 seconds while having receive listener wait, received ${numOfMessagesReceived} messages.`
  );

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
