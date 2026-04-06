import { z } from 'zod';

export const initializeSetupSchema = z.object({
  companyName: z.string().min(1),
  companyMission: z.string().optional().default(''),
  companyDirection: z.string().optional().default('')
});
