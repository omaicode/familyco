import { z } from 'zod';

export const testProviderSchema = z.object({
  adapterId: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().optional()
});
