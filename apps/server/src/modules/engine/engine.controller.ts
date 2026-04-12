import { createRunLifecycle } from '@familyco/agent-runtime';
import {
  ApprovalGuard,
  type AgentRunService,
  type ApprovalService,
  type AuditService,
  type QueueService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import type { DailyQuotaGuard } from '../shared/daily-quota.guard.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import {
  agentRunIdParamsSchema,
  enqueueAgentRunSchema,
  enqueueToolRunSchema,
  listAgentRunsQuerySchema
} from './engine.schema.js';

export interface EngineModuleDeps {
  queueService: QueueService;
  auditService: AuditService;
  approvalService: ApprovalService;
  approvalGuard: ApprovalGuard;
  dailyQuotaGuard: DailyQuotaGuard;
  agentRunService: AgentRunService;
}

export function registerEngineController(app: FastifyInstance, deps: EngineModuleDeps): void {
  const runLifecycle = createRunLifecycle('queued');

  app.get('/engine/agent-runs', async (request) => {
    requireMinimumLevel(request, 'L1');
    const query = listAgentRunsQuerySchema.parse(request.query);

    return deps.agentRunService.list({
      rootAgentId: query.rootAgentId,
      state: query.state,
      triggerType: query.triggerType,
      limit: query.limit,
      offset: query.offset
    });
  });

  app.get('/engine/agent-runs/:runId', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { runId } = agentRunIdParamsSchema.parse(request.params);
    const run = await deps.agentRunService.getById(runId);

    if (!run) {
      reply.code(404);
      return {
        statusCode: 404,
        code: 'AGENT_RUN_NOT_FOUND',
        message: 'Agent run not found.'
      };
    }

    return run;
  });

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
        reason: approval.reason,
        runtimeState: 'waiting_approval'
      };
    }

    const run = await deps.agentRunService.createRun({
      rootAgentId: body.agentId,
      triggerType: 'founder_chat',
      state: 'queued',
      inputSummary: body.input.slice(0, 500),
      linkedTaskId: body.action === 'task.execute' ? body.targetId ?? null : null,
      linkedProjectId: body.action.startsWith('project.') ? body.targetId ?? null : null
    });

    await deps.queueService.enqueue({
      type: 'agent.run',
      payload: {
        request: {
          ...body,
          runId: run.id
        }
      }
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? body.agentId,
      action: 'engine.agent.run.enqueued',
      targetId: run.id,
      payload: {
        runId: run.id,
        toolName: body.toolName,
        action: body.action
      }
    });

    reply.code(202);
    return {
      queued: true,
      type: 'agent.run',
      runtimeState: runLifecycle.current,
      runId: run.id
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
        reason: approval.reason,
        runtimeState: 'waiting_approval'
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
      type: 'tool.execute',
      runtimeState: runLifecycle.current
    };
  });
}
