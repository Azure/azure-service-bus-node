/*
  This sample demonstrates how .receiveBatch() function can be used to loop over a fixed number of
  Service Bus messages.
  Please run "sendMessages.ts" sample before running this to populate the queue/topic
*/

import { Namespace } from "../../lib";

// Define connection string and related Service Bus entity names here
const connectionString = "";
const queueName = "";

let ns: Namespace;

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

  for (let i = 0; i < 10; i++) {
    const messages = await client.receiveBatch(1);
    console.log(`Received message: ${messages[0].body} - ${messages[0].label}`);
    await messages[0].complete();
  }
  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
