import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{8}$/, 'zipCode must be 8 digits'),
});

export const RequestAuthenticatedBookingSchema = z.object({
  scheduledAt: z.iso.datetime(),
  serviceIds: z.array(z.uuid()).min(1),
  pickupAddress: AddressSchema.optional(),
  beforeServicePhotoUrls: z.array(z.url()).optional(),
});

export type RequestAuthenticatedBookingDto = z.infer<typeof RequestAuthenticatedBookingSchema>;
