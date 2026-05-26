import { z } from 'zod';

export const RequestMoreInfoBodySchema = z.object({
  bookingId: z.uuid(),
  message: z.string().trim().min(20),
});

export type RequestMoreInfoDto = z.infer<typeof RequestMoreInfoBodySchema>;
