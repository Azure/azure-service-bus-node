import {
  delay,
  OnMessage,
  OnError,
  MessagingError,
  ServiceBusMessage,
  ReceiveMode,
  Namespace,
  SendableMessageInfo,
  generateUuid
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queuePath = process.env.QUEUE_NAME || "";
const deadLetterQueuePath = queuePath + "/$DeadLetterQueue";
const receiveClientTimeoutInMilliseconds = 10000;
console.log("str: ", str);
console.log("queue path: ", queuePath);
console.log("deadletter queue path: ", deadLetterQueuePath);

let ns: Namespace;

/*
  This sample demonstrates how TimeToLive property works. For more information, refer to
  https://docs.microsoft.com/en-us/azure/service-bus-messaging/message-expiration

  On running this sample, you should immediately see a Pineapple Icecream message in the queue.
  After 30 seconds, you should see the message moved to DLQ with appropriate reason being set.
*/
async function main(): Promise<void> {
  try {
    ns = Namespace.createFromConnectionString(str);
    // Send messages with TTL property assigned
    await SendMessagesAsync();

    // Expire the messages
    await delay(60000);

    // Process expired messages from the Dead Letter Queue
    await PickUpAndFixDeadletters();
  } catch (err) {
    console.log(">>>>> Error occurred in running sampple: ", err);
  } finally {
    console.log("\n>>>> Calling close....");
    ns.close();
  }
}

// Task to send messages to given queue
async function SendMessagesAsync(): Promise<void> {
  const recipeData = { name: "Limited Pineapple Icecream", type: "Dessert" };
  const client = ns.createQueueClient(queuePath);
  const messageBody = recipeData;
  const message: SendableMessageInfo = {
    body: messageBody,
    contentType: "application/json",
    label: "Recipe",
    timeToLive: 30 * 1000, // 30 seconds
    messageId: generateUuid()
  };
  await client.send(message);
  await client.close();
}

// Task for processing the expired messages after they land in the Dead Letter Queue
async function PickUpAndFixDeadletters(): Promise<void> {
  const client = ns.createQueueClient(deadLetterQueuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Reprocessing the message in DLQ - ", brokeredMessage);
    await fixAndResendMessage(brokeredMessage);
    await brokeredMessage.complete();
  };

  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

async function fixAndResendMessage(oldMessage: ServiceBusMessage): Promise<void> {
  // Inspect given message and repair it
  const repairedMessage = oldMessage.clone();
  // TODO: Fix bug in SDK where the deadletter reason is not cleared when reposted to main queue
  // Fix message to live longer
  repairedMessage.timeToLive = 5 * 60 * 1000;

  // Send repaired message back to the current queue
  const client = ns.createQueueClient(queuePath);
  await client.send(repairedMessage);
  await client.close();
}

main()
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  })
  .catch((err) => {
    console.log("error: ", err);
  });
