import { z } from 'zod';

export const IssueTokenSchema = z.object({
  selectionToken: z.string().min(1),
  tenantId: z.uuid(),
});

export type IssueTokenDto = z.infer<typeof IssueTokenSchema>;
