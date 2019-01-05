// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import "mocha";
import * as chai from "chai";
const should = chai.should();
import * as chaiAsPromised from "chai-as-promised";
import * as dotenv from "dotenv";
dotenv.config();
chai.use(chaiAsPromised);
import {
  Namespace,
  QueueClient,
  SendableMessageInfo,
  generateUuid,
  TopicClient,
  SubscriptionClient
} from "../lib";

const testMessages: SendableMessageInfo[] = [
  {
    body: "hello1",
    messageId: `test message ${generateUuid()}`
  },
  {
    body: "hello2",
    messageId: `test message ${generateUuid()}`
  }
];

async function testPeekMsgsLength(
  client: QueueClient | SubscriptionClient,
  expectedPeekLength: number
): Promise<void> {
  const peekedMsgs = await client.peek(expectedPeekLength + 1);
  should.equal(peekedMsgs.length, expectedPeekLength);
}

describe("ReceiveBatch from Queue/Subscription", function(): void {
  let namespace: Namespace;
  let queueClient: QueueClient;
  let topicClient: TopicClient;
  let subscriptionClient: SubscriptionClient;

  beforeEach(async () => {
    // The tests in this file expect the env variables to contain the connection string and
    // the names of empty queue/topic/subscription that are to be tested

    if (!process.env.SERVICEBUS_CONNECTION_STRING) {
      throw new Error(
        "Define SERVICEBUS_CONNECTION_STRING in your environment before running integration tests."
      );
    }
    if (!process.env.TOPIC_NAME) {
      throw new Error("Define TOPIC_NAME in your environment before running integration tests.");
    }
    if (!process.env.QUEUE_NAME) {
      throw new Error("Define QUEUE_NAME in your environment before running integration tests.");
    }
    if (!process.env.SUBSCRIPTION_NAME) {
      throw new Error(
        "Define SUBSCRIPTION_NAME in your environment before running integration tests."
      );
    }

    namespace = Namespace.createFromConnectionString(process.env.SERVICEBUS_CONNECTION_STRING);
    queueClient = namespace.createQueueClient(process.env.QUEUE_NAME);
    topicClient = namespace.createTopicClient(process.env.TOPIC_NAME);
    subscriptionClient = namespace.createSubscriptionClient(
      process.env.TOPIC_NAME,
      process.env.SUBSCRIPTION_NAME
    );

    const peekedQueueMsg = await queueClient.peek();
    if (peekedQueueMsg.length) {
      throw new Error("Please use an empty queue for integration testing");
    }

    const peekedSubscriptionMsg = await subscriptionClient.peek();
    if (peekedSubscriptionMsg.length) {
      throw new Error("Please use an empty Subscription for integration testing");
    }
  });

  afterEach(async () => {
    return namespace.close();
  });

  it("PeekLock: complete() removes msg from Queue", async function(): Promise<void> {
    await queueClient.send(testMessages[0]);
    const msgs = await queueClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);

    await msgs[0].complete();

    await testPeekMsgsLength(queueClient, 0);
  });

  it("PeekLock: complete() removes msg from Subscription", async function(): Promise<void> {
    await topicClient.send(testMessages[0]);
    const msgs = await subscriptionClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);

    await msgs[0].complete();

    await testPeekMsgsLength(subscriptionClient, 0);
  });

  // We test for mutilple receiveBatch specifically to ensure that batchingRecevier on a client is reused
  // See https://github.com/Azure/azure-service-bus-node/issues/31
  it("Multiple receiveBatch using Queues", async function(): Promise<void> {
    await queueClient.sendBatch(testMessages);
    const msgs1 = await queueClient.receiveBatch(1);
    const msgs2 = await queueClient.receiveBatch(1);

    // Results are checked after both receiveBatches are done to ensure that the second call doesnt
    // affect the result from the first one.
    should.equal(Array.isArray(msgs1), true);
    should.equal(msgs1.length, 1);
    should.equal(msgs1[0].body, testMessages[0].body);
    should.equal(msgs1[0].messageId, testMessages[0].messageId);

    should.equal(Array.isArray(msgs2), true);
    should.equal(msgs2.length, 1);
    should.equal(msgs2[0].body, testMessages[1].body);
    should.equal(msgs2[0].messageId, testMessages[1].messageId);

    await msgs1[0].complete();
    await msgs2[0].complete();

    await testPeekMsgsLength(queueClient, 0);
  });

  // We test for mutilple receiveBatch specifically to ensure that batchingRecevier on a client is reused
  // See https://github.com/Azure/azure-service-bus-node/issues/31
  it("Multiple receiveBatch using Topics and Subscriptions", async function(): Promise<void> {
    await topicClient.sendBatch(testMessages);
    const msgs1 = await subscriptionClient.receiveBatch(1);
    const msgs2 = await subscriptionClient.receiveBatch(1);

    // Results are checked after both receiveBatches are done to ensure that the second call doesnt
    // affect the result from the first one.
    should.equal(Array.isArray(msgs1), true);
    should.equal(msgs1.length, 1);
    should.equal(msgs1[0].body, testMessages[0].body);
    should.equal(msgs1[0].messageId, testMessages[0].messageId);

    should.equal(Array.isArray(msgs2), true);
    should.equal(msgs2.length, 1);
    should.equal(msgs2[0].body, testMessages[1].body);
    should.equal(msgs2[0].messageId, testMessages[1].messageId);

    await msgs1[0].complete();
    await msgs2[0].complete();

    await testPeekMsgsLength(subscriptionClient, 0);
  });

  it("Abandoned message is retained in the Queue with incremented deliveryCount", async function(): Promise<
    void
  > {
    await queueClient.send(testMessages[0]);

    let receivedMsgs = await queueClient.receiveBatch(1);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].deliveryCount, 0);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    // TODO: This is taking 20 seconds. Why?
    await receivedMsgs[0].abandon();

    await testPeekMsgsLength(queueClient, 1);

    receivedMsgs = await queueClient.receiveBatch(1);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].deliveryCount, 1);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    await receivedMsgs[0].complete();
  });

  it("Abandoned message is retained in the Subscription with incremented deliveryCount", async function(): Promise<
    void
  > {
    await topicClient.send(testMessages[0]);

    let receivedMsgs = await subscriptionClient.receiveBatch(1);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].deliveryCount, 0);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    // TODO: This is taking 20 seconds. Why?
    await receivedMsgs[0].abandon();

    await testPeekMsgsLength(subscriptionClient, 1);

    receivedMsgs = await subscriptionClient.receiveBatch(1);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].deliveryCount, 1);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    await receivedMsgs[0].complete();
  });

  it("Abandoning a message 10 times, you get it no more. You can then only get it from the dead letter queue", async function(): Promise<
    void
  > {
    await queueClient.send(testMessages[0]);
    let abandonMsgCount = 0;
    let receivedMsgs;

    while (abandonMsgCount < 10) {
      receivedMsgs = await queueClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);
      should.equal(receivedMsgs[0].deliveryCount, abandonMsgCount);
      abandonMsgCount++;

      await receivedMsgs[0].abandon();
    }

    await testPeekMsgsLength(queueClient, 0);

    const deadLetterQueuePath = process.env.QUEUE_NAME + "/$DeadLetterQueue";
    const client = namespace.createQueueClient(deadLetterQueuePath);
    receivedMsgs = await client.receiveBatch(1);

    should.equal(Array.isArray(receivedMsgs), true);
    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    await receivedMsgs[0].complete();

    await testPeekMsgsLength(client, 0);
    await client.close();
  });

  it("Abandoning a message 10 times, you get it no more. You can then only get it from the dead letter subscription", async function(): Promise<
    void
  > {
    await topicClient.send(testMessages[0]);
    let abandonMsgCount = 0;
    let receivedMsgs;
    let clientSubscription: SubscriptionClient;

    while (abandonMsgCount < 10) {
      receivedMsgs = await subscriptionClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);
      should.equal(receivedMsgs[0].deliveryCount, abandonMsgCount);
      abandonMsgCount++;

      await receivedMsgs[0].abandon();
    }

    await testPeekMsgsLength(subscriptionClient, 0);

    const deadLetterTopicPath =
      process.env.TOPIC_NAME +
      "/Subscriptions/" +
      process.env.SUBSCRIPTION_NAME +
      "/$DeadLetterQueue";

    clientSubscription = namespace.createSubscriptionClient(
      deadLetterTopicPath ? deadLetterTopicPath : "",
      process.env.SUBSCRIPTION_NAME ? process.env.SUBSCRIPTION_NAME : ""
    );

    receivedMsgs = await clientSubscription.receiveBatch(1);

    should.equal(Array.isArray(receivedMsgs), true);
    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    await receivedMsgs[0].complete();

    await testPeekMsgsLength(clientSubscription, 0);
  });

  it("Deferring a message results in not getting the same message again from queue. The message is then gotten using receiveDefferedMessages", async function(): Promise<
    void
  > {
    await queueClient.sendBatch(testMessages);
    const msgs = await queueClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);

    if (msgs[0].sequenceNumber) {
      const sequenceNumber = msgs[0].sequenceNumber;
      await msgs[0].defer();

      const receivedMsgs = await queueClient.receiveBatch(1);
      should.equal(Array.isArray(receivedMsgs), true);
      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body === testMessages[0].body, false);
      should.equal(receivedMsgs[0].messageId === testMessages[0].messageId, false);
      await receivedMsgs[0].complete();

      const message = await queueClient.receiveDeferredMessage(sequenceNumber);
      if (message) {
        should.equal(message.body, testMessages[0].body);
        should.equal(message.messageId, testMessages[0].messageId);

        await message.complete();
      } else {
        throw "The message that we are receving from the sequence number can not be null";
      }
    } else {
      throw "Sequence Number can not be null";
    }
    await testPeekMsgsLength(queueClient, 0);
  });

  it("Deferring a message results in not getting the same message again from subscription. The message is then gotten using receiveDefferedMessages", async function(): Promise<
    void
  > {
    await topicClient.sendBatch(testMessages);
    const msgs = await subscriptionClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);

    if (msgs[0].sequenceNumber) {
      const sequenceNumber = msgs[0].sequenceNumber;
      await msgs[0].defer();

      const receivedMsgs = await subscriptionClient.receiveBatch(1);
      should.equal(Array.isArray(receivedMsgs), true);
      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body === testMessages[0].body, false);
      should.equal(receivedMsgs[0].messageId === testMessages[0].messageId, false);
      await receivedMsgs[0].complete();

      const message = await subscriptionClient.receiveDeferredMessage(sequenceNumber);
      if (message) {
        should.equal(message.body, testMessages[0].body);
        should.equal(message.messageId, testMessages[0].messageId);

        await message.complete();
      } else {
        throw "The message that we are receving from the sequence number can not be null";
      }
    } else {
      throw "Sequence Number can not be null";
    }
    await testPeekMsgsLength(subscriptionClient, 0);
  });
});
