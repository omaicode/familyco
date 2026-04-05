import type { AuditService, QueueService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { enqueueAgentRunSchema, enqueueToolRunSchema } from './engine.schema.js';

export interface EngineModuleDeps {
  queueService: QueueService;
  auditService: AuditService;
}

export function registerEngineController(app: FastifyInstance, deps: EngineModuleDeps): void {
  app.post('/engine/agent-runs', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = enqueueAgentRunSchema.parse(request.body);

    await deps.queueService.enqueue({
      type: 'agent.run',
      payload: {
        request: body
      }
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? body.agentId,
      action: 'engine.agent.run.enqueued',
      targetId: body.agentId,
      payload: {
        toolName: body.toolName,
        action: body.action
      }
    });

    reply.code(202);
    return {
      queued: true,
      type: 'agent.run'
    };
  });

  app.post('/engine/tool-runs', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = enqueueToolRunSchema.parse(request.body);

    await deps.queueService.enqueue({
      type: 'tool.execute',
      payload: {
        input: body
      }
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'engine.tool.run.enqueued',
      payload: {
        toolName: body.toolName
      }
    });

    reply.code(202);
    return {
      queued: true,
      type: 'tool.execute'
    };
  });
}
