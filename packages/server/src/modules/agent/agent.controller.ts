import {
  ApprovalGuard,
  FounderCommandService,
  type AgentService,
  type ApprovalService,
  type AuditService,
  type InboxService,
  type ProjectService,
  type SettingsService,
  type TaskService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { resolveDefaultProjectId } from '../shared/defaults.js';
import {
  agentChatBodySchema,
  createAgentSchema,
  pauseAgentParamsSchema,
  updateParentBodySchema,
  updateParentParamsSchema
} from './agent.schema.js';

export interface AgentModuleDeps {
  agentService: AgentService;
  taskService: TaskService;
  projectService: ProjectService;
  settingsService: SettingsService;
  inboxService: InboxService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  founderCommandService: FounderCommandService;
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

  app.get('/agents/:id/chat', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    await deps.agentService.getAgentById(id);

    const inboundToAgent = await deps.inboxService.listMessages({ recipientId: id, limit: 100 });
    const founderInbox = await deps.inboxService.listMessages({ recipientId: 'founder', limit: 200 });

    return [...inboundToAgent, ...founderInbox.filter((message) => message.senderId === id)]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((message) => ({
        ...message,
        direction: message.senderId === id ? 'agent_to_founder' : 'founder_to_agent'
      }));
  });

  app.post('/agents/:id/chat', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const body = agentChatBodySchema.parse(request.body);
    const agent = await deps.agentService.getAgentById(id);

    const founderMessage = await deps.inboxService.createMessage({
      recipientId: agent.id,
      senderId: 'founder',
      type: 'info',
      title: buildChatTitle(body.message),
      body: body.message,
      payload: {
        meta: body.meta ?? null
      }
    });

    const plan = deps.founderCommandService.planResponse({
      agent,
      message: body.message,
      meta: body.meta
    });

    let createdTask: Awaited<ReturnType<TaskService['createTask']>> | null = null;
    let approvalRequest: Awaited<ReturnType<ApprovalService['createApprovalRequest']>> | null = null;

    if (plan.shouldCreateTask) {
      const projectId =
        body.meta?.projectId ??
        (await resolveDefaultProjectId({
          agentService: deps.agentService,
          projectService: deps.projectService,
          settingsService: deps.settingsService
        }));

      createdTask = await deps.taskService.createTask({
        title: plan.taskTitle ?? buildChatTitle(body.message),
        description: plan.taskDescription ?? body.message,
        projectId,
        assigneeAgentId: agent.id,
        createdBy: agent.id
      });
    }

    if (plan.requestedTemplate && agent.level === 'L0') {
      approvalRequest = await deps.approvalService.createApprovalRequest({
        actorId: agent.id,
        action: 'create_agent',
        targetId: agent.id,
        payload: {
          templateId: plan.requestedTemplate.id,
          name: plan.requestedTemplate.name,
          role: plan.requestedTemplate.role,
          level: plan.requestedTemplate.level,
          department: plan.requestedTemplate.department,
          parentAgentId: agent.id,
          tools: plan.requestedTemplate.tools,
          approvalMode: plan.requestedTemplate.approvalMode,
          rationale: plan.requestedTemplate.rationale
        }
      });

      await deps.inboxService.createMessage({
        recipientId: 'founder',
        senderId: agent.id,
        type: 'approval',
        title: `Agent proposal: ${plan.requestedTemplate.name}`,
        body: `${agent.name} recommends adding ${plan.requestedTemplate.name} for ${plan.requestedTemplate.department}.`,
        payload: {
          approvalId: approvalRequest.id,
          action: approvalRequest.action,
          templateId: plan.requestedTemplate.id
        }
      });
    }

    const replySegments = [plan.reply];
    if (createdTask) {
      replySegments.push(`Task ${createdTask.title} is now pending.`);
    }
    if (approvalRequest) {
      replySegments.push(`Approval request ${approvalRequest.id} is waiting in the Inbox.`);
    }
    const replyText = replySegments.join(' ');

    const replyMessage = await deps.inboxService.createMessage({
      recipientId: 'founder',
      senderId: agent.id,
      type: createdTask || approvalRequest ? 'report' : 'info',
      title: `Reply from ${agent.name}`,
      body: replyText,
      payload: {
        taskId: createdTask?.id,
        approvalId: approvalRequest?.id
      }
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'founder',
      action: 'agent.chat',
      targetId: agent.id,
      payload: {
        founderMessageId: founderMessage.id,
        replyMessageId: replyMessage.id,
        createdTaskId: createdTask?.id,
        approvalRequestId: approvalRequest?.id
      }
    });

    reply.code(201);
    return {
      founderMessage,
      replyMessage,
      reply: replyText,
      task: createdTask,
      approvalRequest
    };
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
}

function buildChatTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
}
