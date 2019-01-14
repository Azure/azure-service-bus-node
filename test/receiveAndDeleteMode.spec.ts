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
  delay,
  ServiceBusMessage,
  ReceiveMode
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
  should.equal(
    peekedMsgs.length,
    expectedPeekLength,
    "Unexpected number of msgs found when peeking"
  );
}

let namespace: Namespace;
let queueClient: QueueClient;
let topicClient: TopicClient;
let subscriptionClient: SubscriptionClient;

let errorWasThrown: boolean;

async function beforeEachTest(): Promise<void> {
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
  queueClient = namespace.createQueueClient(process.env.QUEUE_NAME, {
    receiveMode: ReceiveMode.receiveAndDelete
  });
  topicClient = namespace.createTopicClient(process.env.TOPIC_NAME);
  subscriptionClient = namespace.createSubscriptionClient(
    process.env.TOPIC_NAME,
    process.env.SUBSCRIPTION_NAME,
    {
      receiveMode: ReceiveMode.receiveAndDelete
    }
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
}

async function afterEachTest(): Promise<void> {
  await namespace.close();
}

describe("ReceiveBatch from Queue/Subscription", () => {
  beforeEach(async () => {
    await beforeEachTest();
  });

  afterEach(async () => {
    await afterEachTest();
  });

  async function sendReceiveMsg(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await senderClient.send(testMessages[0]);
    const msgs = await receiverClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);
    should.equal(msgs[0].deliveryCount, 0);
  }

  async function testNosettlment(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await sendReceiveMsg(senderClient, receiverClient);
    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: No settlement of the message removes message", async function(): Promise<void> {
    await testNosettlment(queueClient, queueClient);
  });

  it("Subscription: No settlement of the message removes message", async function(): Promise<void> {
    await testNosettlment(topicClient, subscriptionClient);
  });
});

describe("Streaming Receiver from Queue/Subscription", function(): void {
  beforeEach(async () => {
    await beforeEachTest();
  });

  afterEach(async () => {
    await afterEachTest();
  });

  async function sendReceiveMsg(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient,
    autoCompleteFlag: boolean
  ): Promise<void> {
    await senderClient.send(testMessages[0]);
    const receivedMsgs: ServiceBusMessage[] = [];
    const receiveListener = receiverClient.receive(
      (msg: ServiceBusMessage) => {
        receivedMsgs.push(msg);
        return Promise.resolve();
      },
      (err: Error) => {
        should.not.exist(err);
      },
      { autoComplete: autoCompleteFlag }
    );

    await delay(2000);

    should.equal(receivedMsgs.length, 1);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);

    await receiveListener.stop();
  }

  async function testWithAutoCompleteEnabled(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await sendReceiveMsg(senderClient, receiverClient, true);
    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: With auto-complete enabled, no settlement of the message removes message", async function(): Promise<
    void
  > {
    await testWithAutoCompleteEnabled(queueClient, queueClient);
  });

  it("Subscription: With auto-complete enabled, no settlement of the message removes message", async function(): Promise<
    void
  > {
    await testWithAutoCompleteEnabled(topicClient, subscriptionClient);
  });

  async function testWithAutoCompleteDisabled(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await sendReceiveMsg(senderClient, receiverClient, false);
    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: With auto-complete disabled, no settlement of the message removes message", async function(): Promise<
    void
  > {
    await testWithAutoCompleteDisabled(queueClient, queueClient);
  });

  it("Subscription: With auto-complete disabled, no settlement of the message removes message", async function(): Promise<
    void
  > {
    await testWithAutoCompleteDisabled(topicClient, subscriptionClient);
  });
});

describe("Throws error when Complete/Abandon/Defer/Deadletter/RenewLock of normal message", () => {
  beforeEach(async () => {
    await beforeEachTest();
  });

  afterEach(async () => {
    await afterEachTest();
  });

  async function sendReceiveMsg(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<ServiceBusMessage> {
    await senderClient.send(testMessages[0]);
    const msgs = await receiverClient.receiveBatch(1);

    should.equal(Array.isArray(msgs), true);
    should.equal(msgs.length, 1);
    should.equal(msgs[0].body, testMessages[0].body);
    should.equal(msgs[0].messageId, testMessages[0].messageId);
    should.equal(msgs[0].deliveryCount, 0);

    return msgs[0];
  }

  async function testComplete(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    const msg = await sendReceiveMsg(senderClient, receiverClient);
    await msg.complete().catch((err) => {
      should.equal(err.message, "The operation is only supported in 'PeekLock' receive mode.");
      errorWasThrown = true;
    });

    should.equal(errorWasThrown, true);

    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: complete() throws error", async function(): Promise<void> {
    await testComplete(queueClient, queueClient);
  });

  it("Subscription: complete() throws error", async function(): Promise<void> {
    await testComplete(topicClient, subscriptionClient);
  });

  async function testAbandon(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    const msg = await sendReceiveMsg(senderClient, receiverClient);
    await msg.abandon().catch((err) => {
      should.equal(err.message, "The operation is only supported in 'PeekLock' receive mode.");
      errorWasThrown = true;
    });

    should.equal(errorWasThrown, true);

    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: Abandoned message throws error", async function(): Promise<void> {
    await testAbandon(queueClient, queueClient);
  });

  it("Subscription: Abandoned message throws error", async function(): Promise<void> {
    await testAbandon(topicClient, subscriptionClient);
  });

  async function testDefer(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    const msg = await sendReceiveMsg(senderClient, receiverClient);
    await msg.defer().catch((err) => {
      should.equal(err.message, "The operation is only supported in 'PeekLock' receive mode.");
      errorWasThrown = true;
    });

    should.equal(errorWasThrown, true);

    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: Deferred message throws error", async function(): Promise<void> {
    await testDefer(queueClient, queueClient);
  });

  it("Subscription: Deferred message throws error", async function(): Promise<void> {
    await testDefer(topicClient, subscriptionClient);
  });

  async function testDeadletter(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    const msg = await sendReceiveMsg(senderClient, receiverClient);
    await msg.deadLetter().catch((err) => {
      should.equal(err.message, "The operation is only supported in 'PeekLock' receive mode.");
      errorWasThrown = true;
    });

    should.equal(errorWasThrown, true);

    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: Dead lettered message throws error", async function(): Promise<void> {
    await testDeadletter(queueClient, queueClient);
  });

  it("Subscription: Dead lettered message throws error", async function(): Promise<void> {
    await testDeadletter(topicClient, subscriptionClient);
  });

  async function sendReceiveMsgWithRenewLock(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await senderClient.sendBatch(testMessages);
    const receivedMsgs: ServiceBusMessage[] = [];
    const receiveListener = receiverClient.receive(
      (msg: ServiceBusMessage) => {
        receivedMsgs.push(msg);
        receiverClient.renewLock(msg).catch((err) => {
          should.equal(err.message, "The operation is only supported in 'PeekLock' receive mode.");
          errorWasThrown = true;
        });
        should.equal(errorWasThrown, true);
        return Promise.resolve();
      },
      (err: Error) => {
        should.not.exist(err);
      }
    );

    await delay(10000);
    should.equal(errorWasThrown, true);
    should.equal(receivedMsgs.length, 2);
    should.equal(receivedMsgs[0].body, testMessages[0].body);
    should.equal(receivedMsgs[0].messageId, testMessages[0].messageId);
    should.equal(receivedMsgs[1].body, testMessages[1].body);
    should.equal(receivedMsgs[1].messageId, testMessages[1].messageId);

    await receiveListener.stop();
  }

  async function testRenewLock(
    senderClient: QueueClient | TopicClient,
    receiverClient: QueueClient | SubscriptionClient
  ): Promise<void> {
    await sendReceiveMsgWithRenewLock(senderClient, receiverClient);
    await testPeekMsgsLength(receiverClient, 0);
  }

  it("Queue: Renew message lock throws error", async function(): Promise<void> {
    await testRenewLock(queueClient, queueClient);
  });

  it("Subscription: Renew message lock throws error", async function(): Promise<void> {
    await testRenewLock(topicClient, subscriptionClient);
  });
});
