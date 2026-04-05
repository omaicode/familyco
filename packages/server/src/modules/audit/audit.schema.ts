import { z } from 'zod';

export const listAuditQuerySchema = z.object({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
