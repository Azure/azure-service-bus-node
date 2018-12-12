// @public
interface AmqpError {
  condition?: string;
  description?: string;
  info?: any;
  value?: any[];
}

// @public
interface ConnectionConfig {
}

// @public
interface CorrelationFilter {
  contentType?: string;
  correlationId?: string;
  label?: string;
  messageId?: string;
  replyTo?: string;
  replyToSessionId?: string;
  sessionId?: string;
  to?: string;
  userProperties?: any;
}

// @public
interface DataTransformer {
  decode: (body: any) => any;
  encode: (body: any) => any;
}

// @public
interface DeadLetterOptions {
  deadLetterErrorDescription: string;
  deadletterReason: string;
}

// @public
class DefaultDataTransformer implements DataTransformer {
  decode(body: any): any;
  encode(body: any): any;
}

// @public
export function delay<T>(t: number, value?: T): Promise<T>;

// @public (undocumented)
interface Delivery {
  // (undocumented)
  accept(): void;
  // (undocumented)
  readonly format: number;
  // (undocumented)
  readonly id: number;
  // (undocumented)
  readonly link: Sender | Receiver;
  // (undocumented)
  modified(params?: ReleaseParameters): void;
  // (undocumented)
  reject(error?: AmqpError): void;
  // (undocumented)
  release(params?: ReleaseParameters): void;
  // (undocumented)
  readonly remote_settled: boolean;
  // (undocumented)
  readonly remote_state?: DeliveryOutcome;
  // (undocumented)
  readonly sent: boolean;
  // (undocumented)
  readonly settled: boolean;
  // (undocumented)
  readonly state?: DeliveryOutcome;
  // (undocumented)
  readonly tag: Buffer | string;
  // (undocumented)
  update(settled: boolean, state?: any): void;
}

// @public
interface Dictionary<T> {
  // (undocumented)
  [key: string]: T;
}

// @public (undocumented)
interface MessageHandlerOptions {
  autoComplete?: boolean;
  maxAutoRenewDurationInSeconds?: number;
  maxConcurrentCalls?: number;
}

// @public
interface MessageHeader {
  delivery_count?: number;
  durable?: boolean;
  first_acquirer?: boolean;
  priority?: number;
  ttl?: number;
}

// @public
interface MessageProperties {
  absolute_expiry_time?: number;
  content_encoding?: string;
  content_type?: string;
  correlation_id?: string | number | Buffer;
  creation_time?: number;
  group_id?: string;
  group_sequence?: number;
  message_id?: string | number | Buffer;
  reply_to?: string;
  reply_to_group_id?: string;
  subject?: string;
  to?: string;
  user_id?: string;
}

// @public
class MessageSession extends LinkEntity {
  // WARNING: The type "ClientEntityContext" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "MessageSessionOptions" needs to be exported by the package (e.g. added to index.ts)
  constructor(context: ClientEntityContext, options?: MessageSessionOptions);
  autoComplete: boolean;
  autoRenewLock: boolean;
  close(): Promise<void>;
  // WARNING: The type "ClientEntityContext" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "MessageSessionOptions" needs to be exported by the package (e.g. added to index.ts)
  static create(context: ClientEntityContext, options?: MessageSessionOptions): Promise<MessageSession>;
  getState(): Promise<void>;
  isOpen(): boolean;
  maxAutoRenewDurationInSeconds: number;
  maxConcurrentCallsPerSession?: number;
  maxConcurrentSessions?: number;
  maxMessageWaitTimeoutInSeconds: number;
  peek(messageCount?: number): Promise<ReceivedMessageInfo[]>;
  peekBySequenceNumber(fromSequenceNumber: Long, messageCount?: number): Promise<ReceivedMessageInfo[]>;
  // WARNING: The type "SessionHandlerOptions" needs to be exported by the package (e.g. added to index.ts)
  receive(onSessionMessage: OnSessionMessage, onError: OnError, options?: SessionHandlerOptions): void;
  receiveBatch(maxMessageCount: number, maxWaitTimeInSeconds?: number): Promise<ServiceBusMessage[]>;
  receiveDeferredMessage(sequenceNumber: Long): Promise<ServiceBusMessage | undefined>;
  receiveDeferredMessages(sequenceNumbers: Long[]): Promise<ServiceBusMessage[]>;
  receiveMode: ReceiveMode;
  renewLock(): Promise<Date>;
  sessionId?: string;
  sessionLockedUntilUtc?: Date;
  setState(state: any): Promise<void>;
  // WARNING: The type "DispositionType" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "DispositionOptions" needs to be exported by the package (e.g. added to index.ts)
  settleMessage(message: ServiceBusMessage, operation: DispositionType, options?: DispositionOptions): Promise<any>;
}

// @public
class MessagingError extends Error {
  constructor(message: string);
  condition?: string;
  info?: any;
  name: string;
  retryable: boolean;
  translated: boolean;
}

// @public
class Namespace {
  constructor(config: ConnectionConfig, options?: NamespaceOptions);
  close(): Promise<any>;
  // WARNING: The type "NamespaceOptionsBase" needs to be exported by the package (e.g. added to index.ts)
  static createFromAadTokenCredentials(host: string, credentials: ApplicationTokenCredentials | UserTokenCredentials | DeviceTokenCredentials | MSITokenCredentials, options?: NamespaceOptions): Namespace;
  static createFromConnectionString(connectionString: string, options?: NamespaceOptions): Namespace;
  // WARNING: The type "NamespaceOptionsBase" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "NamespaceOptionsBase" needs to be exported by the package (e.g. added to index.ts)
  static createFromTokenProvider(host: string, tokenProvider: TokenProvider, options?: NamespaceOptionsBase): Namespace;
  createQueueClient(queueName: string, options?: QueueClientOptions): QueueClient;
  createSubscriptionClient(topicName: string, subscriptionName: string, options?: SubscriptionClientOptions): SubscriptionClient;
  createTopicClient(topicName: string): TopicClient;
  // (undocumented)
  static getDeadLetterQueuePathForQueue(queueName: string): string;
  name: string;
}

// @public
interface NamespaceOptions extends NamespaceOptionsBase {
  tokenProvider?: TokenProvider;
}

// @public
export function parseConnectionString<T>(connectionString: string): ParsedOutput<T>;

// @public (undocumented)
class QueueClient extends Client {
  // WARNING: The type "ConnectionContext" needs to be exported by the package (e.g. added to index.ts)
  constructor(name: string, context: ConnectionContext, options?: QueueClientOptions);
  // WARNING: The type "AcceptSessionOptions" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  acceptSession(options?: AcceptSessionOptions): Promise<MessageSession>;
  cancelScheduledMessage(sequenceNumber: Long): Promise<void>;
  cancelScheduledMessages(sequenceNumbers: Long[]): Promise<void>;
  close(): Promise<any>;
  // WARNING: The type "ListSessionsResponse" needs to be exported by the package (e.g. added to index.ts)
  listMessageSessions(skip: number, top: number, lastUpdatedTime?: Date): Promise<ListSessionsResponse>;
  peek(messageCount?: number): Promise<ReceivedMessageInfo[]>;
  peekBySequenceNumber(fromSequenceNumber: Long, messageCount?: number): Promise<ReceivedMessageInfo[]>;
  receive(onMessage: OnMessage, onError: OnError, options?: MessageHandlerOptions): ReceiveHandler;
  receiveBatch(maxMessageCount: number, maxWaitTimeInSeconds?: number, maxMessageWaitTimeoutInSeconds?: number): Promise<ServiceBusMessage[]>;
  receiveDeferredMessage(sequenceNumber: Long): Promise<ServiceBusMessage | undefined>;
  receiveDeferredMessages(sequenceNumbers: Long[]): Promise<ServiceBusMessage[]>;
  // WARNING: The type "SessionHandlerOptions" needs to be exported by the package (e.g. added to index.ts)
  receiveMessgesFromSessions(onSessionMessage: OnSessionMessage, onError: OnError, options?: SessionHandlerOptions): Promise<void>;
  receiveMode: ReceiveMode;
  renewLock(lockTokenOrMessage: string | ServiceBusMessage): Promise<Date>;
  scheduleMessage(message: SendableMessageInfo, scheduledEnqueueTimeUtc: Date): Promise<Long>;
  scheduleMessages(messages: ScheduleMessage[]): Promise<Long[]>;
  send(data: SendableMessageInfo): Promise<Delivery>;
  sendBatch(datas: SendableMessageInfo[]): Promise<Delivery>;
}

// @public
interface QueueClientOptions {
  receiveMode?: ReceiveMode;
}

// @public
interface ReceivedMessageInfo {
}

// @public
class ReceiveHandler {
  // WARNING: The type "MessageReceiver" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "MessageReceiver" needs to be exported by the package (e.g. added to index.ts)
  constructor(receiver: MessageReceiver);
  readonly address: string | undefined;
  readonly autoComplete: boolean;
  readonly isReceiverOpen: boolean;
  readonly name: string;
  readonly receiveMode: ReceiveMode;
  stop(): Promise<void>;
}

// @public
enum ReceiveMode {
  peekLock = 1,
  receiveAndDelete = 2
}

// @public
interface RuleDescription {
  action?: SQLExpression;
  filter?: SQLExpression | CorrelationFilter;
  name: string;
}

// @public
interface ScheduleMessage {
  message: SendableMessageInfo;
  scheduledEnqueueTimeUtc: Date;
}

// @public (undocumented)
interface SendableMessageInfo {
}

// @public
interface ServiceBusConnectionStringModel {
  // (undocumented)
  [x: string]: any;
  // (undocumented)
  Endpoint: string;
  // (undocumented)
  EntityPath?: string;
  // (undocumented)
  SharedAccessKey: string;
  // (undocumented)
  SharedAccessKeyName: string;
}

// @public
interface ServiceBusDeliveryAnnotations extends DeliveryAnnotations {
  [x: string]: any;
  last_enqueued_offset?: string;
  last_enqueued_sequence_number?: number;
  last_enqueued_time_utc?: number;
  runtime_info_retrieval_time_utc?: number;
}

// @public
class ServiceBusMessage implements ReceivedMessage {
  // WARNING: The type "ClientEntityContext" needs to be exported by the package (e.g. added to index.ts)
  constructor(context: ClientEntityContext, msg: AmqpMessage, delivery: Delivery);
  readonly _amqpMessage: AmqpMessage;
  abandon(propertiesToModify?: Dictionary<any>): Promise<void>;
  body: any;
  clone(): SendableMessageInfo;
  complete(): Promise<void>;
  contentType?: string;
  correlationId?: string | number | Buffer;
  deadLetter(options?: DeadLetterOptions): Promise<void>;
  readonly deadLetterSource?: string;
  defer(propertiesToModify?: Dictionary<any>): Promise<void>;
  readonly delivery: Delivery;
  readonly deliveryCount?: number;
  readonly enqueuedSequenceNumber?: number;
  readonly enqueuedTimeUtc?: Date;
  readonly expiresAtUtc?: Date;
  label?: string;
  lockedUntilUtc?: Date;
  readonly lockToken?: string;
  messageId?: string | number | Buffer;
  partitionKey?: string;
  replyTo?: string;
  replyToSessionId?: string;
  scheduledEnqueueTimeUtc?: Date;
  readonly sequenceNumber?: Long;
  sessionId?: string;
  timeToLive?: number;
  to?: string;
  userProperties?: Dictionary<any>;
  viaPartitionKey?: string;
}

// @public
interface ServiceBusMessageAnnotations extends MessageAnnotations {
  // WARNING: The name "x-opt-enqueued-time" contains unsupported characters; API names should use only letters, numbers, and underscores
  x-opt-enqueued-time?: number;
  // WARNING: The name "x-opt-locked-until" contains unsupported characters; API names should use only letters, numbers, and underscores
  x-opt-locked-until?: Date | number;
  // WARNING: The name "x-opt-offset" contains unsupported characters; API names should use only letters, numbers, and underscores
  x-opt-offset?: string;
  // WARNING: The name "x-opt-partition-key" contains unsupported characters; API names should use only letters, numbers, and underscores
  x-opt-partition-key?: string | null;
  // WARNING: The name "x-opt-sequence-number" contains unsupported characters; API names should use only letters, numbers, and underscores
  x-opt-sequence-number?: number;
}

// @public
interface SQLExpression {
  expression: string;
}

// @public (undocumented)
class SubscriptionClient extends Client {
  // WARNING: The type "ConnectionContext" needs to be exported by the package (e.g. added to index.ts)
  constructor(topicPath: string, subscriptionName: string, context: ConnectionContext, options?: SubscriptionClientOptions);
  addRule(ruleName: string, filter: boolean | string | CorrelationFilter, sqlRuleActionExpression?: string): Promise<void>;
  close(): Promise<void>;
  readonly defaultRuleName: string;
  getRules(): Promise<RuleDescription[]>;
  peek(messageCount?: number): Promise<ReceivedMessageInfo[]>;
  peekBySequenceNumber(fromSequenceNumber: Long, messageCount?: number): Promise<ReceivedMessageInfo[]>;
  receive(onMessage: OnMessage, onError: OnError, options?: MessageHandlerOptions): ReceiveHandler;
  receiveBatch(maxMessageCount: number, maxWaitTimeInSeconds?: number, maxMessageWaitTimeoutInSeconds?: number): Promise<ServiceBusMessage[]>;
  receiveDeferredMessage(sequenceNumber: Long): Promise<ServiceBusMessage | undefined>;
  receiveDeferredMessages(sequenceNumbers: Long[]): Promise<ReceivedMessageInfo[]>;
  receiveMode: ReceiveMode;
  removeRule(ruleName: string): Promise<void>;
  renewLock(lockTokenOrMessage: string | ServiceBusMessage): Promise<Date>;
  subscriptionName: string;
  topicPath: string;
}

// @public
interface SubscriptionClientOptions {
  receiveMode?: ReceiveMode;
}

// @public
class Timeout {
  // (undocumented)
  clear(): void;
  // (undocumented)
  set<T>(t: number, value?: T): Promise<T>;
  // (undocumented)
  wrap<T>(promise: Promise<T>, t: number, value?: T): Promise<T>;
}

// @public
interface TokenInfo {
  expiry: number;
  token: string;
  tokenType: TokenType;
}

// @public
interface TokenProvider {
  getToken(audience?: string): Promise<TokenInfo>;
  tokenRenewalMarginInSeconds: number;
  tokenValidTimeInSeconds: number;
}

// @public
enum TokenType {
  CbsTokenTypeJwt = "jwt",
  CbsTokenTypeSas = "servicebus.windows.net:sastoken"
}

// @public
class TopicClient extends Client {
  // WARNING: The type "ConnectionContext" needs to be exported by the package (e.g. added to index.ts)
  constructor(name: string, context: ConnectionContext);
  cancelScheduledMessage(sequenceNumber: Long): Promise<void>;
  cancelScheduledMessages(sequenceNumbers: Long[]): Promise<void>;
  close(): Promise<any>;
  scheduleMessage(message: SendableMessageInfo, scheduledEnqueueTimeUtc: Date): Promise<Long>;
  scheduleMessages(messages: ScheduleMessage[]): Promise<Long[]>;
  send(data: SendableMessageInfo): Promise<Delivery>;
  sendBatch(datas: SendableMessageInfo[]): Promise<Delivery>;
}

// WARNING: Unsupported export: generateUuid
// WARNING: Unsupported export: OnError
// WARNING: Unsupported export: OnMessage
// WARNING: Unsupported export: OnSessionMessage
// (No @packagedocumentation comment for this package)
