import { z } from 'zod';

export const createApprovalSchema = z.object({
  actorId: z.string().min(1),
  action: z.string().min(1),
  targetId: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const decideApprovalParamsSchema = z.object({
  id: z.string().min(1)
});

export const decideApprovalBodySchema = z.object({
  status: z.enum(['approved', 'rejected'])
});
