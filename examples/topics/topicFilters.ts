import { Namespace } from "../../lib";
import * as dotenv from "dotenv";
import { CorrelationFilter } from '../../lib/core/managementClient';
dotenv.config();

const str = process.env.SERVICEBUS_CONNECTION_STRING || "";
const topic = process.env.TOPIC_NAME || "";
const subscription = process.env.SUBSCRIPTION_NAME || "";

let ns: Namespace;
async function main(): Promise<void> {
  ns = Namespace.createFromConnectionString(str);
  const client = ns.createSubscriptionClient(topic, subscription);

  let rules = await client.getRules();
  console.log(`${rules.length} rules found for ${client.name}`);

  rules.forEach((rule) => {
    console.log(`Rule Name: ${rule.name}`);
    console.log(`Filter: ${JSON.stringify(rule.filter)}`);
    if (rule.action) {
      console.log(`Action: ${JSON.stringify(rule.action)}`);
    }
  });

  if (rules.find((rule) => rule.name === 'YellowSqlRule')) {
    await client.removeRule('YellowSqlRule');
    rules = await client.getRules();
    if (rules.find((rule) => rule.name === 'YellowSqlRule')) {
      console.log('Nooooo.... YellowSqlRule should have been removed');
      return;
    } else {
      console.log('Rule YellowSqlRule has been removed');
    }
  }

  await client.addSQLRule('YellowSqlRule', "Color = 'Yellow'");
  rules = await client.getRules();
  if (rules.find((rule) => rule.name === 'YellowSqlRule')) {
    console.log('Rule YellowSqlRule has been added');
  } else {
    console.log('Nooooo.... Where is the YellowSqlRule rule??');
    return;
  }

  if (rules.find((rule) => rule.name === 'ComplicatedRule')) {
    await client.removeRule('ComplicatedRule');
    rules = await client.getRules();
    if (rules.find((rule) => rule.name === 'ComplicatedRule')) {
      console.log('Nooooo.... ComplicatedRule should have been removed');
      return;
    } else {
      console.log('Rule ComplicatedRule has been removed');
    }
  }

  await client.addCorrelationRule('ComplicatedRule', { "correlationId": "some-id", "label": "Blue" });
  rules = await client.getRules();
  if (rules.find((rule) => rule.name === 'ComplicatedRule' && (<CorrelationFilter>rule.filter).correlationId === 'some-id' && (<CorrelationFilter>rule.filter).label === 'Blue')) {
    console.log('Rule ComplicatedRule has been added');
  } else {
    console.log('Nooooo.... Where is the ComplicatedRule rule??');
    return;
  }

}

main().then(() => {
  console.log(">>>> Calling close....");
  return ns.close();
}).catch((err) => {
  console.log("error: ", err);
  return ns.close();
});
