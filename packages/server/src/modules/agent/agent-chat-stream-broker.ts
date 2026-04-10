export interface ChatStreamToolStart {
  type: 'tool.start';
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ChatStreamToolComplete {
  type: 'tool.complete';
  toolName: string;
  ok: boolean;
  summary: string;
  error?: { code?: string; message: string };
}

export interface ChatStreamChunk {
  type: 'chunk';
  chunk: string;
}

export type ChatStreamEvent = ChatStreamChunk | ChatStreamToolStart | ChatStreamToolComplete;

type ChatStreamListener = (event: ChatStreamEvent) => void;

const listeners = new Map<string, ChatStreamListener>();

export function registerChatStreamListener(
  requestId: string,
  listener: ChatStreamListener
): () => void {
  listeners.set(requestId, listener);
  return () => {
    const current = listeners.get(requestId);
    if (current === listener) {
      listeners.delete(requestId);
    }
  };
}

/** @deprecated Use registerChatStreamListener instead */
export function registerChatChunkListener(
  requestId: string,
  listener: (chunk: string) => void
): () => void {
  return registerChatStreamListener(requestId, (event) => {
    if (event.type === 'chunk') {
      listener(event.chunk);
    }
  });
}

export function publishChatChunk(requestId: string, chunk: string): void {
  if (chunk.length === 0) {
    return;
  }

  listeners.get(requestId)?.({ type: 'chunk', chunk });
}

export function publishToolStart(requestId: string, toolName: string, args: Record<string, unknown>): void {
  listeners.get(requestId)?.({ type: 'tool.start', toolName, arguments: args });
}

export function publishToolComplete(
  requestId: string,
  toolName: string,
  ok: boolean,
  summary: string,
  error?: { code?: string; message: string }
): void {
  listeners.get(requestId)?.({ type: 'tool.complete', toolName, ok, summary, ...(error ? { error } : {}) });
}
