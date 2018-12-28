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
const deadLetterQueuePath = (process.env.QUEUE_NAME || "") + "/$DeadLetterQueue";
const receiveClientTimeoutInMilliseconds = 10000;
console.log("str: ", str);
console.log("queue path: ", queuePath);
console.log("deadletter queue path: ", deadLetterQueuePath);

let ns: Namespace;

/*
    Setup Instructions: Ensure the queue is configured to have DLQ enabled, and that the appropriate
    environment variables are set.

    There are many scenarios wherein messages are moved to the DLQ.
    Ref: https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues

    This sample demonstrates usage of DLQ for 3 such scenarios:
      A. When client invokes the .deadletter() API on the brokered message.
      B. When system exceeds maximum allowed delivery attempts on the message,
         which is by default set to 10
      C. When processing of message encounters error or an exception.

    After running this sample, you should see 3 Non-Vegetarian recipe messages in the DLQ.
    Then run the processMessagesInDLQ example to see how the messages
    can be reprocessed.

*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  // Clean up queues before running.
  await purgeMessageQueue(queuePath);
  console.log(">>>> Cleaning up queue: ", queuePath);
  await purgeMessageQueue(deadLetterQueuePath);
  console.log(">>>> Cleaning up queue: ", deadLetterQueuePath);

  // This scenario demonstrates brokered message's deadletter() API resulting in immediate
  // message move to DLQ.
  await runSimpleDeadLetterScenario();

  // This scenario demonstrates how exceeding delivery count on message will result in
  // automatic move to DLQ
  await runExceedMaxRetriesScenario();

  // This scenario demonstrates how message processing failures can cause message move to DLQ.
  await runProcessingErrorHandlingScenario();
}

// Helper for purging a given queue
async function purgeMessageQueue(path: string): Promise<void> {
  const client = ns.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    await brokeredMessage.complete();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

async function runSimpleDeadLetterScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessage(0);

  // Process messages from queue, by invoking .deadletter() on the brokered message
  console.log("\n Setup queues, now running scenario A ... ");
  const client = ns.createQueueClient(queuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Deadletter-ing the message", brokeredMessage);
    await brokeredMessage.deadLetter();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

async function runExceedMaxRetriesScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessage(1);

  // Process messages from queue - exceed max retries on the messages
  console.log("\n Setup queues, now running scenario B ... ");
  const client = ns.createQueueClient(queuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(
      ">>>>> Attempt to abandon message. Current delivery count: ",
      brokeredMessage.deliveryCount
    );
    await brokeredMessage.abandon();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

async function runProcessingErrorHandlingScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessage(2);

  // Process messages from queue, by invoking a faulty processor that doesn't successfully process
  console.log("\n Setup queues, now running scenario C ... ");
  const client = ns.createQueueClient(queuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Rejecting the message: ", brokeredMessage);
    try {
      throw new Error("Customer is Vegetarian.");
    } catch (err) {
      console.log("Message from faulty processor: ", err);

      // TODO: Fix bug with .deadletter() in SDK for not setting these properties on the message.
      await brokeredMessage.deadLetter({
        deadletterReason: "Incorrect Recipe type",
        deadLetterErrorDescription: "Recipe type does not  match preferences."
      });
    }
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, {
    autoComplete: false
  });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

// OnError handler for message receive
const onError: OnError = (err: MessagingError | Error) => {
  console.log(">>>>> Error occurred: ", err);
};

// Helper to send few sample messages to given queue
async function sendMessage(index: number): Promise<void> {
  const nonVegetarianRecipes = [
    { name: "Grilled Steak", type: "Non-Vegetarian" },
    { name: "Dry-braised Schezuan Prawn", type: "Non-Vegetarian" },
    { name: "Creamy Chicken Pasta", type: "Non-Vegetarian" }
  ];
  const client = ns.createQueueClient(queuePath);
  const messageBody = nonVegetarianRecipes[index];
  const message: SendableMessageInfo = {
    body: messageBody,
    contentType: "application/json",
    label: "Recipe",
    timeToLive: 2 * 60 * 1000, // 2 minutes
    messageId: generateUuid()
  };
  await client.send(message);
  await client.close();
}

main()
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  })
  .catch((err) => {
    console.log(">>>>> Error in running sample scenarios: ", err);
  })
  .then(() => {
    console.log("\n >>>> Calling close....");
    ns.close();
  });
