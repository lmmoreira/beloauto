import { z } from 'zod';

export const SubmitBookingInfoBodySchema = z.object({
  bookingId: z.uuid(),
  response: z.string().trim().min(1),
  photoUrls: z.array(z.url()).optional(),
});

export type SubmitBookingInfoDto = z.infer<typeof SubmitBookingInfoBodySchema>;
