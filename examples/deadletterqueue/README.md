# Dead-Letter Queues 

This sample shows how to move messages to the Dead-letter queue, how to retrieve
messages from it, and resubmit corrected message back into the main queue. 

For setup instructions, make sure the Queue is created and configured to enable
Dead Letter Queue support. Copy down the connection string and queue name details
to enter and use at time of running the sample. 

## What is a Dead-Letter Queue? 

All Service Bus Queues and Subscriptions have a secondary sub-queue, called the
*dead-letter queue* (DLQ). 

This sub-queue does not need to be explicitly created and cannot be deleted or
otherwise managed independent of the main entity. The purpose of the Dead-Letter
Queue (DLQ) is accept and hold messages that cannot be delivered to any receiver
or messages that could not be processed. Read more about Dead-Letter Queues [in
the product documentation.][1]

## Sample Code 

The folder consists of two samples:

* The first sample 'movingMessagesToDLQ' implements three scenarios:

    * Send a message and then retrieve and immediately mark as to be dead-lettered.

    * Send a message and then retrieve and abandon the message until the maximum
delivery count is exhausted and the message is automatically dead-lettered. 

    * Send a message and then retrieve and mimick explicit failure handling scenario to 
result in message being dead-lettered.

* The second sample 'processMessagesInDLQ' implements scenario in which the messages from DLQ 
are retrieved, repaired and sent back to the original queue for reprocessing.

The sample code is further documented inline.

[1]: https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues
