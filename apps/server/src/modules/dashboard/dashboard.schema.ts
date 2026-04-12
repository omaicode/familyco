import { z } from 'zod';

export const dashboardSummaryQuerySchema = z.object({
  projectId: z.string().min(1).optional()
});
