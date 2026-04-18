import { z } from 'zod';

export const toolNameParamsSchema = z.object({
  name: z.string().min(1)
});
