/*
  This sample demonstrates how .peek() function can be used to browse a Service Bus message.
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
    await browseMessages();
  } finally {
    await ns.close();
  }
}

async function browseMessages(): Promise<void> {
  // If using Topics, use createSubscriptionClient to peek from a topic subscription
  const client = ns.createQueueClient(queueName);

  const messages = await client.peek(10);
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]) {
      console.log(`Peeking message: ${messages[i].body} - ${messages[i].label}`);
    }
  }

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
