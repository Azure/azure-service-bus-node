import {
  delay,
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
  This sample demonstrates how messages from DLQ can be retrieved and processed.

  Run movingMessagesToDLQ sample before this to populate messages in the DLQ.
  On running this sample, you should see the existing messages in DLQ be moved back to main queue.
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  // Process messages from the Dead Letter Queue
  await processDeadletterMessageQueue();

  console.log("\n >>>> Calling close....");
  ns.close();
}

async function processDeadletterMessageQueue(): Promise<void> {
  const client = ns.createQueueClient(deadLetterQueuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Reprocessing the message in DLQ - ", brokeredMessage);

    // Do something with the message retrieved from DLQ
    await fixAndResendMessage(brokeredMessage);

    // Mark message as complete/processed.
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
  // Inspect given message and make any changes if necessary
  const repairedMessage = oldMessage.clone();

  // Send repaired message back to the current queue
  const client = ns.createQueueClient(queuePath);
  await client.send(repairedMessage);
  await client.close();
}

main()
  .catch((err) => {
    console.log(">>>>> Error in running sample scenarios: ", err);
    ns.close();
  })
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  });
