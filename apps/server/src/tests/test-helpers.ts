export const TEST_API_KEY = 'test-api-key';

export interface ChatSocketEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export async function runSocketChat(
  url: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<ChatSocketEvent[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const events: ChatSocketEvent[] = [];
    let settled = false;

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      handler();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        socket.close();
        reject(new Error('Timed out waiting for chat stream completion'));
      });
    }, 5000);

    socket.addEventListener('message', (event) => {
      const nextEvent = JSON.parse(String(event.data)) as ChatSocketEvent;
      events.push(nextEvent);

      if (nextEvent.type === 'chat.ready') {
        socket.send(JSON.stringify({ message, meta }));
        return;
      }

      if (nextEvent.type === 'chat.error') {
        finish(() => {
          socket.close();
          reject(
            new Error(
              typeof nextEvent.payload?.message === 'string'
                ? nextEvent.payload.message
                : 'Chat stream failed'
            )
          );
        });
        return;
      }

      if (nextEvent.type === 'chat.completed') {
        finish(() => {
          socket.close();
          resolve(events);
        });
      }
    });

    socket.addEventListener('error', () => {
      finish(() => {
        reject(new Error('WebSocket connection failed'));
      });
    });

    socket.addEventListener('close', () => {
      if (settled) {
        return;
      }

      finish(() => {
        reject(new Error('Chat stream closed before completion'));
      });
    });
  });
}
