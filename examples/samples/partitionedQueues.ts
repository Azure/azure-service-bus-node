import {
  delay,
  SendableMessageInfo,
  QueueClient,
  ReceiveMode,
  generateUuid,
  Namespace,
  ReceiveHandler,
  OnError,
  OnMessage,
  ServiceBusMessage,
  MessagingError
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const path = process.env.QUEUE_NAME || "";
console.log(`str: ${str}`);
console.log(`path: ${path}`);

let ns: Namespace;
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  const client = ns.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });

  // populate the queue with messages
  await sendMessages(client);

  let rcvHandler: ReceiveHandler;

  // retrieve messages from the queue
  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    console.log(
      ` \n### Received message:
        ID - ${brokeredMessage.messageId},
        messageBody - ${brokeredMessage.body ? brokeredMessage.body.toString() : undefined},
        partitionKey - ${brokeredMessage.partitionKey},
        label - ${brokeredMessage.label}`
    );
  };

  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };

  rcvHandler = client.receive(onMessage, onError);

  // wait 5 seconds
  await delay(5000);

  console.log("Stopping the receiver");

  await rcvHandler.stop();

  console.log("Closing the client");

  await client.close();
}

async function sendMessages(queueClient: QueueClient): Promise<void> {
  const data = [
    { lastName: "Einstein", firstName: "Albert" },
    { lastName: "Heisenberg", firstName: "Werner" },
    { lastName: "Curie", firstName: "Marie" },
    { lastName: "Hawking", firstName: "Steven" },
    { lastName: "Newton", firstName: "Isaac" },
    { lastName: "Bohr", firstName: "Niels" },
    { lastName: "Faraday", firstName: "Michael" },
    { lastName: "Galilei", firstName: "Galileo" },
    { lastName: "Kepler", firstName: "Johannes" },
    { lastName: "Kopernikus", firstName: "Nikolaus" }
  ];

  for (let j = 0; j < 3; j++) {
    for (let index = 0; index < data.length; index++) {
      const element = data[index];
      const message: SendableMessageInfo = {
        body: `${element.firstName} ${element.lastName}`,
        label: "Scientist",
        timeToLive: 2 * 60 * 1000, // After 2 minutes, the message will be removed from the queue
        messageId: generateUuid(),
        partitionKey: data[index].lastName.substring(0, 2)
      };
      console.log(`Sending ${message.body}`);
      await queueClient.send(message);
    }
  }
}

main()
  .then(() => {
    console.log("\n>>>> Done!!!!");
  })
  .catch((err) => {
    console.log("error: ", err);
  });
