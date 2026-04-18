import { uiRuntime } from '../runtime';

interface EventStreamMessage {
  type?: string;
  payload?: unknown;
}

type EventStreamListener = (message: EventStreamMessage) => void;

const RECONNECT_DELAY_MS = 5_000;

const listeners = new Set<EventStreamListener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function buildEventsUrl(): string {
  const baseURL = uiRuntime.stores.app.state.connection.baseURL;
  const url = new URL('/api/v1/events', baseURL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  const apiKey =
    (typeof window !== 'undefined' && window.familycoDesktopConfig?.apiKey?.trim()) ||
    import.meta.env.VITE_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set('apiKey', apiKey);
  }

  return url.toString();
}

function emitToListeners(message: EventStreamMessage): void {
  for (const listener of listeners) {
    try {
      listener(message);
    } catch {
      // Ignore listener errors so one subscriber cannot break the stream.
    }
  }
}

function handleSocketMessage(event: MessageEvent): void {
  try {
    const parsed = JSON.parse(String(event.data)) as EventStreamMessage;
    emitToListeners(parsed);
  } catch {
    // Ignore malformed websocket payloads.
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer || listeners.size === 0) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

function connect(): void {
  if (listeners.size === 0) {
    return;
  }

  if (socket && socket.readyState < WebSocket.CLOSING) {
    return;
  }

  try {
    socket = new WebSocket(buildEventsUrl());

    socket.addEventListener('message', handleSocketMessage);
    socket.addEventListener('close', () => {
      socket = null;
      scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      socket?.close();
    });
  } catch {
    scheduleReconnect();
  }
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  socket?.close();
  socket = null;
}

export function subscribeEventsStream(listener: EventStreamListener): () => void {
  listeners.add(listener);
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      disconnect();
    }
  };
}
