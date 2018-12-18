## Getting started with samples ##

## Building the library
- Clone the repo and cd to the repo directory
```
git clone https://github.com/azure/azure-service-bus-node.git
cd azure-service-bus-node
```
- Install typescript, ts-node globally (optional, but very useful)
```
npm i -g typescript
npm i -g ts-node
```
- NPM install from the root of the package
```
npm i
```
- Build the project
```
npm run build
```

## Before executing a sample
- Go to the Azure Portal(https://portal.azure.com)
- Here are the docs which would help you create a service bus resource in the portal : https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-nodejs-how-to-use-queues
```
Go to Dashboard > Service Bus > <your-servicebus-namespace> 
```
- If you'd like to work with Queues, find the "Queues" tab right under "Entities" at <your-servicebus-namespace> and create a Queue.
- Go to the Shared access policies under settings tab and add a new one. 
- Copy the "Primary Connection String" and the "Name of the Queue" and use them below
```
Example : (https://github.com/Azure/azure-service-bus-node/blob/99b6bff5566f3f8499c8f38a97c7e9f37471cc55/examples/samples/queuesGettingStarted.ts#L14).
const str = process.env.SERVICEBUS_CONNECTION_STRING || <Primary-Connection-String>;
const path = process.env.QUEUE_NAME || <Name-of-the-Queue>;
```

## Executing a sample
- As you've already installed ts-node, you should be able to execute the typescript samples as follows:
```
cd examples\samples
ts-node <sample>.ts
```