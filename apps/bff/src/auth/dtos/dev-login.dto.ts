import { z } from 'zod';

export const DevLoginSchema = z.object({
  email: z.email(),
  tenantSlug: z.string().min(1),
  type: z.enum(['staff', 'customer']),
});

export type DevLoginDto = z.infer<typeof DevLoginSchema>;

export interface DevLoginResponse {
  accessToken: string;
  user: {
    sub: string;
    tenantId: string;
    tenantSlug: string;
    role: 'CUSTOMER' | 'STAFF' | 'MANAGER';
  };
}
