import type { AuditService, TaskService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskStatusBodySchema,
  updateTaskStatusParamsSchema
} from './task.schema.js';

export interface TaskModuleDeps {
  taskService: TaskService;
  auditService: AuditService;
}

export function registerTaskController(app: FastifyInstance, deps: TaskModuleDeps): void {
  app.get('/tasks', async (request) => {
    const { projectId } = listTasksQuerySchema.parse(request.query);
    return deps.taskService.listProjectTasks(projectId);
  });

  app.post('/tasks', async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const task = await deps.taskService.createTask(body);
    await deps.auditService.write({
      actorId: body.createdBy,
      action: 'task.create',
      targetId: task.id,
      payload: {
        projectId: task.projectId
      }
    });

    reply.code(201);
    return task;
  });

  app.post('/tasks/:id/status', async (request) => {
    const { id } = updateTaskStatusParamsSchema.parse(request.params);
    const { status } = updateTaskStatusBodySchema.parse(request.body);
    const updatedTask = await deps.taskService.updateTaskStatus(id, status);
    await deps.auditService.write({
      actorId: 'system',
      action: 'task.status.update',
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status
      }
    });

    return updatedTask;
  });
}
