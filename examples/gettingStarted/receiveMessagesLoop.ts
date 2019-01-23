/*
  This sample demonstrates how the receiveBatch() function can be used to receive Service Bus
  messages in a loop.

  Setup: Please run "sendMessages.ts" sample before running this to populate the queue/topic
*/

import { Namespace } from "../../lib";
import Long from "long";

// Define connection string and related Service Bus entity names here
const connectionString =
  "Endpoint=sb://premiumfruitsservicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=CYbvyj0TXdGMRMOHbYPMvfwOXJ4lD3jdR28rQnMlCC0=";
const queueName = "fruitsqueue";

async function main(): Promise<void> {
  const ns = Namespace.createFromConnectionString(connectionString);

  // If using Topics, use createSubscriptionClient to receive from a topic subscription
  const client = ns.createQueueClient(queueName);

  try {
    for (let i = 0; i < 1; i++) {
      const messages = await client.receiveDeferredMessage(Long.fromNumber(768));
      if (messages) {
        console.log(`Received message #${i}: ${messages.body}`);
        await messages.complete();
      }
    }
    await client.close();
  } finally {
    await ns.close();
  }
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
