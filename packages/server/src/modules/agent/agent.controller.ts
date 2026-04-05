import type { AgentService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { createAgentSchema, pauseAgentParamsSchema } from './agent.schema.js';

export interface AgentModuleDeps {
  agentService: AgentService;
}

export function registerAgentController(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents', async () => {
    return deps.agentService.listAgents();
  });

  app.post('/agents', async (request, reply) => {
    const body = createAgentSchema.parse(request.body);
    const agent = await deps.agentService.createAgent(body);

    reply.code(201);
    return agent;
  });

  app.post('/agents/:id/pause', async (request) => {
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.pauseAgent(id);
  });
}
