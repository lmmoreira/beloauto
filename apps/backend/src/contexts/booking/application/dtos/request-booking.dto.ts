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

export const RequestBookingSchema = z.object({
  guestEmail: z.email(),
  guestName: z.string().min(1),
  guestPhone: z.string().refine((v) => {
    const d = v.replace(/\D/g, '');
    return d.length === 10 || d.length === 11;
  }, 'guestPhone must have 10 or 11 digits'),
  guestAddress: AddressSchema.optional(),
  pickupAddress: AddressSchema.optional(),
  scheduledAt: z.iso.datetime(),
  serviceIds: z.array(z.uuid()).min(1),
  beforeServicePhotoUrls: z.array(z.url()).optional(),
});

export type RequestBookingDto = z.infer<typeof RequestBookingSchema>;
