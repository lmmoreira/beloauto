import { z } from 'zod';

export const GenerateAttachmentSignedUrlSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((v) => !v.includes('/') && !v.includes('..'), {
      message: 'fileName must not contain path separators or ".."',
    }),
  contentType: z.enum(['image/jpeg', 'image/png']),
  bookingId: z.uuid().optional(),
});

export type GenerateAttachmentSignedUrlBody = z.infer<typeof GenerateAttachmentSignedUrlSchema>;

export interface GenerateAttachmentSignedUrlDto {
  fileName: string;
  contentType: 'image/jpeg' | 'image/png';
  bookingId?: string;
}
