import { Namespace, SubscriptionClient } from "../../lib";
import * as dotenv from "dotenv";
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const topic = process.env.TOPIC_NAME || "";
const subscription_with_sql_filter = "with-sql-filter";
const subscription_with_correlation_filter = "with-correlation-filter";

let ns: Namespace;
let client: SubscriptionClient;
const yellowSqlRule = {
  name: "YellowSqlRule",
  expression: "Color = 'Yellow'"
};
const correlationRule = {
  name: "CorrelationRule",
  filter: { label: "Blue Message" }
}

async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);

  client = ns.createSubscriptionClient(topic, subscription_with_sql_filter);
  await removeAllRules(client);
  await client.addSQLRule(yellowSqlRule.name, yellowSqlRule.expression);
  await testAddedRule(client, yellowSqlRule.name);
  await client.close();

  client = ns.createSubscriptionClient(topic, subscription_with_correlation_filter);
  await removeAllRules(client);
  await client.addCorrelationRule(correlationRule.name, correlationRule.filter);
  await testAddedRule(client, correlationRule.name);
  await client.close();
}

async function removeAllRules(client: SubscriptionClient): Promise<boolean> {
  let rules = await client.getRules();
  console.log(`${rules.length} rules found for ${client.name}`);

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    console.log(`Rule Name: ${rule.name}`);
    console.log(`Filter: ${JSON.stringify(rule.filter)}`);
    if (rule.action) {
      console.log(`Action: ${JSON.stringify(rule.action)}`);
    }
    await client.removeRule(rule.name);
  }

  rules = await client.getRules();
  if (rules.length) {
    console.log(`Failed to remove all rules from ${client.name}`);
    return false;
  } else {
    console.log(`All rules removed from ${client.name}`);
  }

  return true;
}

async function testAddedRule(client: SubscriptionClient, ruleName: string): Promise<boolean> {
  let rules = await client.getRules();
  if (rules.find((rule) => rule.name === ruleName)) {
    console.log(`Rule ${ruleName} has been added`);
  } else {
    console.log(`Nooooo.... Where is the ${ruleName} rule??`);
    return false;
  }

  return true;
}

main().then(() => {
  console.log(">>>> Calling close....");
  return ns.close();
}).catch((err) => {
  console.log("error: ", err);
  return ns.close();
});
