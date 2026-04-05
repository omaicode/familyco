import type { EventBus, FamilyCoEvents } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

export interface EventGatewayDeps {
  eventBus: EventBus;
}

export function registerEventGateway(app: FastifyInstance, deps: EventGatewayDeps): void {
  const clients = new Set<{ send: (payload: string) => void; close: () => void; readyState?: number; OPEN?: number }>();

  app.get('/events', { websocket: true }, (connection) => {
    clients.add(connection.socket);

    connection.socket.send(
      JSON.stringify({
        type: 'system.connected',
        payload: {
          connectedAt: new Date().toISOString()
        }
      })
    );

    connection.socket.on('close', () => {
      clients.delete(connection.socket);
    });
  });

  const forward = <T extends keyof FamilyCoEvents>(type: T, payload: FamilyCoEvents[T]): void => {
    const message = JSON.stringify({ type, payload });
    for (const client of clients) {
      const openState = typeof client.OPEN === 'number' ? client.OPEN : 1;
      if (typeof client.readyState === 'number' && client.readyState !== openState) {
        continue;
      }

      client.send(message);
    }
  };

  deps.eventBus.on('agent.created', (payload) => forward('agent.created', payload));
  deps.eventBus.on('agent.paused', (payload) => forward('agent.paused', payload));
  deps.eventBus.on('task.created', (payload) => forward('task.created', payload));
  deps.eventBus.on('task.status.updated', (payload) => forward('task.status.updated', payload));
  deps.eventBus.on('approval.requested', (payload) => forward('approval.requested', payload));
  deps.eventBus.on('approval.decided', (payload) => forward('approval.decided', payload));

  app.addHook('onClose', async () => {
    for (const client of clients) {
      client.close();
    }
    clients.clear();
  });
}
