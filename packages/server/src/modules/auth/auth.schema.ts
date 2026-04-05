import { z } from 'zod';

export const createTokenSchema = z.object({
  apiKey: z.string().min(1),
  agentId: z.string().min(1).optional()
});

export const revokeApiKeySchema = z.object({
  apiKey: z.string().min(1)
});

export const createApiKeySchema = z.object({
  name: z.string().min(1),
  apiKey: z.string().min(1)
});

export const rotateApiKeySchema = z.object({
  name: z.string().min(1),
  currentApiKey: z.string().min(1),
  newApiKey: z.string().min(1)
});
