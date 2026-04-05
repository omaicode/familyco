import { z } from 'zod';

export const createTokenSchema = z.object({
  apiKey: z.string().min(1),
  agentId: z.string().min(1).optional()
});

export const revokeApiKeySchema = z.object({
  apiKey: z.string().min(1)
});
