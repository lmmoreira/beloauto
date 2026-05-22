import { z } from 'zod';

export const GetAvailabilitySummarySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  serviceIds: z
    .string()
    .transform((s) => s.split(','))
    .pipe(z.array(z.uuid()).min(1, 'at least one serviceId is required')),
});

export type GetAvailabilitySummaryDto = z.infer<typeof GetAvailabilitySummarySchema>;
