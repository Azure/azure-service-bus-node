## Getting started with samples ##

## Building the library
- Clone the repo and cd to the repo directory
```bash
git clone https://github.com/azure/azure-service-bus-node.git
cd azure-service-bus-node
```
- Install typescript, ts-node globally (optional, but very useful)
```bash
npm i -g typescript
npm i -g ts-node
```
- NPM install from the root of the package
```bash
npm i
```
- Build the project
```bash
npm run build
```

## Before executing a sample
- Go to the [Azure Portal](https://portal.azure.com).
- Here are the docs which would help you create a service bus resource in the portal : [ServiceBus - NodeJS DOCS](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-nodejs-how-to-use-queues).
- In the portal, go to **Dashboard > Service Bus > _your-servicebus-namespace_**.
- Copy the "Primary Connection String" of **RootManageSharedAccessKey** at **Shared access policies** under **Settings** tab.
- To work with Queues, find the "Queues" tab right under "Entities" at **_your-servicebus-namespace_** and create a Queue and copy its name for next steps.
- To work with Topics, find the "Topics" tab right under "Entities" at **_your-servicebus-namespace_**, create a Topic. Go to **_your-servicebus-namespace_ > _your-topic_**, create subscriptions for the topic and note down their names for the next step.
> _Note : **RootManageSharedAccessKey** is automatically created for the namespace and has permissions for the entire namespace. If you want to use restricted access, refer [Shared Access Signatures](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-sas), create the Access Keys exclusive to the specific created Queue/Topic._

Create a `.env` file in the `examples/samples` folder with the following contents. Replace the `<string>` with your corresponding values.
```typescript
SERVICEBUS_CONNECTION_STRING=<Primary-Connection-String>
QUEUE_NAME=<Name-of-the-Queue>
TOPIC_NAME=<Name-of-the-Topic>
SUBSCRIPTION_NAME1=<Subscription-1>
SUBSCRIPTION_NAME2=<Subscription-2>
SUBSCRIPTION_NAME3=<Subscription-3>
```
> _Example: [**dotenv.config();**](https://github.com/Azure/azure-service-bus-node/blob/99b6bff5566f3f8499c8f38a97c7e9f37471cc55/examples/samples/queuesGettingStarted.ts#L12) call in the sample loads the strings in `.env` into `process.env`._

## Executing a sample
- If you've already installed ts-node, you should be able to execute the typescript samples as follows:
```bash
cd examples\samples
ts-node <sample>.ts
```
- Otherwise, execute them in the following manner:
```bash
cd examples\samples
tsc <sample>.ts
node <sample>.js
```