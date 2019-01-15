import { SendableMessageInfo, Namespace } from "../../lib";
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

let ns: Namespace;

/*
    This sample demonstrates scenarios as to how a Service Bus message can be explicitly moved to
    the DLQ. For other implicit ways when Service Bus messages get moved to DLQ, refer to -
    https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues

    Run processMessagesInDLQ example after this to see how the messages in DLQ can be reprocessed.
*/
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(connectionString);
  try {
    // Sending a message to ensure that there is atleast one message in the main queue
    await sendMessage();

    await receiveMessage();
  } finally {
    await ns.close();
  }
}

async function sendMessage(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to send to a queue
  // const client = ns.createTopicClient(topicName); // Use this API to send to a topic

  const message: SendableMessageInfo = {
    body: { name: "Creamy Chicken Pasta", type: "Dinner" },
    contentType: "application/json",
    label: "Recipe"
  };
  await client.send(message);
  await client.close();
}

async function receiveMessage(): Promise<void> {
  const client = ns.createQueueClient(queueName); // Use this API to receive from a queue
  // const client = ns.createSubscriptionClient(topicName, subscriptionName); // Use this API to receive from a topic subscription

  const message = await client.receiveBatch(1);
  console.log(">>>>> Receiving one message from the main queue - ", message);

  if (message) {
    // Deadletter the message received
    await message[0].deadLetter({
      deadletterReason: "Incorrect Recipe type",
      deadLetterErrorDescription: "Recipe type does not  match preferences."
    });

    // Mark message as complete/processed.
    await message[0].complete();
  } else {
    console.log(">>>> Error: No messages were received from the main queue.");
  }

  await client.close();
}

main().catch((err) => {
  console.log("Error occurred: ", err);
});
