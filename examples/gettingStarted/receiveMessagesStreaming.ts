/*
  This sample demonstrates how .receive() function can be used to receive Service Bus messages in a
  stream that is open for a fixed amount of time.
  Please run "sendMessages.ts" sample before running this to populate the queue/topic
*/

import { OnMessage, OnError, MessagingError, delay, ServiceBusMessage, Namespace } from "../../lib";

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

  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(`Received message: ${brokeredMessage.body} - ${brokeredMessage.label}`);

    await brokeredMessage.complete();
  };
  const onError: OnError = (err: MessagingError | Error) => {
    console.log("Error occurred: ", err);
  };

  const receiveListener = client.receive(onMessage, onError, { autoComplete: false });
  // Inducing delay to keep receiveListener open long enough to receive messages
  // Ideally the receiveListener will remain open as long as an application is running.
  await delay(5000);
  await receiveListener.stop();

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
