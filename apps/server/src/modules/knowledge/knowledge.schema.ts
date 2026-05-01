import { z } from 'zod';

export const knowledgeDocumentParamsSchema = z.object({
  id: z.string().min(1)
});

export const knowledgeDocumentQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z.enum(['uploaded', 'indexing', 'indexed', 'failed']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional()
});

export const knowledgeIndexBodySchema = z.object({
  commandId: z.string().min(1).optional(),
  maxChars: z.coerce.number().int().min(400).max(4000).optional(),
  overlapChars: z.coerce.number().int().min(0).max(1600).optional()
});

export const knowledgeRetrieveBodySchema = z.object({
  query: z.string().min(1),
  topK: z.coerce.number().int().positive().max(50).optional(),
  minScore: z.coerce.number().min(-1).max(1).optional(),
  projectId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional()
});
