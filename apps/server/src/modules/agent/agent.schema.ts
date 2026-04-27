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

export const updateAgentParamsSchema = z.object({
  id: z.string().min(1)
});

export const updateAgentBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    department: z.string().min(1).optional(),
    status: z.enum(['active', 'idle', 'running', 'error', 'paused', 'terminated', 'archived']).optional(),
    aiAdapterId: z.enum(['openai', 'openrouter', 'claude', 'vercel', 'deepseek']).nullable().optional(),
    aiModel: z.string().min(1).nullable().optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'At least one editable field is required'
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

const chatAttachmentRefSchema = z.object({
  id: z.string().min(1)
});

export const agentChatBodySchema = z.object({
  message: z.string().min(1),
  meta: z
    .object({
      sessionId: z.string().min(1).optional(),
      projectId: z.string().min(1).optional(),
      taskId: z.string().min(1).optional(),
      toolCall: chatToolRequestSchema.optional(),
      toolCalls: z.array(chatToolRequestSchema).optional(),
      attachments: z.array(chatAttachmentRefSchema).optional(),
      editedFromMessageId: z.string().min(1).optional(),
      supersedesMessageId: z.string().min(1).optional()
    })
    .optional()
});

export const agentChatQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(200),
  before: z.string().datetime().optional()
});

export const agentChatSessionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

export const createChatSessionBodySchema = z.object({
  title: z.string().min(1).max(96).optional()
});

export const agentChatAttachmentParamsSchema = z.object({
  id: z.string().min(1),
  attachmentId: z.string().min(1)
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
export type PauseAgentParamsDto = z.infer<typeof pauseAgentParamsSchema>;
