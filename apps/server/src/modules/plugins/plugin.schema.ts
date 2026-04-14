import { z } from 'zod';

export const pluginParamsSchema = z.object({
  id: z.string().min(1)
});

export const pluginUpdateApprovalSchema = z.object({
  approvalMode: z.enum(['auto', 'suggest_only', 'require_review'])
});
