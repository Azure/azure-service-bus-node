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
      assert.strictEqual(response._response.bodyAsText, "spam");
    });
  });
});
