import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ownerAgentId: z.string().min(1),
  parentProjectId: z.string().min(1).nullable().optional()
});
