import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  projectId: z.string().min(1),
  assigneeAgentId: z.string().min(1).nullable().optional(),
  createdBy: z.string().min(1)
});

export const listTasksQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'done', 'blocked', 'cancelled']).optional(),
  assigneeAgentId: z.string().min(1).optional(),
  q: z.string().min(1).optional()
});

export const updateTaskStatusParamsSchema = z.object({
  id: z.string().min(1)
});

export const updateTaskStatusBodySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'review', 'done', 'blocked', 'cancelled'])
});
