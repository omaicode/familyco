import {
  ApprovalGuard,
  type AgentService,
  type ApprovalService,
  type AuditRecord,
  type AuditService,
  type ProjectService,
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
