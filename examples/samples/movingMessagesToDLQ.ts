import {
  delay,
  generateUuid,
  SendableMessageInfo,
  OnMessage,
  OnError,
  MessagingError,
  ServiceBusMessage,
  ReceiveMode,
  Namespace
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queuePath = process.env.QUEUE_NAME || "";
const deadLetterQueuePath = Namespace.getDeadLetterQueuePathForQueue(queuePath);
const receiveClientTimeoutInMilliseconds = 10000;
console.log("str: ", str);
console.log("queue path: ", queuePath);
console.log("deadletter queue path: ", deadLetterQueuePath);

let ns: Namespace;

/*
    This sample demonstrates scenarios as to how messages can be explicitly moved to the DLQ.
    For other implicit ways when messages get moved to DLQ, refer to -
    https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues

    CAUTION: Running this sample may cause all messages in main queue to be moved to DLQ.
    If main queue is empty, you should see 1 new "Creamy Chicken Past /Dinner recipe" message 
    in the DLQ.
    Then run the processMessagesInDLQ example to see how the messages in DLQ can be reprocessed.

*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);

  await sendMessage();

  await receiveMessage();

  console.log("\n>>>> Calling close....");
  await ns.close();
  console.log("\n>>>> sample Done!!!!");
}

async function sendMessage(): Promise<void> {
  const client = ns.createQueueClient(queuePath);
  const message: SendableMessageInfo = {
    body: { name: "Creamy Chicken Pasta", type: "Dinner" },
    contentType: "application/json",
    label: "Recipe",
    timeToLive: 2 * 60 * 1000, // 2 minutes
    messageId: generateUuid()
  };
  await client.send(message);
  await client.close();
}

async function receiveMessage(): Promise<void> {
  // Process messages from queue, by invoking .deadletter() on the brokered message
  const client = ns.createQueueClient(queuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Deadletter-ing the message", brokeredMessage);
    // TODO: Fix bug with .deadletter() in SDK for not setting these properties on the message.
    await brokeredMessage.deadLetter({
      deadletterReason: "Incorrect Recipe type",
      deadLetterErrorDescription: "Recipe type does not  match preferences."
    });
  };

  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

main().catch((err) => {
  console.log(">>>>> Error occurred: ", err);
  ns.close();
});
