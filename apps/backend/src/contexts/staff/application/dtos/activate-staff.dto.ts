import { z } from 'zod';

export const ActivateStaffSchema = z.object({
  tenantId: z.uuid(),
  googleOAuthId: z.string().min(1),
  email: z.string().min(1),
});

// HTTP request body (staffId comes from the URL path param)
export type ActivateStaffRequestDto = z.infer<typeof ActivateStaffSchema>;

// Full use-case input = request body + staffId from path param
export interface ActivateStaffDto extends ActivateStaffRequestDto {
  staffId: string;
}
