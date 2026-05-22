import { z } from 'zod';

export const GetAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  serviceIds: z
    .string()
    .transform((s) => s.split(','))
    .pipe(z.array(z.uuid()).min(1, 'at least one serviceId is required')),
});

export type GetAvailabilityDto = z.infer<typeof GetAvailabilitySchema>;
