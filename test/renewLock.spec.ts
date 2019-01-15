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
import { delay } from "rhea-promise";

const testMessages: SendableMessageInfo[] = [
  {
    body: "hello-world-1",
    messageId: generateUuid()
  }
];

const lockDurationInMilliseconds = 30000;

describe("Lock Renewal in PeekLock mode", function(): void {
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

  // Tests for Lock Renewal, see -  https://github.com/Azure/azure-service-bus-node/issues/103
  // Receive a msg using Batch Receiver, test renewLock()
  it("Queues - Receives a message using Batch Receiver renewLock() resets lock duration each time.", async function(): Promise<
    void
  > {
    await testLockRenewalHappyCase(queueClient, queueClient);
  });

  it("TopicsSubs - Receives a message using Batch Receiver renewLock() resets lock duration each time.", async function(): Promise<
    void
  > {
    await testLockRenewalHappyCase(topicClient, subscriptionClient);
  });

  // Receive a msg using Batch Receiver, wait until its lock expires, completing it now results in error
  it("Queues - Receive a msg using Batch Receiver, wait until its lock expires, completing it now results in error", async function(): Promise<
    void
  > {
    await testErrorOnLockExpiry(queueClient, queueClient);
  });

  it("TopicsSubs - Receive a msg using Batch Receiver, wait until its lock expires, completing it now results in error", async function(): Promise<
    void
  > {
    await testErrorOnLockExpiry(topicClient, subscriptionClient);
  });
});

async function testLockRenewalHappyCase(
  senderClient: QueueClient | TopicClient,
  receiverClient: QueueClient | SubscriptionClient
): Promise<void> {
  const currentExpectedLockExpiryTimeUtc = new Date();

  await senderClient.sendBatch(testMessages);

  const msgs = await receiverClient.receiveBatch(1);

  should.equal(Array.isArray(msgs), true);
  should.equal(msgs.length, 1);
  should.equal(msgs[0].body, testMessages[0].body);
  should.equal(msgs[0].messageId, testMessages[0].messageId);

  console.log(`MessageLockedUntil: ${msgs[0].lockedUntilUtc}`);

  // Compute expected initial lock duration
  currentExpectedLockExpiryTimeUtc.setSeconds(
    currentExpectedLockExpiryTimeUtc.getSeconds() + lockDurationInMilliseconds / 1000
  );

  // Verify actual lock duration is reset
  if (msgs[0].lockedUntilUtc) {
    should.equal(msgs[0].lockedUntilUtc >= currentExpectedLockExpiryTimeUtc, true);
  }

  console.log(`Sleeping 10 seconds...`);
  await delay(10000);

  await receiverClient.renewLock(msgs[0]);
  console.log(`After First Renewal: ${msgs[0].lockedUntilUtc}`);
  // Compute expected lock duration after 10 seconds of sleep
  currentExpectedLockExpiryTimeUtc.setSeconds(currentExpectedLockExpiryTimeUtc.getSeconds() + 10);

  // Verify actual lock duration is reset
  if (msgs[0].lockedUntilUtc) {
    should.equal(msgs[0].lockedUntilUtc >= currentExpectedLockExpiryTimeUtc, true);
  }

  console.log(`Sleeping 5 more seconds...`);
  await delay(5000);

  await receiverClient.renewLock(msgs[0]);
  console.log(`After Second Renewal: ${msgs[0].lockedUntilUtc}`);
  // Compute expected lock duration after 5 more seconds of sleep
  currentExpectedLockExpiryTimeUtc.setSeconds(currentExpectedLockExpiryTimeUtc.getSeconds() + 5);

  // Verify actual lock duration is reset
  if (msgs[0].lockedUntilUtc) {
    should.equal(msgs[0].lockedUntilUtc >= currentExpectedLockExpiryTimeUtc, true);
  }

  await msgs[0].complete();
}

async function testErrorOnLockExpiry(
  senderClient: QueueClient | TopicClient,
  receiverClient: QueueClient | SubscriptionClient
): Promise<void> {
  await senderClient.sendBatch(testMessages);

  const msgs = await receiverClient.receiveBatch(1);

  should.equal(Array.isArray(msgs), true);
  should.equal(msgs.length, 1);
  should.equal(msgs[0].body, testMessages[0].body);
  should.equal(msgs[0].messageId, testMessages[0].messageId);

  console.log(`MessageLockedUntil: ${msgs[0].lockedUntilUtc}`);

  console.log(`Sleeping 30 seconds...`);
  await delay(lockDurationInMilliseconds);

  let errorWasThrown: boolean = false;
  await msgs[0].complete().catch((err) => {
    should.equal(err.name, "MessageLockLostError");
    errorWasThrown = true;
  });

  should.equal(errorWasThrown, true);

  // Clean up any left over messages
  const unprocessedMsgs = await receiverClient.receiveBatch(1);
  await unprocessedMsgs[0].complete();
}
