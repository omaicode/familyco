import {
  ApprovalGuard,
  type AgentService,
  type ApprovalService,
  type AuditRecord,
  type AuditService,
  type ProjectService,
  type QueueService,
  type SettingsService,
  type TaskService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../shared/defaults.js';
import {
  bulkUpdateTasksSchema,
  createTaskCommentBodySchema,
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskBodySchema,
  updateTaskPriorityBodySchema,
  updateTaskPriorityParamsSchema,
  updateTaskStatusBodySchema,
  updateTaskStatusParamsSchema
} from './task.schema.js';

export interface TaskModuleDeps {
  taskService: TaskService;
  agentService: AgentService;
  projectService: ProjectService;
  settingsService: SettingsService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  queueService: QueueService;
}

export function registerTaskController(app: FastifyInstance, deps: TaskModuleDeps): void {
  app.get('/tasks', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { projectId, status, priority, assigneeAgentId, q } = listTasksQuerySchema.parse(request.query);
    return deps.taskService.listTasks({
      projectId,
      status,
      priority,
      assigneeAgentId,
      query: q
    });
  });

  app.get('/tasks/:id', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    return deps.taskService.getTask(id);
  });

  app.post('/tasks', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = createTaskSchema.parse(request.body);
    const executiveAgentId = await resolveExecutiveAgentId({
      agentService: deps.agentService,
      settingsService: deps.settingsService
    });
    const projectId =
      body.projectId ??
      (await resolveDefaultProjectId({
        agentService: deps.agentService,
        projectService: deps.projectService,
        settingsService: deps.settingsService
      }));
    const normalizedInput = {
      title: body.title,
      description: body.description,
      projectId,
      assigneeAgentId: body.assigneeAgentId ?? body.assignedToId ?? executiveAgentId,
      createdBy: body.createdBy ?? executiveAgentId,
      priority: body.priority
    };

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.create',
      targetId: normalizedInput.projectId,
      payload: {
        ...normalizedInput,
        dueAt: body.dueAt
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? normalizedInput.createdBy,
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'task.create'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const task = await deps.taskService.createTask(normalizedInput);
    await deps.auditService.write({
      actorId: normalizedInput.createdBy,
      action: 'task.create',
      targetId: task.id,
      payload: {
        projectId: task.projectId,
        priority: task.priority,
        assigneeAgentId: task.assigneeAgentId,
        dueAt: body.dueAt
      }
    });

    if (task.assigneeAgentId) {
      await deps.queueService.enqueue({
        type: 'task.execute',
        payload: { agentId: task.assigneeAgentId }
      }).catch(() => undefined);
    }

    reply.code(201);
    return task;
  });

  app.patch('/tasks/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    const body = updateTaskBodySchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.update',
      targetId: id,
      payload: body
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTask = await deps.taskService.updateTask(id, body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? body.createdBy,
      action: 'task.update',
      targetId: updatedTask.id,
      payload: {
        title: updatedTask.title,
        projectId: updatedTask.projectId,
        priority: updatedTask.priority,
        assigneeAgentId: updatedTask.assigneeAgentId
      }
    });

    if (updatedTask.assigneeAgentId) {
      await deps.queueService.enqueue({
        type: 'task.execute',
        payload: { agentId: updatedTask.assigneeAgentId }
      }).catch(() => undefined);
    }

    return updatedTask;
  });

  app.get('/tasks/:id/comments', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    await deps.taskService.getTask(id);

    const records = await deps.auditService.list({
      action: 'task.comment.added',
      targetId: id,
      limit: 100
    });

    return records
      .map(toTaskComment)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  });

  app.post('/tasks/:id/comments', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    const body = createTaskCommentBodySchema.parse(request.body);
    await deps.taskService.getTask(id);

    const comment = await deps.auditService.write({
      actorId: body.authorId,
      action: 'task.comment.added',
      targetId: id,
      payload: {
        body: body.body,
        authorType: body.authorType,
        authorLabel: body.authorLabel ?? body.authorId
      }
    });

    reply.code(201);
    return toTaskComment(comment);
  });

  app.get('/tasks/:id/activity', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    await deps.taskService.getTask(id);

    const ACTIVITY_ACTIONS = [
      'task.comment.added',
      'task.session.checkpoint',
      'approval.request.created',
      'approval.request.decided',
      'task.status.changed',
      'task.assigned'
    ];

    const allRecords = await Promise.all(
      ACTIVITY_ACTIONS.map((action) =>
        deps.auditService.list({ action, targetId: id, limit: 200 })
      )
    );

    const merged = allRecords
      .flat()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return merged.map(toTaskActivity);
  });

  app.delete('/tasks/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.delete',
      targetId: id,
      payload: {
        taskId: id
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

    const deletedTask = await deps.taskService.deleteTask(id);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.delete',
      targetId: deletedTask.id,
      payload: {
        projectId: deletedTask.projectId,
        title: deletedTask.title
      }
    });

    return {
      id: deletedTask.id
    };
  });

  app.post('/tasks/bulk', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = bulkUpdateTasksSchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.bulk.update',
      targetId: body.taskIds.join(','),
      payload: body
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTasks = await deps.taskService.bulkUpdateTasks(body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.bulk.update',
      targetId: body.taskIds.join(','),
      payload: body
    });

    return updatedTasks;
  });

  app.post('/tasks/:id/status', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = updateTaskStatusParamsSchema.parse(request.params);
    const { status } = updateTaskStatusBodySchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.status.update',
      targetId: id,
      payload: {
        status
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

    const updatedTask = await deps.taskService.updateTaskStatus(id, status);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.status.update',
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status
      }
    });

    if (
      (status === 'in_progress' || status === 'pending') &&
      updatedTask.assigneeAgentId
    ) {
      await deps.queueService.enqueue({
        type: 'task.execute',
        payload: { agentId: updatedTask.assigneeAgentId }
      }).catch(() => undefined);
    }

    return updatedTask;
  });

  app.post('/tasks/:id/priority', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = updateTaskPriorityParamsSchema.parse(request.params);
    const { priority } = updateTaskPriorityBodySchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.priority.update',
      targetId: id,
      payload: {
        priority
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

    const updatedTask = await deps.taskService.updateTaskPriority(id, priority);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.priority.update',
      targetId: updatedTask.id,
      payload: {
        priority: updatedTask.priority
      }
    });

    return updatedTask;
  });
}

function toTaskComment(record: AuditRecord) {
  const payload = record.payload ?? {};
  const body = typeof payload.body === 'string' ? payload.body : '';
  const authorType = payload.authorType === 'agent' ? 'agent' : 'human';
  const authorLabel = typeof payload.authorLabel === 'string' && payload.authorLabel.length > 0
    ? payload.authorLabel
    : record.actorId;

  return {
    id: record.id,
    taskId: record.targetId ?? '',
    body,
    authorId: record.actorId,
    authorType,
    authorLabel,
    createdAt: record.createdAt.toISOString()
  };
}

function toTaskActivity(record: AuditRecord) {
  const payload = record.payload ?? {};
  const taskId = record.targetId ?? '';
  const actorLabel = typeof payload.actorLabel === 'string' && payload.actorLabel.length > 0
    ? payload.actorLabel
    : record.actorId;

  let kind: string;
  let summary: string;
  let extra: Record<string, unknown> = {};

  switch (record.action) {
    case 'task.comment.added': {
      const body = typeof payload.body === 'string' ? payload.body : '';
      kind = 'comment';
      summary = body.slice(0, 200);
      extra = { body };
      break;
    }
    case 'task.session.checkpoint': {
      const status = typeof payload.status === 'string' ? payload.status : 'active';
      const index = typeof payload.checkpointIndex === 'number' ? payload.checkpointIndex : 0;
      const sess = typeof payload.summary === 'string' ? payload.summary : '';
      kind = 'session.checkpoint';
      summary = sess.length > 0 ? sess.slice(0, 200) : `Checkpoint #${index} — ${status}`;
      extra = { checkpointIndex: index, sessionStatus: status };
      break;
    }
    case 'approval.request.created': {
      const action = typeof payload.action === 'string' ? payload.action : '';
      kind = 'approval.created';
      summary = action.length > 0 ? `Approval requested: ${action}` : 'Approval requested';
      break;
    }
    case 'approval.request.decided': {
      const decision = payload.decision === 'approved' || payload.decision === 'rejected'
        ? payload.decision
        : undefined;
      kind = 'approval.decided';
      summary = decision ? `Approval ${decision}` : 'Approval decided';
      extra = { approvalDecision: decision };
      break;
    }
    case 'task.status.changed': {
      const from = typeof payload.from === 'string' ? payload.from : '';
      const to = typeof payload.to === 'string' ? payload.to : '';
      kind = 'status.changed';
      summary = from && to ? `Status: ${from} → ${to}` : 'Status changed';
      break;
    }
    case 'task.assigned': {
      const assignee = typeof payload.assigneeId === 'string' ? payload.assigneeId : '';
      kind = 'assigned';
      summary = assignee ? `Assigned to ${assignee}` : 'Task assigned';
      break;
    }
    default:
      kind = 'comment';
      summary = record.action;
  }

  return {
    id: record.id,
    kind,
    taskId,
    actorId: record.actorId,
    actorLabel,
    summary,
    createdAt: record.createdAt.toISOString(),
    ...extra
  };
}
