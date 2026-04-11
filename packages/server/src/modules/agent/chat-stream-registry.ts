import type { ChatSocketClient } from './agent.types.js';

/**
 * A mutable proxy over a ChatSocketClient.
 * Allows re-pointing the underlying socket mid-stream (e.g., after client reconnect)
 * without changing any references held by in-flight async callbacks.
 */
export class MutableSocketProxy implements ChatSocketClient {
  private current: ChatSocketClient;

  constructor(initial: ChatSocketClient) {
    this.current = initial;
  }

  repoint(socket: ChatSocketClient): void {
    this.current = socket;
  }

  send(payload: string): void {
    try {
      this.current.send(payload);
    } catch {
      // Silently discard while the socket is disconnected; new socket will receive
      // subsequent events after repoint().
    }
  }

  close(): void {
    this.current.close();
  }

  on(event: string, listener: (payload: unknown) => void): void {
    this.current.on(event, listener);
  }
}

interface ActiveStream {
  proxy: MutableSocketProxy;
  agentId: string;
  startedAt: Date;
  abortController: AbortController;
  activeToolCallId: string | null;
  cancelRequested: boolean;
}

/**
 * Tracks active chat streams by agentId and requestId.
 * Allows re-attaching a new WebSocket to an in-flight stream when a client reconnects.
 */
export class ChatStreamRegistry {
  private readonly byRequestId = new Map<string, ActiveStream>();
  private readonly byAgentId = new Map<string, string>(); // agentId → requestId

  createProxy(socket: ChatSocketClient): MutableSocketProxy {
    return new MutableSocketProxy(socket);
  }

  register(requestId: string, agentId: string, proxy: MutableSocketProxy, abortController: AbortController): void {
    // Evict any stale entry for the same agent (defensive, shouldn't normally occur)
    const stale = this.byAgentId.get(agentId);
    if (stale) {
      this.byRequestId.delete(stale);
    }

    this.byRequestId.set(requestId, {
      proxy,
      agentId,
      startedAt: new Date(),
      abortController,
      activeToolCallId: null,
      cancelRequested: false
    });
    this.byAgentId.set(agentId, requestId);
  }

  complete(requestId: string): void {
    const stream = this.byRequestId.get(requestId);
    if (stream) {
      this.byAgentId.delete(stream.agentId);
      this.byRequestId.delete(requestId);
    }
  }

  /**
   * If there is an active stream for `agentId`, re-points its proxy to `newSocket`
   * so that all subsequent events (including chat.completed) flow to the new connection.
   * Returns the active requestId, or null if no stream is running.
   */
  reattach(agentId: string, newSocket: ChatSocketClient): string | null {
    const requestId = this.byAgentId.get(agentId);
    if (!requestId) {
      return null;
    }

    const stream = this.byRequestId.get(requestId);
    if (!stream) {
      return null;
    }

    stream.proxy.repoint(newSocket);
    return requestId;
  }

  requestCancel(agentId: string, requestId?: string): string | null {
    const activeRequestId = this.byAgentId.get(agentId);
    if (!activeRequestId) {
      return null;
    }

    if (requestId && requestId !== activeRequestId) {
      return null;
    }

    const stream = this.byRequestId.get(activeRequestId);
    if (!stream) {
      return null;
    }

    stream.cancelRequested = true;
    if (stream.activeToolCallId === null && !stream.abortController.signal.aborted) {
      stream.abortController.abort();
    }

    return activeRequestId;
  }

  beginTool(requestId: string, callId: string): void {
    const stream = this.byRequestId.get(requestId);
    if (!stream) {
      return;
    }

    stream.activeToolCallId = callId;
  }

  completeTool(requestId: string, callId: string): void {
    const stream = this.byRequestId.get(requestId);
    if (!stream || stream.activeToolCallId !== callId) {
      return;
    }

    stream.activeToolCallId = null;
    if (stream.cancelRequested && !stream.abortController.signal.aborted) {
      stream.abortController.abort();
    }
  }

  shouldStop(requestId: string): boolean {
    const stream = this.byRequestId.get(requestId);
    return stream?.cancelRequested === true;
  }
}
