import { z } from 'zod';

export const SubmitGuestBookingInfoBodySchema = z.object({
  bookingId: z.uuid(),
  contactEmail: z.email(),
  response: z.string().trim().min(1),
  photoUrls: z
    .array(z.string().regex(/^tenants\/[^/]+\/(uploads|bookings)\/[^/]+\/.+$/))
    .optional(),
});

export type SubmitGuestBookingInfoDto = z.infer<typeof SubmitGuestBookingInfoBodySchema>;
