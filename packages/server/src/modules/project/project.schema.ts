import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ownerAgentId: z.string().min(1),
  parentProjectId: z.string().min(1).nullable().optional()
});

export const updateProjectSchema = createProjectSchema;

export const projectParamsSchema = z.object({
  id: z.string().min(1)
});
