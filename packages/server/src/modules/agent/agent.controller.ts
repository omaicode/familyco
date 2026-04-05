import { ApprovalGuard, type AgentService, type ApprovalService, type AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { createAgentSchema, pauseAgentParamsSchema } from './agent.schema.js';

export interface AgentModuleDeps {
  agentService: AgentService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
}

export function registerAgentController(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.agentService.listAgents();
  });

  app.post('/agents', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = createAgentSchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.create',
      payload: {
        level: body.level,
        department: body.department,
        role: body.role
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'agent.create'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const agent = await deps.agentService.createAgent(body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
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

  app.post('/agents/:id/pause', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.pause',
      targetId: id,
      payload: {
        status: 'paused'
      }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const pausedAgent = await deps.agentService.pauseAgent(id);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.pause',
      targetId: pausedAgent.id,
      payload: {
        status: pausedAgent.status
      }
    });

    return pausedAgent;
  });
}
