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

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
export type PauseAgentParamsDto = z.infer<typeof pauseAgentParamsSchema>;
