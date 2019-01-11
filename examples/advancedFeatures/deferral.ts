import {
  OnMessage,
  OnError,
  MessagingError,
  delay,
  ServiceBusMessage,
  Namespace,
  SendableMessageInfo
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";
const topicName = process.env.TOPIC_NAME || "";
const subscriptionName = process.env.SUBSCRIPTION_NAME || "";

console.log("Connection string value: ", connectionString);
console.log("Queue name: ", queueName);
console.log("Topic name: ", topicName);
console.log("Subscription name: ", subscriptionName);

/*
  This sample demonstrates how Service Message deferral feature can be used to defer messages to be
  available for receiving by client at a later time.

  We take for example an application receives cooking instructions that the clients need to process
  in appropriate sequence. We simulate a common scenario where the messages are not received in
  expected sequence. The example shows how message deferral can be used to process the messages
  in expected sequence.
*/
async function main(): Promise<void> {
  await sendMessage();
  await receiveMessage();
}

async function sendMessage(): Promise<void> {
  const nsSend = Namespace.createFromConnectionString(connectionString);
  const sendClient = nsSend.createQueueClient(queueName); // Use this API to send to a queue
  // const sendClient = nsSend.createTopicClient(topicName); // Use this API to send to a topic

  const data = [
    { step: 1, title: "Shop" },
    { step: 2, title: "Unpack" },
    { step: 3, title: "Prepare" },
    { step: 4, title: "Cook" },
    { step: 5, title: "Eat" }
  ];
  try {
    const promises = new Array();
    for (let index = 0; index < data.length; index++) {
      const message: SendableMessageInfo = {
        body: data[index],
        label: "RecipeStep",
        contentType: "application/json"
      };
      // the way we shuffle the message order is to introduce a tiny random delay before each of the messages is sent
      promises.push(
        delay(Math.random() * 30).then(async () => {
          try {
            await sendClient.send(message);
            console.log("Sent message step:", data[index].step);
          } catch (err) {
            console.log("Error while sending message", err);
          }
        })
      );
    }
    // wait until all the send tasks are complete
    await Promise.all(promises);
  } finally {
    await nsSend.close();
  }
}

async function receiveMessage(): Promise<void> {
  const nsRcv = Namespace.createFromConnectionString(connectionString);

  const receiveClient = nsRcv.createQueueClient(queueName); // Use this API to receive from a queue
  // const receiveClient = nsRcv.createSubscriptionClient(topicName, subscriptionName); // Use this API to receive from a topic subscription

  const deferredSteps = new Map();
  let lastProcessedRecipeStep = 0;
  try {
    const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
      if (
        brokeredMessage.label === "RecipeStep" &&
        brokeredMessage.contentType === "application/json"
      ) {
        const message = brokeredMessage.body;
        // now let's check whether the step we received is the step we expect at this stage of the workflow
        if (message.step === lastProcessedRecipeStep + 1) {
          console.log("Message Received:", message);
          lastProcessedRecipeStep++;
          await brokeredMessage.complete();
        } else {
          // if this is not the step we expected, we defer the message, meaning that we leave it in the queue but take it out of
          // the delivery order. We put it aside. To retrieve it later, we remeber its sequence number
          const sequenceNumber = brokeredMessage.sequenceNumber;
          deferredSteps.set(message.step, sequenceNumber);
          await brokeredMessage.defer();
        }
      } else {
        // we dead-letter the message if we don't know what to do with it.
        console.log(
          "Unknown message recieved, moving it to dead-letter queue ",
          brokeredMessage.body
        );
        await brokeredMessage.deadLetter();
      }
    };
    const onError: OnError = (err: MessagingError | Error) => {
      console.log(">>>>> Error occurred: ", err);
    };

    /*we are disabling autoComplete because we want to control the settling of the message i.e we want to control whether the message should be completed, deferred or deadlettered.*/
    const rcvHandler = receiveClient.receive(onMessage, onError, { autoComplete: false });
    await delay(10000);
    console.log("Deferred Messages count:", deferredSteps.size);
    // Now we process the deferrred messages
    while (deferredSteps.size > 0) {
      const step = lastProcessedRecipeStep + 1;
      const sequenceNumber = deferredSteps.get(step);
      const message = await receiveClient.receiveDeferredMessage(sequenceNumber);
      if (message) {
        console.log("Received Deferral Message:", message.body);
        await message.complete();
      } else {
        console.log("No message found for step number ", step);
      }
      deferredSteps.delete(step);
      lastProcessedRecipeStep++;
    }
    await rcvHandler.stop();
  } finally {
    await nsRcv.close();
  }
}

main();
