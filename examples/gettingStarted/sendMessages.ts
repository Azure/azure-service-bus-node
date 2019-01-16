/*
  This sample demonstrates how .send() function can be used to send messages to Service Bus queue/topic.
*/

import { Namespace, SendableMessageInfo } from "../../lib";

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
    await sendMessages();
  } finally {
    await ns.close();
  }
}

async function sendMessages(): Promise<void> {
  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);

  for (let index = 0; index < listOfScientists.length; index++) {
    const scientist = listOfScientists[index];
    const message: SendableMessageInfo = {
      body: `${scientist.firstName} ${scientist.name}`,
      label: "Scientist"
    };

    console.log(`Sending message: ${message.body} - ${message.label}`);
    await client.send(message);
  }

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
