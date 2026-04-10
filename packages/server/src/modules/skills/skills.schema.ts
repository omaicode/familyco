import { z } from 'zod';

export const skillParamsSchema = z.object({
  id: z.string().min(1)
});

