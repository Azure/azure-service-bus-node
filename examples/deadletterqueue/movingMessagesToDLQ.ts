import {
  delay,
  generateUuid,
  SendableMessageInfo,
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
const numberOfMessages: number = parseInt(process.env.MESSAGE_COUNT || "1");
const receiveClientTimeout: number = 10000;
console.log("str: ", str);
console.log("path: ", queuePath);
console.log("Number of messages to send each time: ", numberOfMessages);

let ns: Namespace;

/*
    There are many scenarios wherein messages are moved to the DLQ.
    Ref: https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues

    This sample demonstrates usage of DLQ for 3 such scenarios:
      A. When client invokes the .deadletter() API on the brokered message.
      B. When system exceeds maximum allowed delivery attempts on the message,
         which is by default set to 10
      C. When processing of message encounters error or an exception.

    After running this sample, run the processMessagesInDLQ example to see how the messages
    can be reprocessed.

*/
async function main(): Promise<void> {
  try {
    ns = Namespace.createFromConnectionString(str);
    // Clean up queues before running.
    await purgeAllQueues();

    // This scenario demonstrates brokered message's deadletter() API resulting in immediate
    // message move to DLQ.
    await runSimpleDeadLetterScenario();

    // This scenario demonstrates how exceeding delivery count on message will result in
    // automatic move to DLQ
    await runExceedMaxRetriesScenario();

    // This scenario demonstrates how message processing failures can cause message move to DLQ.
    await runProcessingErrorHandlingScenario();
  } catch (err) {
    console.log(">>>>> Error in running sample scenarios: ", err);
  } finally {
    console.log("\n >>>> Calling close....");
    ns.close();
  }
}

// Queue clean up util
async function purgeAllQueues(): Promise<void> {
  await purgeQueue(queuePath);
  await purgeQueue(queuePath + "/$DeadLetterQueue");
}

async function purgeQueue(inputQueuePath: string): Promise<void> {
  // Process messages from queue, by invoking .deadletter() on the brokered message
  await processMessageQueue(queuePurgingProcessor, inputQueuePath);
  console.log(">>>> Cleaning up queue: ", inputQueuePath);
}

async function runSimpleDeadLetterScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessages();

  // Process messages from queue, by invoking .deadletter() on the brokered message
  console.log("\n Setup queues, now running scenario A ... ");
  await processMessageQueue(simpleDeadletterProcessor, queuePath);
}

async function runExceedMaxRetriesScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessages();

  // Process messages from queue - exceed max retries on the messages
  console.log("\n Setup queues, now running scenario B ... ");
  await processMessageQueue(exceedMaxRetriesProcessor, queuePath);
}

async function runProcessingErrorHandlingScenario(): Promise<void> {
  // Prepare given queue by sending few messages
  await sendMessages();

  // Process messages from queue, by invoking a faulty processor that doesn't successfully process
  console.log("\n Setup queues, now running scenario C ... ");
  await processMessageQueue(faultyProcessor, queuePath);
}

// Helper to send few sample messages to given queue
async function sendMessages(): Promise<void> {
  const client = ns.createQueueClient(queuePath);
  const messageBody = { name: "Apple", color: "Green", qty: 1 };
  const message: SendableMessageInfo = {
    body: messageBody,
    contentType: "application/json",
    messageId: generateUuid()
  };

  let i: number;
  for (i = 0; i < numberOfMessages; i++) {
    await client.send(message);
  }
}

// Helper to process messages by delegating actual processing to a supplied custom messageProcessor
async function processMessageQueue(messageProcessor: Function, path: string): Promise<void> {
  const client = ns.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });
  await messageProcessor(client);
}

// OnError handler for message receive
const onError: OnError = (err: MessagingError | Error) => {
  console.log(">>>>> Error occurred: ", err);
};

// OnMessage handler for Scenario A - immediate dead lettering of message on receive
async function simpleDeadletterProcessor(client: QueueClient): Promise<void> {
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Killing the message", brokeredMessage);
    await brokeredMessage.deadLetter();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeout);
  await receiverHandler.stop();
}

// OnMessage handler for Scenario B - attempts to exceed max allowed retries
async function exceedMaxRetriesProcessor(client: QueueClient): Promise<void> {
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(
      ">>>>> Attempt to abandon message. Current delivery count: ",
      brokeredMessage.deliveryCount
    );
    await brokeredMessage.abandon();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeout);
  await receiverHandler.stop();
}

// OnMessage handler for Scenario C - usage for handling reject/fail on message processing
async function faultyProcessor(client: QueueClient): Promise<void> {
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Rejecting the message: ", brokeredMessage);
    try {
      await Promise.reject("Green apples are not OK.");
    } catch (err) {
      console.log("Message from faulty processor: ", err);

      // TODO: Fix bug with .deadletter() in SDK for not setting these properties on the message.
      brokeredMessage.deadLetter({
        deadletterReason: "Bad Apple",
        deadLetterErrorDescription: "Red apples are sweeter than green."
      });
    }
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, {
    autoComplete: false
  });
  await delay(receiveClientTimeout);
  await receiverHandler.stop();
}

// OnMessage handler for accomplishing queue purge
async function queuePurgingProcessor(client: QueueClient): Promise<void> {
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    await brokeredMessage.complete();
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeout);
  await receiverHandler.stop();
}

main();
