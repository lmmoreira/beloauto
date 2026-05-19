import { z } from 'zod';

export const InviteStaffSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['MANAGER', 'STAFF']),
  invitedBy: z.string().uuid(),
});

export type InviteStaffDto = z.infer<typeof InviteStaffSchema>;
