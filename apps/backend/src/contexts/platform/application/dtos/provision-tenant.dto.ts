import { z } from 'zod';

const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const isValidEmail = (val: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

export const ProvisionTenantSchema = z.object({
  name: z.string().min(1, { message: 'name must not be empty' }),
  slug: z.string().regex(/^[a-z0-9-]+$/, {
    message: 'slug must only contain lowercase letters, numbers, and hyphens',
  }),
  adminEmail: z.string().refine(isValidEmail, { message: 'adminEmail must be a valid email' }),
  timezone: z
    .string()
    .refine(isValidTimezone, { message: 'timezone must be a valid IANA timezone' })
    .optional(),
});

export type ProvisionTenantDto = z.infer<typeof ProvisionTenantSchema>;
