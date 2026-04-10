type ChatChunkListener = (chunk: string) => void;

const listeners = new Map<string, ChatChunkListener>();

export function registerChatChunkListener(
  requestId: string,
  listener: ChatChunkListener
): () => void {
  listeners.set(requestId, listener);
  return () => {
    const current = listeners.get(requestId);
    if (current === listener) {
      listeners.delete(requestId);
    }
  };
}

export function publishChatChunk(requestId: string, chunk: string): void {
  if (chunk.length === 0) {
    return;
  }

  listeners.get(requestId)?.(chunk);
}
