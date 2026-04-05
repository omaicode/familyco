import { z } from 'zod';

export const createTokenSchema = z.object({
  apiKey: z.string().min(1)
});
