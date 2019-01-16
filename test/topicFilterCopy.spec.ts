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
  SubscriptionClient,
  SendableMessageInfo,
  TopicClient,
  ServiceBusMessage,
  delay
} from "../lib";

// We need to remove rules before adding one because otherwise the existing default rule will let in all messages.
async function removeAllRules(client: SubscriptionClient): Promise<void> {
  const rules = await client.getRules();
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    await client.removeRule(rule.name);
  }
}

async function testPeekMsgsLength(
  client: SubscriptionClient,
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
let topicClient: TopicClient;
let subscriptionClient: SubscriptionClient;
let defaultSubscriptionClient: SubscriptionClient;

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
  if (!process.env.SUBSCRIPTION_NAME) {
    throw new Error(
      "Define SUBSCRIPTION_NAME in your environment before running integration tests."
    );
  }
  if (!process.env.DEFAULT_SUBSCRIPTION_NAME) {
    throw new Error(
      "Define DEFAULT_SUBSCRIPTION_NAME in your environment before running integration tests."
    );
  }

  namespace = Namespace.createFromConnectionString(process.env.SERVICEBUS_CONNECTION_STRING);
  topicClient = namespace.createTopicClient(process.env.TOPIC_NAME);
  subscriptionClient = namespace.createSubscriptionClient(
    process.env.TOPIC_NAME,
    process.env.SUBSCRIPTION_NAME
  );
  defaultSubscriptionClient = namespace.createSubscriptionClient(
    process.env.TOPIC_NAME,
    process.env.DEFAULT_SUBSCRIPTION_NAME
  );
  await removeAllRules(subscriptionClient);
}

async function afterEachTest(): Promise<void> {
  await namespace.close();
}

async function sendOrder(order: any): Promise<void> {
  const message: SendableMessageInfo = {
    body: "",
    correlationId: order.Priority,
    label: order.Color,
    userProperties: {
      color: order.Color,
      quantity: order.Quantity,
      priority: order.Priority
    }
  };

  await topicClient.send(message);
}

async function sendOrders(): Promise<void> {
  const promises = new Array();

  // Now we can start sending orders.
  promises.push(sendOrder({ Color: "blue", Quantity: 5, Priority: "low" }));
  promises.push(sendOrder({ Color: "red", Quantity: 10, Priority: "high" }));
  promises.push(sendOrder({ Color: "yellow", Quantity: 5, Priority: "low" }));
  promises.push(sendOrder({ Color: "blue", Quantity: 10, Priority: "low" }));
  promises.push(sendOrder({ Color: "blue", Quantity: 5, Priority: "high" }));
  promises.push(sendOrder({ Color: "blue", Quantity: 10, Priority: "low" }));
  promises.push(sendOrder({ Color: "red", Quantity: 5, Priority: "low" }));
  promises.push(sendOrder({ Color: "red", Quantity: 10, Priority: "low" }));
  promises.push(sendOrder({ Color: "red", Quantity: 5, Priority: "low" }));
  promises.push(sendOrder({ Color: "yellow", Quantity: 10, Priority: "high" }));
  promises.push(sendOrder({ Color: "yellow", Quantity: 5, Priority: "low" }));
  promises.push(sendOrder({ Color: "yellow", Quantity: 10, Priority: "low" }));

  // wait until all the send tasks are complete
  await Promise.all(promises);
}

async function receiveOrders(client: SubscriptionClient): Promise<ServiceBusMessage[]> {
  const receivedMsgs: ServiceBusMessage[] = [];
  const receiveListener = client.receive(
    (msg: ServiceBusMessage) => {
      receivedMsgs.push(msg);
      return Promise.resolve();
    },
    (err: Error) => {
      should.not.exist(err);
    }
  );

  await delay(3000);
  await receiveListener.stop();

  return receivedMsgs;
}

describe("Boolean filters", function(): void {
  beforeEach(async () => {
    await beforeEachTest();
  });

  afterEach(async () => {
    await afterEachTest();
  });

  async function addFiletterAndReceiveOrders(
    bool: boolean,
    client: SubscriptionClient
  ): Promise<ServiceBusMessage[]> {
    await subscriptionClient.addRule("BooleanFilter", bool);
    const rules = await subscriptionClient.getRules();
    should.equal(rules.length, 1);
    should.equal(rules[0].name, "BooleanFilter");

    await sendOrders();
    const receivedMsgs = await receiveOrders(client);

    return receivedMsgs;
  }

  it("Subscription with default filter receives all messages", async function(): Promise<void> {
    const receivedMsgs = await addFiletterAndReceiveOrders(false, defaultSubscriptionClient);

    should.equal(Array.isArray(receivedMsgs), true);
    should.equal(receivedMsgs.length, 12);

    await testPeekMsgsLength(defaultSubscriptionClient, 0);
  });

  it("Subscription with false boolean filter does not receive any messages", async function(): Promise<
    void
  > {
    const receivedMsgs = await addFiletterAndReceiveOrders(false, subscriptionClient);

    should.equal(Array.isArray(receivedMsgs), true);
    should.equal(receivedMsgs.length, 0);

    await testPeekMsgsLength(subscriptionClient, 0);

    await receiveOrders(defaultSubscriptionClient);
    await testPeekMsgsLength(defaultSubscriptionClient, 0);
  });
});
