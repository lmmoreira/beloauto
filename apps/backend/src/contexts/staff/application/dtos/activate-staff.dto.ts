import { z } from 'zod';

export const ActivateStaffSchema = z.object({
  tenantId: z.uuid(),
  googleOAuthId: z.string().min(1),
  email: z.string().min(1),
});

export type ActivateStaffRequestDto = z.infer<typeof ActivateStaffSchema>;
