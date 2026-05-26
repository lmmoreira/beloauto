import { z } from 'zod';

export const RejectBookingBodySchema = z.object({
  reason: z.string().trim().min(10),
});

export type RejectBookingBody = z.infer<typeof RejectBookingBodySchema>;

export interface RejectBookingDto {
  bookingId: string;
  reason: string;
}

export interface RejectBookingUseCaseResult {
  bookingId: string;
  status: string;
  rejectedAt: string;
}
