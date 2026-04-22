import { z } from 'zod';

export const testProviderSchema = z.object({
  adapterId: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().optional()
});

export const connectProviderSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1)
});

export const connectProviderOAuthSchema = z.object({
  candidateTokens: z.array(z.string().min(1)).min(1),
  model: z.string().min(1)
});

export const selectProviderSchema = z.object({
  model: z.string().min(1)
});
