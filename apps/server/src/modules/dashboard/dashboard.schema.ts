import { z } from 'zod';

export const dashboardSummaryQuerySchema = z.object({
  projectId: z.string().min(1).optional()
});

export const dashboardSidebarCountsSchema = z.object({
  agents: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  tasks: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative()
});
