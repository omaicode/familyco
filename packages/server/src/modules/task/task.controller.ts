import type { TaskService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskStatusBodySchema,
  updateTaskStatusParamsSchema
} from './task.schema.js';

export interface TaskModuleDeps {
  taskService: TaskService;
}

export function registerTaskController(app: FastifyInstance, deps: TaskModuleDeps): void {
  app.get('/tasks', async (request) => {
    const { projectId } = listTasksQuerySchema.parse(request.query);
    return deps.taskService.listProjectTasks(projectId);
  });

  app.post('/tasks', async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const task = await deps.taskService.createTask(body);

    reply.code(201);
    return task;
  });

  app.post('/tasks/:id/status', async (request) => {
    const { id } = updateTaskStatusParamsSchema.parse(request.params);
    const { status } = updateTaskStatusBodySchema.parse(request.body);

    return deps.taskService.updateTaskStatus(id, status);
  });
}
