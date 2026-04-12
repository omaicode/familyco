import { z } from 'zod';

export const initializeSetupSchema = z.object({
  companyName: z.string().min(1),
  companyDescription: z.string().optional().default('')
});
