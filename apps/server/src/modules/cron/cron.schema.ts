import { z } from 'zod';

export const cronParamsSchema = z.object({
  id: z.string().min(1)
});

export const listCronRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const createCronBodySchema = z.object({
  name: z.string().min(1).max(120),
  prompt: z.string().min(1),
  schedule: z.string().min(1),
  agentId: z.string().min(1).optional(),
  enabled: z.boolean().optional()
});

export const updateCronBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).optional(),
  schedule: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  sessionId: z.string().min(1).nullable().optional()
});
