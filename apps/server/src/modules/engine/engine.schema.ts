import { z } from 'zod';

export const enqueueAgentRunSchema = z.object({
  agentId: z.string().min(1),
  input: z.string().min(1),
  approvalMode: z.enum(['auto', 'suggest_only', 'require_review']),
  action: z.string().min(1),
  toolName: z.string().min(1),
  toolArguments: z.record(z.string(), z.unknown()),
  targetId: z.string().min(1).optional()
});

export const enqueueToolRunSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.string(), z.unknown())
});

export const listAgentRunsQuerySchema = z.object({
  rootAgentId: z.string().min(1).optional(),
  state: z
    .enum(['queued', 'planning', 'waiting_approval', 'executing', 'completed', 'failed', 'cancelled'])
    .optional(),
  triggerType: z.enum(['founder_chat', 'task_execution', 'retry', 'approval_resume', 'schedule']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const agentRunIdParamsSchema = z.object({
  runId: z.string().min(1)
});
