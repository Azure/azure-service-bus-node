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
    This sample demonstrates scenarios as to how messages can be moved to the DLQ.
    Ref: https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues

      A. Explicit - When client invokes the .deadletter() API on the brokered message.
      B. Implicit - When system exceeds maximum allowed delivery attempts on the message,
         which is by default set to 10

    CAUTION: Running this sample may cause all messages in main queue to be moved to DLQ.
    If main queue is empty, you should see 2 new "Non-Vegetarian recipe" messages in the DLQ.
    Then run the processMessagesInDLQ example to see how the messages in DLQ can be reprocessed.

*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);

  // This scenario demonstrates how a message can be explicitly moved to DLQ using the
  // .deadletter() API
  await runExplicitDeadletteringScenario();

  // This scenario demonstrates how exceeding delivery count on message will result in
  // automatic, implicit message move to DLQ
  await runImplicitDeadletteringScenario();

  console.log("\n >>>> Calling close....");
  ns.close();
}

async function runExplicitDeadletteringScenario(): Promise<void> {
  // Prepare given queue by sending sample message
  const data = { name: "Creamy Chicken Pasta", type: "Dinner" };
  await sendMessage(data);

  // Process messages from queue, by invoking .deadletter() on the brokered message
  console.log("\n Running scenario A ... ");
  const client = ns.createQueueClient(queuePath, { receiveMode: ReceiveMode.peekLock });
  const onMessageHandler: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(">>>>> Deadletter-ing the message", brokeredMessage);
    // TODO: Fix bug with .deadletter() in SDK for not setting these properties on the message.
    await brokeredMessage.deadLetter({
      deadletterReason: "Incorrect Recipe type",
      deadLetterErrorDescription: "Recipe type does not  match preferences."
    });
  };

  const receiverHandler = await client.receive(onMessageHandler, onError, { autoComplete: false });
  await delay(receiveClientTimeoutInMilliseconds);
  await receiverHandler.stop();
  await client.close();
}

async function runImplicitDeadletteringScenario(): Promise<void> {
  // Prepare given queue by sending sample message
  const data = { name: "Dry-braised Schezuan Prawn", type: "Non-Vegetarian" };
  await sendMessage(data);

  // Process messages from queue - exceed max retries on the messages
  console.log("\n Running scenario B ... ");
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

// OnError handler for message receive
const onError: OnError = (err: MessagingError | Error) => {
  console.log(">>>>> Error occurred: ", err);
};

// Helper to send sample message to configured queue
async function sendMessage(messageBody: Object): Promise<void> {
  const client = ns.createQueueClient(queuePath);
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
  .catch((err) => {
    console.log(">>>>> Error in running sample scenarios: ", err);
    ns.close();
  })
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  });
