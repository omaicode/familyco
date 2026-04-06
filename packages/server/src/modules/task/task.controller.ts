import { ApprovalGuard, type ApprovalService, type AuditService, type TaskService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import {
  bulkUpdateTasksSchema,
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskPriorityBodySchema,
  updateTaskPriorityParamsSchema,
  updateTaskStatusBodySchema,
  updateTaskStatusParamsSchema
} from './task.schema.js';

export interface TaskModuleDeps {
  taskService: TaskService;
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

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.create',
      targetId: body.projectId,
      payload: {
        assigneeAgentId: body.assigneeAgentId,
        createdBy: body.createdBy,
        priority: body.priority,
        title: body.title
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? body.createdBy,
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

    const task = await deps.taskService.createTask(body);
    await deps.auditService.write({
      actorId: body.createdBy,
      action: 'task.create',
      targetId: task.id,
      payload: {
        projectId: task.projectId,
        priority: task.priority
      }
    });

    reply.code(201);
    return task;
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
