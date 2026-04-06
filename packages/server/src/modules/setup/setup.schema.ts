import { z } from 'zod';

export const initializeSetupSchema = z.object({
  companyName: z.string().min(1),
  departments: z.array(z.string().min(1)).optional().default([])
});
