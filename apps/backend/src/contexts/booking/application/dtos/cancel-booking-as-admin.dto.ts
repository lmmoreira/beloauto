import { z } from 'zod';

export const CancelBookingAsAdminBodySchema = z
  .object({
    reason: z.string().min(1).optional(),
  })
  .default({});

export type CancelBookingAsAdminBody = z.infer<typeof CancelBookingAsAdminBodySchema>;

// Full DTO used by the use case (bookingId comes from @Param in the controller)
export interface CancelBookingAsAdminDto {
  bookingId: string;
  reason?: string;
}
