using Microsoft.Azure.ServiceBus.Management;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;
using System.Threading.Tasks;

namespace ServiceBusDotNetTests
{
    [TestClass]
    public class QueueTests
    {
        private const string queuePath = "testQueuePath";

        private static string connectionString = null;

        private static ManagementClient CreateManagementClient()
        {
            if (connectionString == null)
            {
                string sbauthEnvFilePath = Path.GetFullPath("sbauth.env");
                Assert.IsTrue(File.Exists(sbauthEnvFilePath), $"The file {sbauthEnvFilePath} doesn't exist.");

                connectionString = File.ReadAllText(sbauthEnvFilePath);
                Assert.IsNotNull(connectionString, $"The contents of {sbauthEnvFilePath} cannot be null.");
                Assert.AreNotEqual("", connectionString, $"The contents of {sbauthEnvFilePath} cannot be empty.");
            }
            return new ManagementClient(connectionString);
        }

        [TestMethod]
        [Ignore]
        public async Task CreateQueueAsync()
        {
            ManagementClient managementClient = CreateManagementClient();
            QueueDescription queueDescription = await managementClient.CreateQueueAsync(new QueueDescription(queuePath));
            Assert.IsNotNull(queueDescription);
            Assert.AreEqual(queuePath, queueDescription.Path);
        }

        [TestMethod]
        [Ignore]
        public async Task DeleteQueueAsync()
        {
            ManagementClient managementClient = CreateManagementClient();
            await managementClient.DeleteQueueAsync(queuePath);
        }

        [TestMethod]
        public async Task GetQueueAsync()
        {
            ManagementClient managementClient = CreateManagementClient();
            QueueDescription queueDescription = await managementClient.GetQueueAsync(queuePath);
            Assert.IsNotNull(queueDescription);
            Assert.AreEqual(queuePath, queueDescription.Path);
        }
    }
}
