// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { OnSessionMessage, SessionHandlerOptions, MessageSession } from "./messageSession";
import { OnError } from "../core/messageReceiver";
import { ClientEntityContext } from "../clientEntityContext";
import { getProcessorCount } from "../util/utils";
import * as log from "../log";
import { Semaphore } from "../util/semaphore";
import { delay, ConditionErrorNameMapper } from "@azure/amqp-common";

export class SessionManager {
  /**
   * @property {boolean} isManagingSessions Indicates whether the manage is currently managing
   * sessions.
   * - **Default**: `false`.
   */
  isManagingSessions: boolean = false;
  /**
   * @property {number} maxConcurrentSessions The maximum number of sessions that the user wants to
   * handle concurrently.
   * - **Default**: `2000`.
   */
  set maxConcurrentSessions(value: number) {
    if (value <= 0) {
      throw new Error("'maxConcurrentSessions must be greater than 0.");
    }
    this._maxConcurrentSessions = value;
    this.maxConcurrentAcceptSessionRequests = value;
  }
  get maxConcurrenSessions(): number {
    return this._maxConcurrentSessions;
  }
  /**
   * @property {number} _maxConcurrentAcceptSessionRequests The maximum number of acceptSession
   * requests that can be made concurrently at any given time.
   */
  set maxConcurrentAcceptSessionRequests(value: number) {
    this._maxConcurrentAcceptSessionRequests = Math.min(value, getProcessorCount());
  }
  get maxConcurrentAcceptSessionRequests(): number {
    return this._maxConcurrentAcceptSessionRequests;
  }
  private _maxConcurrentSessions!: number;
  private _maxConcurrentAcceptSessionRequests!: number;
  private _isCancelRequested: boolean = false;
  private _maxConcurrentSessionsSemaphore?: Semaphore;
  private _maxPendingAcceptSessionsSemaphore?: Semaphore;

  /**
   * @property {ClientEntityContext} _context The client entity context.
   * @readonly
   */
  private readonly _context: ClientEntityContext;

  constructor(context: ClientEntityContext) {
    this._context = context;
    this.maxConcurrentSessions = 2000;
  }
  /**
   * Manages MessageSessions based on the provided parameters.
   * @param onSessionMessage The message handler to receive service bus messages from a session
   * enabled entity.
   * @param onError The error handler to receive an error that occurs while receiving messages
   * from a session enabled entity.
   */
  async manageMessageSessions(
    onSessionMessage: OnSessionMessage,
    onError: OnError,
    options?: SessionHandlerOptions
  ): Promise<void> {
    this.isManagingSessions = true;
    if (!options) options = {};
    if (options.maxConcurrentSessions) this.maxConcurrentSessions = options.maxConcurrentSessions;
    this._maxConcurrentSessionsSemaphore = new Semaphore(this.maxConcurrenSessions);
    this._maxPendingAcceptSessionsSemaphore = new Semaphore(this.maxConcurrentAcceptSessionRequests);

    for (let i = 0; i < this._maxConcurrentAcceptSessionRequests; i++) {
      this.acceptSessionAndReceiveMessages(onSessionMessage, onError, options).catch((err) => {
        log.error(err);
      });
    }
  }

  /**
   * Accept a new session and start receiving messages.
   * @param onSessionMessage Handler for receiving messages from a session enabled entity.
   * @param onError Handler for receiving errors.
   * @param options Optional parameters for handling sessions.
   */
  async acceptSessionAndReceiveMessages(
    onSessionMessage: OnSessionMessage,
    onError: OnError,
    options?: SessionHandlerOptions): Promise<void> {
    const connectionId = this._context.namespace.connectionId;
    const noActiveSessionBackOffInSeconds = 10;
    while (!this._isCancelRequested) {
      let concurrentSessionSemaphoreAcquired: boolean = false;
      try {
        await this._maxConcurrentSessionsSemaphore!.acquire();
        log.sessionManager("[%s] Acquired the semaphore for max concurrent sessions", connectionId);
        concurrentSessionSemaphoreAcquired = true;

        await this._maxPendingAcceptSessionsSemaphore!.acquire();
        log.sessionManager("[%s] Acquired the semaphore for max pending accept sessions",
          connectionId);
        const messageSession = await MessageSession.create(this._context, options);
        const sessionId = messageSession.sessionId;
        this._context.messageSessions[sessionId as string] = messageSession;
        log.sessionManager("[%s] Created MessageSession with id '%s'.", connectionId, sessionId);
        const onSessionError: OnError = async (error) => {
          try {
            await this._maxConcurrentSessionsSemaphore!.release();
            log.sessionManager("[%s] Releasing the semaphore for max concurrent sessions " +
              "because an error ocurred in MessageSession with id '%s': %O.",
              connectionId,
              sessionId,
              error
            );
            if (messageSession.isOpen()) {
              await messageSession.close();
            }
          } catch (err) {
            log.error(
              "[%s] An error occurred while receiving messages from MessageSession with " +
              "id '%s': %O.",
              connectionId,
              messageSession.sessionId,
              err
            );
          }
          if (error.name !== ConditionErrorNameMapper["com.microsoft:message-wait-timeout"]) {
            // notify the user about the error.
            onError(error);
          }
        };
        messageSession.receive(onSessionMessage, onSessionError, options);
      } catch (err) {
        log.error("[%s] An error occurred while accepting a MessageSession: %O", connectionId,
          err);
        if (concurrentSessionSemaphoreAcquired) {
          this._maxConcurrentSessionsSemaphore!.release();
          log.sessionManager("[%s] Releasing the semaphore for max concurrent sessions " +
            "because an error ocurred.",
            connectionId
          );
        }
        if (err.name === ConditionErrorNameMapper["amqp:operation-timeout"] ||
          err.name === ConditionErrorNameMapper["com.microsoft:timeout"] ||
          err.name === ConditionErrorNameMapper["com.microsoft:session-cannot-be-locked"]) {
          log.sessionManager("[%s] Sleeping for %d seconds, since there are no more " +
            "active MessageSessions on the ServiceBus entity.",
            connectionId,
            noActiveSessionBackOffInSeconds);
          await delay(noActiveSessionBackOffInSeconds * 1000);
        } else {
          onError(err);
        }
      } finally {
        this._maxPendingAcceptSessionsSemaphore!.release();
        log.sessionManager("[%s] Releasing the semaphore for max pending accept sessions from " +
          "the finally block.",
          connectionId
        );
      }
    }
  }

  /**
   * Close the session manager.
   */
  close(): void {
    this._isCancelRequested = true;
    this.isManagingSessions = false;
  }
}
