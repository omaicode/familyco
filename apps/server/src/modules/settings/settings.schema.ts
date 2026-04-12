import { z } from 'zod';

export const settingParamsSchema = z.object({
  key: z.string().min(1)
});

export const upsertSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown()
});
