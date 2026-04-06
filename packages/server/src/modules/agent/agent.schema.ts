import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  level: z.enum(['L0', 'L1', 'L2']),
  department: z.string().min(1),
  parentAgentId: z.string().min(1).nullable().optional()
});

export const pauseAgentParamsSchema = z.object({
  id: z.string().min(1)
});

export const updateParentParamsSchema = z.object({
  id: z.string().min(1)
});

export const updateParentBodySchema = z.object({
  parentAgentId: z.string().min(1).nullable()
});

const chatToolRequestSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional().default({})
});

export const agentChatBodySchema = z.object({
  message: z.string().min(1),
  meta: z
    .object({
      projectId: z.string().min(1).optional(),
      taskId: z.string().min(1).optional(),
      toolCall: chatToolRequestSchema.optional(),
      toolCalls: z.array(chatToolRequestSchema).optional()
    })
    .optional()
});

export const agentChatQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(200),
  before: z.string().datetime().optional()
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
export type PauseAgentParamsDto = z.infer<typeof pauseAgentParamsSchema>;
