import {
  delay,
  OnMessage,
  OnError,
  MessagingError,
  ServiceBusMessage,
  ReceiveMode,
  Namespace,
  QueueClient
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
  This sample demonstrates how messages from DLQ can be retrieved, inspected and reprocessed if
  required, by sending to the same or a different queue.

  Run movingMessagesToDLQ sample before this to see three Non-Vegetarian recipe messages in the DLQ.
  On running this sample, you should see 3 instances of a vegetarian recipe in the main queue.
*/
async function main(): Promise<void> {
  try {
    ns = Namespace.createFromConnectionString(str);
    // Process messages from the Dead Letter Queue, by invoking .deadletter() on the brokered message
    await processMessageQueue(deadLetterMessageProcessor, deadLetterQueuePath);
  } catch (err) {
    console.log(">>>>> Error occurred in running sampple: ", err);
  } finally {
    console.log("\n>>>> Calling close....");
    ns.close();
  }
}

async function processMessageQueue(messageProcessor: Function, path: string): Promise<void> {
  const client = ns.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });
  await messageProcessor(client);
}

// This function takes in the message to inspect and reprocess it as needed.
async function fixAndResendMessage(oldMessage: ServiceBusMessage): Promise<void> {
  // Inspect given message and repair it
  const repairedMessage = oldMessage.clone();
  repairedMessage.body = { name: "Grilled Tomatoes", type: "Vegetarian" };

  // Send repaired message back to the current queue
  const client = ns.createQueueClient(queuePath);
  await client.send(repairedMessage);
  await client.close();
}

// OnMessage handlers for processing the Dead Letter Messages
async function deadLetterMessageProcessor(client: QueueClient): Promise<void> {
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

main()
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  })
  .catch((err) => {
    console.log("error: ", err);
  });
