import {
  ReceiveMode,
  Namespace,
  generateUuid,
  QueueClient,
  SendableMessageInfo,
  OnMessage,
  ServiceBusMessage,
  OnError,
  MessagingError,
  delay,
  ReceiveHandler
} from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const path = process.env.QUEUE_NAME || "";
console.log("str: ", str);
console.log("path: ", path);

let ns: Namespace;

async function sendMessages(queueClient: QueueClient): Promise<void> {
  const data: { lastName: string; firstName: string }[] = [
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

  for (let index = 0; index < data.length; index++) {
    const element = data[index];
    const message: SendableMessageInfo = {
      body: `${element.firstName} ${element.lastName}`,
      label: "Scientist",
      timeToLive: 2 * 60 * 1000, // 2 minutes
      messageId: generateUuid()
    };

    console.log(`Sending ${message.body}`);
    await queueClient.send(message);
  }
}

async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  const client = ns.createQueueClient(path, { receiveMode: ReceiveMode.peekLock });

  // populate the queue with messages
  await sendMessages(client);

  let rcvHandler: ReceiveHandler;

  // Using an object so that we can pass it around by reference
  let received = 0;

  // retrieve all the messages that were sent to the queue (10 messages)
  const onMessage: OnMessage = async (brokeredMessage: ServiceBusMessage) => {
    try {
      if (received <= 10) {
        console.log(
          "### Actual message:",
          brokeredMessage.body ? brokeredMessage.body.toString() : undefined
        );

        // mark the message as completed
        await brokeredMessage.complete();
      }
    } finally {
      // we received a message
      received++;

      if (received >= 10) {
        console.log("Received 10 messages.");
        rcvHandler.stop();
      }
    }
  };

  const onError: OnError = (err: MessagingError | Error) => {
    console.log(">>>>> Error occurred: ", err);
  };
  rcvHandler = client.receive(onMessage, onError, { autoComplete: false });

  // wait 30 seconds, or until we receive 10 messages
  let timeout = 0;
  while (received < 10 && timeout < 30 * 1000) {
    console.log(received);

    await delay(1000);
    timeout += 1000;
  }

  await client.close();
}

main()
  .then(() => {
    console.log(">>>> Calling close....");
    return ns.close();
  })
  .catch((err) => {
    console.log("error: ", err);
  });
