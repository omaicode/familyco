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
