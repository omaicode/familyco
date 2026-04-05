import { ApprovalGuard, type ApprovalService, type AuditService, type QueueService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import type { DailyQuotaGuard } from '../shared/daily-quota.guard.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { enqueueAgentRunSchema, enqueueToolRunSchema } from './engine.schema.js';

export interface EngineModuleDeps {
  queueService: QueueService;
  auditService: AuditService;
  approvalService: ApprovalService;
  approvalGuard: ApprovalGuard;
  dailyQuotaGuard: DailyQuotaGuard;
}

export function registerEngineController(app: FastifyInstance, deps: EngineModuleDeps): void {
  app.get('/engine/jobs', async (request) => {
    requireMinimumLevel(request, 'L1');
    const jobs = await deps.queueService.listPendingJobs();

    return {
      total: jobs.length,
      jobs
    };
  });

  app.post('/engine/agent-runs', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = enqueueAgentRunSchema.parse(request.body);
    deps.dailyQuotaGuard.consume(request.authContext?.subject ?? body.agentId);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'engine.agent.run.enqueue',
      targetId: body.agentId,
      payload: {
        toolName: body.toolName,
        action: body.action
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? body.agentId,
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'engine.agent.run.enqueue'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

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
    deps.dailyQuotaGuard.consume(request.authContext?.subject ?? 'system');

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'engine.tool.run.enqueue',
      payload: {
        toolName: body.toolName
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'engine.tool.run.enqueue'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

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
