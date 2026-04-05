import type { AgentService, AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { createAgentSchema, pauseAgentParamsSchema } from './agent.schema.js';

export interface AgentModuleDeps {
  agentService: AgentService;
  auditService: AuditService;
}

export function registerAgentController(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents', async () => {
    return deps.agentService.listAgents();
  });

  app.post('/agents', async (request, reply) => {
    const body = createAgentSchema.parse(request.body);
    const agent = await deps.agentService.createAgent(body);
    await deps.auditService.write({
      actorId: 'system',
      action: 'agent.create',
      targetId: agent.id,
      payload: {
        level: agent.level,
        department: agent.department
      }
    });

    reply.code(201);
    return agent;
  });

  app.post('/agents/:id/pause', async (request) => {
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const pausedAgent = await deps.agentService.pauseAgent(id);
    await deps.auditService.write({
      actorId: 'system',
      action: 'agent.pause',
      targetId: pausedAgent.id,
      payload: {
        status: pausedAgent.status
      }
    });

    return pausedAgent;
  });
}
