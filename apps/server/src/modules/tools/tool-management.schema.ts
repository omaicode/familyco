import { z } from 'zod';

export const toolNameParamsSchema = z.object({
  name: z.string().min(1)
});

export const toolCustomFieldsUpdateSchema = z.object({
  customFieldValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
});
