import { z } from 'zod';

export const RescheduleBookingBodySchema = z.object({
  scheduledAt: z.iso.datetime(),
  adminNotes: z.string().trim().min(1).max(500).optional(),
});

export type RescheduleBookingBody = z.infer<typeof RescheduleBookingBodySchema>;

export interface RescheduleBookingDto {
  bookingId: string;
  scheduledAt: string;
  adminNotes?: string;
}
