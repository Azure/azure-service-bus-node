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
  SubscriptionClient,
  delay
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

const maxDeliveryCount = 10;

describe.only("ReceiveBatch from Queue/Subscription", function(): void {
  let namespace: Namespace;
  let queueClient: QueueClient;
  let topicClient: TopicClient;
  let subscriptionClient: SubscriptionClient;
  let deadletterQueueClient: QueueClient;
  let deadletterSubscriptionClient: SubscriptionClient;
  let errorWasThrown: boolean;

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
    deadletterQueueClient = namespace.createQueueClient(
      Namespace.getDeadLetterQueuePathForQueue(queueClient.name)
    );
    deadletterSubscriptionClient = namespace.createSubscriptionClient(
      Namespace.getDeadLetterSubcriptionPathForSubcription(
        topicClient.name,
        subscriptionClient.subscriptionName
      ),
      subscriptionClient.subscriptionName
    );

    const peekedQueueMsg = await queueClient.peek();
    if (peekedQueueMsg.length) {
      throw new Error("Please use an empty queue for integration testing");
    }

    const peekedSubscriptionMsg = await subscriptionClient.peek();
    if (peekedSubscriptionMsg.length) {
      throw new Error("Please use an empty Subscription for integration testing");
    }
    errorWasThrown = false;
  });

  afterEach(async () => {
    return namespace.close();
  });

  it("PeekLock: complete() removes msg from Queue/Subscription", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const msgs = await receiverClient.receiveBatch(1);

      should.equal(Array.isArray(msgs), true);
      should.equal(msgs.length, 1);
      should.equal(msgs[0].body, testMessages[0].body);
      should.equal(msgs[0].messageId, testMessages[0].messageId);

      await msgs[0].complete();

      await testPeekMsgsLength(receiverClient, 0);
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  // We test for mutilple receiveBatch specifically to ensure that batchingRecevier on a client is reused
  // See https://github.com/Azure/azure-service-bus-node/issues/31
  it("Multiple receiveBatch using Queues/Subscriptions", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.sendBatch(testMessages);
      const msgs1 = await receiverClient.receiveBatch(1);
      const msgs2 = await receiverClient.receiveBatch(1);

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
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Abandoned message is retained in the Queue/Subscription with incremented deliveryCount", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);

      let receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].deliveryCount, 0);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      // TODO: This is taking 20 seconds. Why?
      await receivedMsgs[0].abandon();

      await testPeekMsgsLength(receiverClient, 1);

      receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].deliveryCount, 1);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].complete();
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Message abandoned more than maxDeliveryCount goes to dead letter queue", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadLetterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      let abandonMsgCount = 0;

      while (abandonMsgCount < maxDeliveryCount) {
        const receivedMsgs = await receiverClient.receiveBatch(1);

        should.equal(receivedMsgs.length, 1);
        should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);
        should.equal(receivedMsgs[0].deliveryCount, abandonMsgCount);
        abandonMsgCount++;

        await receivedMsgs[0].abandon();
      }

      await testPeekMsgsLength(receiverClient, 0);

      const deadLetterMsgs = await deadLetterClient.receiveBatch(1);

      should.equal(Array.isArray(deadLetterMsgs), true);
      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].complete();

      await testPeekMsgsLength(deadLetterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  it("Receive deferred message from queue/subscription", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.sendBatch(testMessages);
      const msgs = await receiverClient.receiveBatch(1);

      should.equal(Array.isArray(msgs), true);
      should.equal(msgs.length, 1);
      should.equal(msgs[0].body, testMessages[0].body);
      should.equal(msgs[0].messageId, testMessages[0].messageId);

      if (!msgs[0].sequenceNumber) {
        throw "Sequence Number can not be null";
      }
      const sequenceNumber = msgs[0].sequenceNumber;
      await msgs[0].defer();

      const receivedMsgs = await receiverClient.receiveBatch(1);
      should.equal(Array.isArray(receivedMsgs), true);
      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body === testMessages[0].body, false);
      should.equal(receivedMsgs[0].messageId === testMessages[0].messageId, false);
      await receivedMsgs[0].complete();

      const deferredMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }
      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.complete();

      await testPeekMsgsLength(receiverClient, 0);
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Receive dead letter message from queue/subscription", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadLetterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);

      const receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(Array.isArray(receivedMsgs), true);
      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body, testMessages[0].body);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].deadLetter();

      await testPeekMsgsLength(receiverClient, 0);

      const deadLetterMsgs = await deadLetterClient.receiveBatch(1);

      should.equal(Array.isArray(deadLetterMsgs), true);
      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].complete();

      await testPeekMsgsLength(deadLetterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  it("No settlement of the message is retained in the Queue/Subscription with incremented deliveryCount", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);

      let receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].deliveryCount, 0);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await testPeekMsgsLength(receiverClient, 1);

      receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].deliveryCount, 1);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].complete();
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Receive n messages but queue/subscription only has m messages, where m < n", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const receivedMsgs = await receiverClient.receiveBatch(2);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body, testMessages[0].body);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].complete();

      await testPeekMsgsLength(receiverClient, 0);
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  async function deferMsgAndGetSequenceNum(
    client: QueueClient | SubscriptionClient
  ): Promise<Long> {
    const receivedMsgs = await client.receiveBatch(1);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].deliveryCount, 0);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    if (!receivedMsgs[0].sequenceNumber) {
      throw "Sequence Number can not be null";
    }
    const sequenceNumber = receivedMsgs[0].sequenceNumber;
    await receivedMsgs[0].defer();
    return sequenceNumber;
  }

  it("Abandoning a deferred message returns it to deferred queue.", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const sequenceNumber = await deferMsgAndGetSequenceNum(receiverClient);

      const deferredMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }
      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.deliveryCount, 1);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.abandon();

      await testPeekMsgsLength(receiverClient, 1);

      const abandonedMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!abandonedMsgs) {
        throw "No message received for sequence number";
      }
      should.equal(abandonedMsgs.body, testMessages[0].body);
      should.equal(abandonedMsgs.deliveryCount, 2);
      should.equal(abandonedMsgs.messageId, testMessages[0].messageId);

      await abandonedMsgs.complete();

      await testPeekMsgsLength(receiverClient, 0);
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Deadlettering a deferred message moves it to dead letter queue.", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadletterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const sequenceNumber = await deferMsgAndGetSequenceNum(receiverClient);

      const deferredMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }
      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.deadLetter();

      await testPeekMsgsLength(receiverClient, 0);

      const deadLetterMsgs = await deadletterClient.receiveBatch(1);

      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].complete();

      await testPeekMsgsLength(deadletterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  it("Deferring a deferred message puts it back to the deferred queue.", async function(): Promise<
    void
  > {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const sequenceNumber = await deferMsgAndGetSequenceNum(receiverClient);

      let deferredMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }

      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.deliveryCount, 1);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.defer();

      await testPeekMsgsLength(receiverClient, 1);

      deferredMsgs = await receiverClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }

      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.deliveryCount, 2);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.complete();

      await testPeekMsgsLength(receiverClient, 0);
    };

    await test(queueClient, queueClient);
    await test(topicClient, subscriptionClient);
  });

  it("Abandon a message received from dead letter queue", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadletterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].deliveryCount, 0);
      should.equal(receivedMsgs[0].body, testMessages[0].body);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].deadLetter();

      await testPeekMsgsLength(subscriptionClient, 0);

      const deadLetterMsgs = await deadletterClient.receiveBatch(1);

      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].deliveryCount, 0);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].abandon();

      const abandonedMsgs = await deadletterClient.receiveBatch(1);

      should.equal(abandonedMsgs.length, 1);
      should.equal(abandonedMsgs[0].body, testMessages[0].body);
      should.equal(abandonedMsgs[0].deliveryCount, 0);
      should.equal(abandonedMsgs[0].messageId, testMessages[0].messageId);

      await abandonedMsgs[0].complete();

      await testPeekMsgsLength(deadletterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  it("Defer a message received from dead letter queue", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadletterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body, testMessages[0].body);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].deadLetter();

      await testPeekMsgsLength(receiverClient, 0);

      const deadLetterMsgs = await deadletterQueueClient.receiveBatch(1);

      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      if (!deadLetterMsgs[0].sequenceNumber) {
        throw "Sequence Number can not be null";
      }
      const sequenceNumber = deadLetterMsgs[0].sequenceNumber;
      await deadLetterMsgs[0].defer();

      const deferredMsgs = await deadletterClient.receiveDeferredMessage(sequenceNumber);
      if (!deferredMsgs) {
        throw "No message received for sequence number";
      }
      should.equal(deferredMsgs.body, testMessages[0].body);
      should.equal(deferredMsgs.messageId, testMessages[0].messageId);

      await deferredMsgs.complete();

      await testPeekMsgsLength(queueClient, 0);

      await testPeekMsgsLength(deadletterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  const testError = (err: Error) => {
    should.equal(err.name, "InvalidOperationError");
    errorWasThrown = true;
  };

  it("Dead letter a message received from dead letter queue", async function(): Promise<void> {
    const test = async function(
      senderClient: QueueClient | TopicClient,
      receiverClient: QueueClient | SubscriptionClient,
      deadletterClient: QueueClient | SubscriptionClient
    ): Promise<void> {
      await senderClient.send(testMessages[0]);
      const receivedMsgs = await receiverClient.receiveBatch(1);

      should.equal(receivedMsgs.length, 1);
      should.equal(receivedMsgs[0].body, testMessages[0].body);
      should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

      await receivedMsgs[0].deadLetter();

      await testPeekMsgsLength(receiverClient, 0);
      let deadLetterMsgs = await deadletterClient.receiveBatch(1);

      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].deadLetter().catch((err) => testError(err));

      should.equal(errorWasThrown, true);

      deadLetterMsgs = await deadletterClient.receiveBatch(1);

      should.equal(deadLetterMsgs.length, 1);
      should.equal(deadLetterMsgs[0].body, testMessages[0].body);
      should.equal(deadLetterMsgs[0].messageId, testMessages[0].messageId);

      await deadLetterMsgs[0].complete();
      await testPeekMsgsLength(deadletterClient, 0);
    };

    await test(queueClient, queueClient, deadletterQueueClient);
    await test(topicClient, subscriptionClient, deadletterSubscriptionClient);
  });

  it("Throws error when call the second ReceiveBatch while the first one is not done", async function(): Promise<
    void
  > {
    const test = async function(receiverClient: QueueClient | SubscriptionClient): Promise<void> {
      const firstBatchPromise = receiverClient.receiveBatch(1, 10);
      await delay(5000);
      const secondBatchPromise = receiverClient.receiveBatch(1, 10).catch((err) => {
        should.equal(err.name, "Error");
        errorWasThrown = true;
      });
      await Promise.all([firstBatchPromise, secondBatchPromise]);
      should.equal(errorWasThrown, true);
    };

    await test(queueClient);
    await test(subscriptionClient);
  });

  it("Throws error when call the second ReceiveBatch while the first one is not done", async function(): Promise<
    void
  > {
    const firstBatchPromise = queueClient.receiveBatch(1, 10);
    await delay(5000);
    const secondBatchPromise = queueClient.receiveBatch(1, 10).catch((err) => {
      should.equal(err.name, "Error");
      errorWasThrown = true;
    });
    await Promise.all([firstBatchPromise, secondBatchPromise]);
    should.equal(errorWasThrown, true);
  });
});
