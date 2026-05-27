import { z } from 'zod';

export const CancelBookingAsCustomerSchema = z.object({
  bookingId: z.uuid(),
});

export type CancelBookingAsCustomerDto = z.infer<typeof CancelBookingAsCustomerSchema>;
