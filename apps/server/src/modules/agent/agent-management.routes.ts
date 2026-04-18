import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import {
  createAgentSchema,
  pauseAgentParamsSchema,
  updateAgentBodySchema,
  updateAgentParamsSchema,
  updateParentBodySchema,
  updateParentParamsSchema
} from './agent.schema.js';
import type { AgentModuleDeps } from './agent.types.js';

export function registerAgentManagementRoutes(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.agentService.listAgents();
  });

  app.get('/agents/:id', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.getAgentById(id);
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
        name: body.name,
        role: body.role,
        level: body.level,
        department: body.department,
        parentAgentId: body.parentAgentId ?? null
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

    try {
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
    } catch (error) {
      return sendAgentCreateError(reply, error);
    }
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

  app.post('/agents/:id/resume', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.resume',
      targetId: id,
      payload: { status: 'active' }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const resumedAgent = await deps.agentService.setAgentStatus(id, 'active');
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.resume',
      targetId: resumedAgent.id,
      payload: { status: resumedAgent.status }
    });

    return resumedAgent;
  });

  app.post('/agents/:id/archive', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.archive',
      targetId: id,
      payload: { status: 'archived' }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const archivedAgent = await deps.agentService.setAgentStatus(id, 'archived');
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.archive',
      targetId: archivedAgent.id,
      payload: { status: archivedAgent.status }
    });

    return archivedAgent;
  });

  app.get('/agents/:id/children', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.getChildren(id);
  });

  app.get('/agents/:id/path', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.getPath(id);
  });

  app.patch('/agents/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = updateAgentParamsSchema.parse(request.params);
    const body = updateAgentBodySchema.parse(request.body);
    const updated = await deps.agentService.updateAgent(id, {
      name: body.name,
      role: body.role,
      department: body.department,
      status: body.status,
      aiAdapterId: body.aiAdapterId,
      aiModel: body.aiModel
    });
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.update',
      targetId: updated.id,
      payload: {
        name: updated.name,
        role: updated.role,
        department: updated.department,
        status: updated.status
      }
    });

    return updated;
  });

  app.patch('/agents/:id/parent', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = updateParentParamsSchema.parse(request.params);
    const body = updateParentBodySchema.parse(request.body);
    const updated = await deps.agentService.updateParent(id, body.parentAgentId);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.parent.update',
      targetId: updated.id,
      payload: {
        parentAgentId: updated.parentAgentId
      }
    });

    return updated;
  });

  app.delete('/agents/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.delete',
      targetId: id,
      payload: {
        agentId: id
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'agent.delete',
          agentId: id
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    try {
      const result = await deps.agentService.deleteAgent(id);
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'agent.delete',
        targetId: id,
        payload: {
          fallbackAgentId: result.fallbackAgentId,
          reassignedTaskCount: result.reassignedTaskCount,
          reassignedProjectCount: result.reassignedProjectCount,
          reassignedChildAgentCount: result.reassignedChildAgentCount
        }
      });

      return result;
    } catch (error) {
      return sendAgentDeleteError(reply, error);
    }
  });
}

function sendAgentDeleteError(reply: { code: (statusCode: number) => void }, error: unknown) {
  if (error instanceof Error && error.message.startsWith('AGENT_NOT_FOUND:')) {
    reply.code(404);
    return {
      statusCode: 404,
      code: 'AGENT_NOT_FOUND',
      message: 'Agent not found.'
    };
  }

  if (error instanceof Error && error.message === 'AGENT_DELETE_LAST_EXECUTIVE') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'AGENT_DELETE_LAST_EXECUTIVE',
      message: 'At least one active executive agent must remain in the company.'
    };
  }

  if (error instanceof Error && error.message === 'AGENT_DELETE_DEFAULT_EXECUTIVE') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'AGENT_DELETE_DEFAULT_EXECUTIVE',
      message: 'The default executive agent cannot be deleted.'
    };
  }

  if (error instanceof Error && error.message === 'AGENT_DELETE_FALLBACK_NOT_FOUND') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'AGENT_DELETE_FALLBACK_NOT_FOUND',
      message: 'No active executive agent is available to receive the reassigned work.'
    };
  }

  throw error;
}

function sendAgentCreateError(reply: { code: (statusCode: number) => void }, error: unknown) {
  if (error instanceof Error && error.message === 'AGENT_L0_ALREADY_EXISTS') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'AGENT_L0_ALREADY_EXISTS',
      message: 'Only one active L0 executive is allowed. Please create an L1 or L2 agent.'
    };
  }

  throw error;
}
