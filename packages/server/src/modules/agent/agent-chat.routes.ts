import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { agentChatBodySchema, agentChatQuerySchema, pauseAgentParamsSchema } from './agent.schema.js';
import { handleSocketChatMessage, processAgentChat, resolveSocketClient, sendSocketEvent, toErrorMessage } from './agent-chat.service.js';
import { buildAgentSlashRegistry } from './agent-chat.registry.js';
import type { AgentModuleDeps } from './agent.types.js';

export function registerAgentChatRoutes(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents/:id/chat', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const { limit, before } = agentChatQuerySchema.parse(request.query);
    await deps.agentService.getAgentById(id);

    const conversation = await deps.inboxService.listConversation(
      id,
      limit,
      'founder',
      before ? new Date(before) : undefined
    );

    return conversation.map((message) => ({
      ...message,
      direction: message.senderId === id ? 'agent_to_founder' : 'founder_to_agent'
    }));
  });

  app.post('/agents/:id/chat', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const body = agentChatBodySchema.parse(request.body);

    const result = await processAgentChat({
      agentId: id,
      body,
      deps,
      actorId: request.authContext?.subject ?? 'founder'
    });

    reply.code(201);
    return result;
  });

  app.get('/agents/:id/chat/stream', { websocket: true }, (connection, request) => {
    const socket = resolveSocketClient(connection);

    try {
      requireMinimumLevel(request, 'L0');
      const { id } = pauseAgentParamsSchema.parse(request.params);

      void deps.agentService.getAgentById(id).then(() => {
        // Re-attach if there's an active stream for this agent (client reconnected mid-stream).
        // The proxy is repointed to the new socket so remaining events continue flowing.
        const resumedRequestId = deps.chatStreamRegistry.reattach(id, socket);

        if (resumedRequestId) {
          sendSocketEvent(socket, 'chat.resumed', { requestId: resumedRequestId });
        } else {
          sendSocketEvent(socket, 'chat.ready', { agentId: id });
        }
      }).catch((error) => {
        sendSocketEvent(socket, 'chat.error', { message: toErrorMessage(error) });
        socket.close();
      });

      socket.on('message', (raw: unknown) => {
        void handleSocketChatMessage({
          raw: String(raw),
          socket,
          agentId: id,
          deps,
          actorId: request.authContext?.subject ?? 'founder'
        });
      });
    } catch (error) {
      sendSocketEvent(socket, 'chat.error', { message: toErrorMessage(error) });
      socket.close();
    }
  });

  app.get('/agents/:id/slash-commands', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const agent = await deps.agentService.getAgentById(id);
    const registry = buildAgentSlashRegistry();

    return registry.listForLevel(agent.level).map((definition) => ({
      command: `/${definition.name}`,
      label: definition.name,
      description: definition.description,
      insertValue: definition.insertValue,
      levels: definition.levels
    }));
  });
}
