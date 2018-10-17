import { SasTokenProvider, TokenInfo } from "@azure/amqp-common";
import * as assert from "assert";
import * as fs from "fs";
import { HttpHeaders, ServiceClientCredentials, WebResource, URLBuilder } from "ms-rest-js";
import * as path from "path";
import { QueueGetResponse } from "../lib/management/models";
import { ServiceBusManagementClient } from "../lib/management/serviceBusManagementClient";

// class FakeHttpClient implements HttpClient {
//   public requests: WebResource[] = [];

//   public sendRequest(httpRequest: WebResource): Promise<HttpResponse> {
//     this.requests.push(httpRequest);
//     return Promise.resolve<HttpResponse>({
//       request: httpRequest,
//       status: 200,
//       headers: new HttpHeaders()
//     });
//   }
// }

class SasTokenCredentials implements ServiceClientCredentials {
  constructor(private sasTokenProvider: SasTokenProvider) {
  }

  signRequest(webResource: WebResource): Promise<WebResource> {
    const url: URLBuilder = URLBuilder.parse(webResource.url);
    // url.setQuery(undefined);

    return this.getToken(url.toString())
      .then((token: TokenInfo) => {
        webResource.headers.set("Authorization", token.token);
        return webResource;
      });
  }

  getToken(requestUrl: string): Promise<TokenInfo> {
    return this.sasTokenProvider.getToken(requestUrl);
  }

  static fromConnectionString(connectionString: string): SasTokenCredentials {
    const sasTokenProvider: SasTokenProvider = SasTokenProvider.fromConnectionString(connectionString);

    return new SasTokenCredentials(sasTokenProvider);
  }
}

function getCredentials(): SasTokenCredentials {
  const connectionStringFilePath: string = path.resolve("./sbauth.env");
  const connectionStringText: string = fs.readFileSync(connectionStringFilePath, { encoding: "utf8" });
  return SasTokenCredentials.fromConnectionString(connectionStringText);
}

describe("ServiceBusManagementClient", () => {
  describe("queue", () => {
    it("get()", async () => {
      const client = new ServiceBusManagementClient(getCredentials());

      const response: QueueGetResponse = await client.queue.get("daschulttest1", "testQueuePath", "False");

      const request: WebResource = response._response.request;
      assert.deepEqual(request.url, "https://daschulttest1.servicebus.windows.net/testQueuePath/?api-version=2017-04&enrich=False");
      assert.deepEqual(request.method, "GET");
      assert.deepEqual(request.body, undefined);
      assert.deepEqual(request.query, undefined);

      const requestHeaders: HttpHeaders = request.headers;
      const authorizationHeader: string | undefined = requestHeaders.get("Authorization");
      assert(authorizationHeader);
      assert(authorizationHeader!.startsWith("SharedAccessSignature sr=https%3A%2F%2Fdaschulttest1.servicebus.windows.net%2FtestQueuePath%2F"));
      assert(authorizationHeader!.endsWith("&skn=RootManageSharedAccessKey"));

      assert.strictEqual(response.id, "https://daschulttest1.servicebus.windows.net/testQueuePath/?api-version=2017-04&enrich=False");
      assert.strictEqual(response.title, "testQueuePath");
      assert.strictEqual(response.published, "2018-10-09T19:56:34Z");
      assert.strictEqual(response.updated, "2018-10-09T19:56:35Z");

      const author = response.author!;
      assert(author);
      assert.strictEqual(author.name, "daschulttest1");

      const link = response.link!;
      assert(link);
      assert.strictEqual(link.rel, "self");
      assert.strictEqual(link.href, "https://daschulttest1.servicebus.windows.net/testQueuePath/?api-version=2017-04&enrich=False");

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
      assert.strictEqual(queueDescription.createdAt, "2018-10-09T19:56:34.903Z");
      assert.strictEqual(queueDescription.updatedAt, "2018-10-09T19:56:35.013Z");
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
