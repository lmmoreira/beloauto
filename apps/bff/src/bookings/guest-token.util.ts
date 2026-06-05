import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

export const GuestTokenPayloadSchema = z.object({
  bookingId: z.string(),
  tenantId: z.string(),
  contactEmail: z.email(),
});

export type GuestTokenPayload = z.infer<typeof GuestTokenPayloadSchema>;

/**
 * Verifies a JWT signature and returns the raw decoded payload, or null if invalid/expired.
 * Schema-agnostic — use the typed helpers below for guest tokens.
 */
export function tryDecodeRawJwt(token: string, secret: string): unknown | null {
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Verifies a guest JWT and returns its payload, or null if invalid/expired.
 * Does NOT throw — use verifyGuestTokenOrThrow for that.
 */
export function tryVerifyGuestToken(token: string, secret: string): GuestTokenPayload | null {
  try {
    const raw = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const parsed = GuestTokenPayloadSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Verifies a guest JWT and returns its payload.
 * Returns null when the token is absent or structurally invalid.
 * Returns false when the token is present but fails verification (expired / bad signature).
 */
export function verifyGuestToken(token: string, secret: string): GuestTokenPayload | false {
  let raw: unknown;
  try {
    raw = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return false;
  }
  const parsed = GuestTokenPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : false;
}
