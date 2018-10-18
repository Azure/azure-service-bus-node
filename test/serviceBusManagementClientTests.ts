import { SasTokenProvider, TokenInfo } from "@azure/amqp-common";
import * as assert from "assert";
import * as fs from "fs";
import { HttpHeaders, HttpOperationResponse, ServiceClientCredentials, TokenCredentials, WebResource } from "ms-rest-js";
import * as path from "path";
import { QueueGetResponse } from "../lib/management/models";
import { ServiceBusManagementClient } from "../lib/management/serviceBusManagementClient";
import * as msAssert from "./msAssert";

const useFakeResponsesString: string | undefined = process.env["USE_FAKE_RESPONSES"];
const useFakeResponses: boolean = (useFakeResponsesString && useFakeResponsesString.toLowerCase() === "true") || false;

class SasTokenCredentials implements ServiceClientCredentials {
  constructor(private sasTokenProvider: SasTokenProvider) {
  }

  signRequest(webResource: WebResource): Promise<WebResource> {
    return this.sasTokenProvider.getToken(webResource.url)
      .then((token: TokenInfo) => {
        webResource.headers.set("Authorization", token.token);
        return webResource;
      });
  }

  static fromConnectionString(connectionString: string): SasTokenCredentials {
    const sasTokenProvider: SasTokenProvider = SasTokenProvider.fromConnectionString(connectionString);

    return new SasTokenCredentials(sasTokenProvider);
  }
}

function getClient(fakeResponseCreator: (request: WebResource) => HttpOperationResponse): ServiceBusManagementClient {
  let client: ServiceBusManagementClient;
  if (useFakeResponses) {
    const credentials = new TokenCredentials("Fake Credentials");
    client = new ServiceBusManagementClient(credentials, {
      httpClient: {
        sendRequest(httpRequest: WebResource): Promise<HttpOperationResponse> {
          return Promise.resolve(fakeResponseCreator(httpRequest));
        }
      }
    });
  } else {
    const connectionStringFilePath: string = path.resolve("./sbauth.env");
    const connectionStringText: string = fs.readFileSync(connectionStringFilePath, { encoding: "utf8" });
    const credentials: ServiceClientCredentials = SasTokenCredentials.fromConnectionString(connectionStringText);
    client = new ServiceBusManagementClient(credentials);
  }
  return client;
}

describe("ServiceBusManagementClient", function () {
  describe("queue", function () {
    describe("get()", function () {
      it("when namespaceName doesn't exist", async function () {
        const namespaceName = "nonExistingNamespace";
        const queuePath = "nonExistingTestQueuePath";

        const client = getClient((request: WebResource) => { throw new Error(`getaddrinfo ENOTFOUND nonexistingnamespace.servicebus.windows.net nonexistingnamespace.servicebus.windows.net:443`); });

        const error: Error = await msAssert.throwsAsync(client.queue.get(namespaceName, queuePath));
        assert.strictEqual(error.name, "Error");
        assert.strictEqual(error.message, "getaddrinfo ENOTFOUND nonexistingnamespace.servicebus.windows.net nonexistingnamespace.servicebus.windows.net:443");
      });

      it("when queuePath doesn't exist", async function () {
        const namespaceName = "daschulttest1";
        const queuePath = "nonExistingTestQueuePath";

        const client: ServiceBusManagementClient = getClient((httpRequest: WebResource) => {
          return {
            request: httpRequest,
            status: 200,
            headers: new HttpHeaders({
              "Content-Type": "application/atom+xml;type=feed;charset=utf-8",
              "Server": "Microsoft-HTTPAPI/2.0",
              "Strict-Transport-Security": "max-age=31536000",
              "Date": "Wed, 17 Oct 2018 21:56:16 GMT",
              "Content-Length": "335"
            }),
            bodyAsText:
              `
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Publicly Listed Services</title>
  <subtitle type="text">This is the list of publicly-listed services currently available.</subtitle>
  <id>uuid:a53ad534-d68f-4abe-87a1-3dac57135b1c;id=425328</id>
  <updated>2018-10-17T21:56:16Z</updated>
  <generator>Service Bus 1.1</generator>
</feed>
`.trim()
          };
        });

        const response: QueueGetResponse = await client.queue.get(namespaceName, queuePath);

        const request: WebResource = response._response.request;
        assert.deepEqual(request.url, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorect request URL");
        assert.deepEqual(request.method, "GET");
        assert.deepEqual(request.body, undefined);
        assert.deepEqual(request.query, undefined);

        const requestHeaders: HttpHeaders = request.headers;
        const authorizationHeader: string | undefined = requestHeaders.get("Authorization");
        assert(authorizationHeader);

        assert(response.id);
        assert.strictEqual(response.title, "Publicly Listed Services");
        assert.strictEqual((response as any)["subtitle"], undefined);
        assert(!response.published);
        assert(response.updated);
        assert.strictEqual((response as any)["generator"], undefined);

        assert.strictEqual(response.author, undefined);
        assert.strictEqual(response.link, undefined);
        assert.strictEqual(response.content, undefined);
      });

      it("when queue exists", async function () {
        const namespaceName = "daschulttest1";
        const queuePath = "testQueuePath";

        const client = getClient((request: WebResource) => {
          return {
            request: request,
            status: 200,
            headers: new HttpHeaders({
              "Content-Type": "application/atom+xml;type=feed;charset=utf-8",
              "Server": "Microsoft-HTTPAPI/2.0",
              "Strict-Transport-Security": "max-age=31536000",
              "Date": "Wed, 17 Oct 2018 21:56:16 GMT",
              "Content-Length": "335"
            }),
            bodyAsText:
              `
<entry xmlns="http://www.w3.org/2005/Atom">
  <id>https://${namespaceName}.servicebus.windows.net/testQueuePath/?api-version=2017-04&amp;enrich=False</id>
  <title type="text">testQueuePath</title>
  <published>2018-10-09T19:56:34Z</published>
  <updated>2018-10-09T19:56:35Z</updated>
  <author>
    <name>${namespaceName}</name>
  </author>
  <link rel="self" href="https://${namespaceName}.servicebus.windows.net/testQueuePath/?api-version=2017-04&amp;enrich=False"/>
  <content type="application/xml">
    <QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
      <LockDuration>PT1M</LockDuration>
      <MaxSizeInMegabytes>1024</MaxSizeInMegabytes>
      <RequiresDuplicateDetection>false</RequiresDuplicateDetection>
      <RequiresSession>false</RequiresSession>
      <DefaultMessageTimeToLive>P14D</DefaultMessageTimeToLive>
      <DeadLetteringOnMessageExpiration>false</DeadLetteringOnMessageExpiration>
      <DuplicateDetectionHistoryTimeWindow>PT10M</DuplicateDetectionHistoryTimeWindow>
      <MaxDeliveryCount>10</MaxDeliveryCount>
      <EnableBatchedOperations>true</EnableBatchedOperations>
      <SizeInBytes>0</SizeInBytes>
      <MessageCount>0</MessageCount>
      <IsAnonymousAccessible>false</IsAnonymousAccessible>
      <AuthorizationRules/>
      <Status>Active</Status>
      <CreatedAt>2018-10-09T19:56:34.903Z</CreatedAt>
      <UpdatedAt>2018-10-09T19:56:35.013Z</UpdatedAt>
      <AccessedAt>0001-01-01T00:00:00Z</AccessedAt>
      <SupportOrdering>true</SupportOrdering>
      <CountDetails xmlns:d2p1="http://schemas.microsoft.com/netservices/2011/06/servicebus">
        <d2p1:ActiveMessageCount>0</d2p1:ActiveMessageCount>
        <d2p1:DeadLetterMessageCount>0</d2p1:DeadLetterMessageCount>
        <d2p1:ScheduledMessageCount>0</d2p1:ScheduledMessageCount>
        <d2p1:TransferMessageCount>0</d2p1:TransferMessageCount>
        <d2p1:TransferDeadLetterMessageCount>0</d2p1:TransferDeadLetterMessageCount>
      </CountDetails>
      <AutoDeleteOnIdle>P10675199DT2H48M5.4775807S</AutoDeleteOnIdle>
      <EnablePartitioning>false</EnablePartitioning>
      <EntityAvailabilityStatus>Available</EntityAvailabilityStatus>
      <EnableExpress>false</EnableExpress>
    </QueueDescription>
  </content>
</entry>`.trim()
          };
        });

        const response: QueueGetResponse = await client.queue.get(namespaceName, queuePath);

        const request: WebResource = response._response.request;
        assert.deepEqual(request.url, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorect request URL");
        assert.deepEqual(request.method, "GET");
        assert.deepEqual(request.body, undefined);
        assert.deepEqual(request.query, undefined);

        const requestHeaders: HttpHeaders = request.headers;
        const authorizationHeader: string | undefined = requestHeaders.get("Authorization");
        assert(authorizationHeader);

        assert.strictEqual(response.id, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorrect response ID");
        assert.strictEqual(response.title, "testQueuePath");
        assert(response.published);
        assert(response.updated);

        const author = response.author!;
        assert(author);
        assert.strictEqual(author.name, namespaceName);

        const link = response.link!;
        assert(link);
        assert.strictEqual(link.rel, "self");
        assert.strictEqual(link.href, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorrect response link href");

        const content = response.content!;
        assert(content);
        assert.strictEqual(content.type, "application/xml");

        const queueDescription = content.queueDescription!;
        assert(queueDescription);
        assert.strictEqual(queueDescription.lockDuration, "PT1M");
        assert.strictEqual(queueDescription.maxSizeInMegabytes, 1024);
        assert.strictEqual(queueDescription.requiresDuplicateDetection, false);
        assert.strictEqual(queueDescription.requiresSession, false);
        assert.strictEqual(queueDescription.defaultMessageTimeToLive, "P14D");
        assert.strictEqual(queueDescription.deadLetteringOnMessageExpiration, false);
        assert.strictEqual(queueDescription.duplicateDetectionHistoryTimeWindow, "PT10M");
        assert.strictEqual(queueDescription.maxDeliveryCount, 10);
        assert.strictEqual(queueDescription.enableBatchedOperations, true);
        assert.strictEqual(queueDescription.sizeInBytes, 0);
        assert.strictEqual(queueDescription.messageCount, 0);
        assert.strictEqual(queueDescription.isAnonymousAccessible, false);
        assert.strictEqual(queueDescription.status, "Active");
        assert(queueDescription.createdAt);
        assert(queueDescription.updatedAt);
        assert.strictEqual(queueDescription.accessedAt, "0001-01-01T00:00:00Z");
        assert.strictEqual(queueDescription.supportOrdering, true);

        const countDetails = queueDescription.countDetails!;
        assert(countDetails);
        assert.strictEqual(countDetails.activeMessageCount, 0);
        assert.strictEqual(countDetails.deadLetterMessageCount, 0);
        assert.strictEqual(countDetails.scheduledMessageCount, 0);
        assert.strictEqual(countDetails.transferMessageCount, 0);
        assert.strictEqual(countDetails.transferDeadLetterMessageCount, 0);

        assert.strictEqual(queueDescription.autoDeleteOnIdle, "P10675199DT2H48M5.4775807S");
        assert.strictEqual(queueDescription.enablePartitioning, false);
        assert.strictEqual(queueDescription.entityAvailabilityStatus, "Available");
        assert.strictEqual(queueDescription.enableExpress, false);
      });
    });

    describe("create()", function () {
      it("when namespaceName doesn't exist", async function () {
        const client = getClient((request: WebResource) => { throw new Error("getaddrinfo ENOTFOUND nonexistingnamespace.servicebus.windows.net nonexistingnamespace.servicebus.windows.net:443"); });

        const namespaceName = "nonExistingNamespace";
        const queuePath = "nonExistingTestQueuePath";
        const error: Error = await msAssert.throwsAsync(client.queue.create(namespaceName, queuePath));
        assert.strictEqual(error.name, "Error");
        assert.strictEqual(error.message, "getaddrinfo ENOTFOUND nonexistingnamespace.servicebus.windows.net nonexistingnamespace.servicebus.windows.net:443");
      });

      it("when queuePath doesn't exist", async function () {
        const namespaceName = "daschulttest1";
        const queuePath = "nonExistingTestQueuePath";

        const client: ServiceBusManagementClient = getClient((httpRequest: WebResource) => {
          return {
            request: httpRequest,
            status: 200,
            headers: new HttpHeaders({
              "Transfer-Encoding": "chunked",
              "Content-Type": "application/atom+xml;type=feed;charset=utf-8",
              "Server": "Microsoft-HTTPAPI/2.0",
              "Strict-Transport-Security": "max-age=31536000",
              "Date": "Wed, 17 Oct 2018 21:56:16 GMT"
            }),
            bodyAsText:
              `
<entry xmlns="http://www.w3.org/2005/Atom">
  <id>https://${namespaceName}.servicebus.windows.net/testQueuePath?api-version=2017-04</id>
  <title type="text">testQueuePath</title>
  <published>2018-10-17T20:45:50Z</published>
  <updated>2018-10-17T20:45:50Z</updated>
  <author>
    <name>${namespaceName}</name>
  </author>
  <link rel="self" href="https://${namespaceName}.servicebus.windows.net/testQueuePath?api-version=2017-04"/>
  <content type="application/xml">
    <QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
      <LockDuration>PT1M</LockDuration>
      <MaxSizeInMegabytes>1024</MaxSizeInMegabytes>
      <RequiresDuplicateDetection>false</RequiresDuplicateDetection>
      <RequiresSession>false</RequiresSession>
      <DefaultMessageTimeToLive>P14D</DefaultMessageTimeToLive>
      <DeadLetteringOnMessageExpiration>false</DeadLetteringOnMessageExpiration>
      <DuplicateDetectionHistoryTimeWindow>PT10M</DuplicateDetectionHistoryTimeWindow>
      <MaxDeliveryCount>10</MaxDeliveryCount>
      <EnableBatchedOperations>true</EnableBatchedOperations>
      <SizeInBytes>0</SizeInBytes>
      <MessageCount>0</MessageCount>
      <IsAnonymousAccessible>false</IsAnonymousAccessible>
      <AuthorizationRules/>
      <Status>Active</Status>
      <CreatedAt>2018-10-17T20:45:50.48Z</CreatedAt>
      <UpdatedAt>2018-10-17T20:45:50.73Z</UpdatedAt>
      <SupportOrdering>true</SupportOrdering>
      <AutoDeleteOnIdle>P10675199DT2H48M5.4775807S</AutoDeleteOnIdle>
      <EnablePartitioning>false</EnablePartitioning>
      <EntityAvailabilityStatus>Available</EntityAvailabilityStatus>
      <EnableExpress>false</EnableExpress>
    </QueueDescription>
  </content>
</entry>
`.trim()
          };
        });

        const response: QueueGetResponse = await client.queue.get(namespaceName, queuePath);

        const request: WebResource = response._response.request;
        assert.deepEqual(request.url, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorect request URL");
        assert.deepEqual(request.method, "PUT");
        assert.deepEqual(request.body, `
<entry xmlns="http://www.w3.org/2005/Atom">
  <content type="application/xml">
    <QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect">
      <LockDuration>PT1M</LockDuration>
      <MaxSizeInMegabytes>1024</MaxSizeInMegabytes>
      <RequiresDuplicateDetection>false</RequiresDuplicateDetection>
      <RequiresSession>false</RequiresSession>
      <DeadLetteringOnMessageExpiration>false</DeadLetteringOnMessageExpiration>
      <MaxDeliveryCount>10</MaxDeliveryCount>
      <EnableBatchedOperations>true</EnableBatchedOperations>
      <AuthorizationRules />
      <Status>Active</Status>
      <EnablePartitioning>false</EnablePartitioning>
    </QueueDescription>
  </content>
</entry>
`.trim());
        assert.deepEqual(request.query, undefined);

        const requestHeaders: HttpHeaders = request.headers;
        const authorizationHeader: string | undefined = requestHeaders.get("Authorization");
        assert(authorizationHeader);

        assert.strictEqual(response.id, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorrect response ID");
        assert.strictEqual(response.title, "testQueuePath");
        assert(response.published);
        assert(response.updated);

        const author = response.author!;
        assert(author);
        assert.strictEqual(author.name, namespaceName);

        const link = response.link!;
        assert(link);
        assert.strictEqual(link.rel, "self");
        assert.strictEqual(link.href, `https://${namespaceName}.servicebus.windows.net/${queuePath}/?api-version=2017-04&enrich=False`, "Incorrect response link href");

        const content = response.content!;
        assert(content);
        assert.strictEqual(content.type, "application/xml");

        const queueDescription = content.queueDescription!;
        assert(queueDescription);
        assert.strictEqual(queueDescription.lockDuration, "PT1M");
        assert.strictEqual(queueDescription.maxSizeInMegabytes, 1024);
        assert.strictEqual(queueDescription.requiresDuplicateDetection, false);
        assert.strictEqual(queueDescription.requiresSession, false);
        assert.strictEqual(queueDescription.defaultMessageTimeToLive, "P14D");
        assert.strictEqual(queueDescription.deadLetteringOnMessageExpiration, false);
        assert.strictEqual(queueDescription.duplicateDetectionHistoryTimeWindow, "PT10M");
        assert.strictEqual(queueDescription.maxDeliveryCount, 10);
        assert.strictEqual(queueDescription.enableBatchedOperations, true);
        assert.strictEqual(queueDescription.sizeInBytes, 0);
        assert.strictEqual(queueDescription.messageCount, 0);
        assert.strictEqual(queueDescription.isAnonymousAccessible, false);
        assert.strictEqual(queueDescription.status, "Active");
        assert(queueDescription.createdAt);
        assert(queueDescription.updatedAt);
        assert.strictEqual(queueDescription.accessedAt, "0001-01-01T00:00:00Z");
        assert.strictEqual(queueDescription.supportOrdering, true);

        const countDetails = queueDescription.countDetails!;
        assert(countDetails);
        assert.strictEqual(countDetails.activeMessageCount, 0);
        assert.strictEqual(countDetails.deadLetterMessageCount, 0);
        assert.strictEqual(countDetails.scheduledMessageCount, 0);
        assert.strictEqual(countDetails.transferMessageCount, 0);
        assert.strictEqual(countDetails.transferDeadLetterMessageCount, 0);

        assert.strictEqual(queueDescription.autoDeleteOnIdle, "P10675199DT2H48M5.4775807S");
        assert.strictEqual(queueDescription.enablePartitioning, false);
        assert.strictEqual(queueDescription.entityAvailabilityStatus, "Available");
        assert.strictEqual(queueDescription.enableExpress, false);
      });
    });
  });
});
