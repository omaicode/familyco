import { z } from 'zod';

const taskStatusSchema = z.enum(['pending', 'in_progress', 'review', 'done', 'blocked', 'cancelled']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskReadinessRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('task_status'),
    taskId: z.string().trim().min(1),
    status: taskStatusSchema,
    description: z.string().trim().min(1).optional()
  })
]);

export const taskIdParamsSchema = z.object({
  id: z.string().min(1)
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  projectId: z.string().min(1).optional(),
  assigneeAgentId: z.string().min(1).nullable().optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  createdBy: z.string().min(1).optional(),
  priority: taskPrioritySchema.optional(),
  dependsOnTaskIds: z.array(z.string().trim().min(1)).optional(),
  readinessRules: z.array(taskReadinessRuleSchema).optional(),
  dueAt: z.string().min(1).optional()
});

export const updateTaskBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  projectId: z.string().min(1),
  assigneeAgentId: z.string().min(1).nullable().optional(),
  createdBy: z.string().min(1),
  priority: taskPrioritySchema,
  dependsOnTaskIds: z.array(z.string().trim().min(1)).optional(),
  readinessRules: z.array(taskReadinessRuleSchema).optional()
});

export const createTaskCommentBodySchema = z.object({
  body: z.string().trim().min(1),
  authorType: z.enum(['agent', 'human']),
  authorId: z.string().min(1),
  authorLabel: z.string().trim().min(1).optional()
});

export const listTasksQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeAgentId: z.string().min(1).optional(),
  q: z.string().min(1).optional()
});

export const updateTaskStatusParamsSchema = taskIdParamsSchema;

export const updateTaskStatusBodySchema = z.object({
  status: taskStatusSchema
});

export const updateTaskPriorityParamsSchema = taskIdParamsSchema;

export const updateTaskPriorityBodySchema = z.object({
  priority: taskPrioritySchema
});

export const bulkUpdateTasksSchema = z
  .object({
    taskIds: z.array(z.string().min(1)).min(1),
    action: z.enum(['update_status', 'update_priority']),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === 'update_status' && !value.status) {
      ctx.addIssue({
        code: 'custom',
        message: 'status is required for update_status'
      });
    }

    if (value.action === 'update_priority' && !value.priority) {
      ctx.addIssue({
        code: 'custom',
        message: 'priority is required for update_priority'
      });
    }
  });
