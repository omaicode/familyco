import { z } from 'zod';

export const listInboxQuerySchema = z.object({
  recipientId: z.string().min(1),
  type: z.enum(['approval', 'report', 'alert', 'info']).optional(),
  status: z.enum(['unread', 'read', 'archived']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const createInboxSchema = z.object({
  recipientId: z.string().min(1),
  senderId: z.string().min(1),
  type: z.enum(['approval', 'report', 'alert', 'info']),
  title: z.string().min(1),
  body: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const inboxMessageParamsSchema = z.object({
  id: z.string().min(1)
});

export const respondInboxBodySchema = z.object({
  responseText: z.string().trim().min(1)
});
