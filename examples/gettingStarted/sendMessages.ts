/*
  This sample demonstrates how the send() function can be used to send messages to Service Bus
  Queue/Topic.

  See https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
  to learn about Queues, Topics and Subscriptions.
*/

import { Namespace, SendableMessageInfo } from "../../lib";

// Define connection string and related Service Bus entity names here
const connectionString = "";
const queueName = "";

const listOfScientists = [
  { lastName: "Einstein", firstName: "Albert" },
  { lastName: "Heisenberg", firstName: "Werner" },
  { lastName: "Curie", firstName: "Marie" },
  { lastName: "Hawking", firstName: "Steven" },
  { lastName: "Newton", firstName: "Isaac" },
  { lastName: "Bohr", firstName: "Niels" },
  { lastName: "Faraday", firstName: "Michael" },
  { lastName: "Galilei", firstName: "Galileo" },
  { lastName: "Kepler", firstName: "Johannes" },
  { lastName: "Kopernikus", firstName: "Nikolaus" }
];

async function main(): Promise<void> {
  const ns = Namespace.createFromConnectionString(connectionString);

  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);

  try {
    for (let index = 0; index < listOfScientists.length; index++) {
      const scientist = listOfScientists[index];
      const message: SendableMessageInfo = {
        body: `${scientist.firstName} ${scientist.lastName}`,
        label: "Scientist"
      };

      console.log(`Sending message: ${message.body} - ${message.label}`);
      await client.send(message);
    }

    await client.close();
  } finally {
    await ns.close();
  }
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
