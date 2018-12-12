import {
  OnMessage,
  OnError,
  MessagingError,
  delay,
  ServiceBusMessage,
  ReceiveMode,
  generateUuid,
  Namespace,
  SendableMessageInfo
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const path = process.env.QUEUE_NAME || "";
console.log("str: ", str);
console.log("path: ", path);

async function main(): Promise<void> {
  await sendMessage();
  await receiveMessage();
}

async function sendMessage(): Promise<void> {
  const nsSend = Namespace.createFromConnectionString(str);
  const sendClient = nsSend.createQueueClient(path);
  var data = [
    { step: 1, title: "Shop" },
    { step: 2, title: "Unpack" },
    { step: 3, title: "Prepare" },
    { step: 4, title: "Cook" },
    { step: 5, title: "Eat" }
  ];
  try {
    var promises = new Set<Promise<void>>();
    for (let index = 0; index < data.length; index++) {
      const message: SendableMessageInfo = {
        body: JSON.stringify(data[index]),
        label: "RecipeStep",
        contentType: "application/json",
        timeToLive: 2 * 60 * 1000, // 2 minutes
        messageId: generateUuid()
      };
      // the way we shuffle the message order is to introduce a tiny random delay before each of the messages is sent
      promises.add(
        delay(Math.random() * 30).then(async () => {
          await sendClient.send(message);
          console.log("Sent message number:", index + 1);
        })
      );
    }
    // wait until all the send tasks are complete
    for (let promise of promises) {
      await promise;
    }
  } catch (err) {
    console.log("Error while sending", err);
  }
  return nsSend.close();
}

async function receiveMessage(): Promise<void> {
  const nsRcv = Namespace.createFromConnectionString(str);
  const receiveClient = nsRcv.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });
  var deferredSteps = new Map();
  var lastProcessedRecipeStep = 0;
  try {
    const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
      if (
        brokeredMessage.label === "RecipeStep" &&
        brokeredMessage.contentType === "application/json"
      ) {
        // now let's check whether the step we received is the step we expect at this stage of the workflow
        if (JSON.parse(brokeredMessage.body).step == lastProcessedRecipeStep + 1) {
          console.log(
            "Message Received:",
            brokeredMessage.body ? JSON.parse(brokeredMessage.body) : null
          );
          lastProcessedRecipeStep = JSON.parse(brokeredMessage.body).step;
          await brokeredMessage.complete();
        } else {
          // if this is not the step we expected, we defer the message, meaning that we leave it in the queue but take it out of
          // the delivery order. We put it aside. To retrieve it later, we remeber its sequence number
          const sequenceNumber = brokeredMessage.sequenceNumber!;
          deferredSteps.set(JSON.parse(brokeredMessage.body).step, sequenceNumber);
          await brokeredMessage.defer();
        }
      }
    };
    const onError: OnError = (err: MessagingError | Error) => {
      console.log(">>>>> Error occurred: ", err);
    };

    const rcvHandler = receiveClient.receive(onMessage, onError, { autoComplete: false });
    await delay(10000);
    console.log("Deferred Messages size", deferredSteps.size);
    // Now we process the deferrred steps
    while (deferredSteps.size > 0) {
      var step = lastProcessedRecipeStep + 1;
      if (deferredSteps.has(step)) {
        const sequenceNumber = deferredSteps.get(step);
        const message = await receiveClient.receiveDeferredMessage(sequenceNumber);
        console.log("Received Deferral Message:", message ? JSON.parse(message.body) : null);
        await message!.complete();
        lastProcessedRecipeStep = lastProcessedRecipeStep + 1;
        deferredSteps.delete(lastProcessedRecipeStep);
      }
    }
    await rcvHandler.stop();
  } catch (err) {
    console.log("Error while receiving: ", err);
  }
  return nsRcv.close();
}

main()
  .then(() => {
    console.log("\n>>>> sample Done!!!!");
  })
  .catch((err) => {
    console.log("error: ", err);
  });
