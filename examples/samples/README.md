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
- Copy the "Primary Connection String" of RootManageSharedAccessKey at **Shared access policies** under **Settings** tab.
- To work with Queues, create a queue right under "Entities" at <your-servicebus-namespace> and copy the name of the Queue.
- To work with Topics, create a topic right under "Entities" and subscriptions for the topic and copy the names.
- > _Note : RootManageSharedAccessKey is automatically created for the namespace and has permissions for the entire namespace. If you want to use restricted access, refer [Shared Access Signatures](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-sas), create the Access Keys exclusive to the specific created Queue/Topic._
* Example : [Refer this example](https://github.com/Azure/azure-service-bus-node/blob/99b6bff5566f3f8499c8f38a97c7e9f37471cc55/examples/samples/queuesGettingStarted.ts#L14) and update the following lines.
```typescript
const str = process.env.SERVICEBUS_CONNECTION_STRING || <Primary-Connection-String>;
const path = process.env.QUEUE_NAME || <Name-of-the-Queue>;
```

## Executing a sample
- As you've already installed ts-node, you should be able to execute the typescript samples as follows:
```bash
cd examples\samples
ts-node <sample>.ts
```
