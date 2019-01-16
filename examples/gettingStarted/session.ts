/*
  This sample demonstrates how Service Bus Messages can be sent to and received from individual
  sessions as created on session enabled queues/topic subscriptions.
*/

import {
  SendableMessageInfo,
  OnSessionMessage,
  OnError,
  MessagingError,
  delay,
  ServiceBusMessage,
  Namespace,
  MessageSession
} from "../../lib";

const connectionString = "Enter connection string value here";
const queueName = "Enter queue name here";
// Ensure on portal.azure.com that queue has Sessions feature enabled

let ns: Namespace;

async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    await sendMessages("session-1");
    await sendMessages("session-2");
    await sendMessages("session-3");
    await sendMessages("session-4");

    await receiveMessages();
  } finally {
    await ns.close();
  }
}

async function sendMessages(sessionId: string): Promise<void> {
  // If using Topics, use createTopicClient to send to a topic
  const client = ns.createQueueClient(queueName);
  const data = [
    { step: 1, title: "Shop" },
    { step: 2, title: "Unpack" },
    { step: 3, title: "Prepare" },
    { step: 4, title: "Cook" },
    { step: 5, title: "Eat" }
  ];

  for (let index = 0; index < data.length; index++) {
    const element = data[index];
    const message: SendableMessageInfo = {
      sessionId: sessionId,
      body: `${element.step} ${element.title}`,
      label: "RecipeStep"
    };

    console.log(`Message sent: ${message.body} SessionId : ${sessionId}`);
    await client.send(message);
  }
  await client.close();
}

async function receiveMessages(): Promise<void> {
  // If using Topics, use createSubscriptionClient to receive from a topic subscription
  const client = ns.createQueueClient(queueName);

  const onMessage: OnSessionMessage = async (
    messageSession: MessageSession,
    brokeredMessage: ServiceBusMessage
  ) => {
    console.log(
      `Message received: ${brokeredMessage.body} SessionId : ${brokeredMessage.sessionId}`
    );
  };
  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };
  await client.receiveMessagesFromSessions(onMessage, onError);
  await delay(10000);

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
