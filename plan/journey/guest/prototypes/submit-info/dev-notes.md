# Dev Notes — GUEST: Responder à Solicitação de Informação

## Overview

New standalone public page (`/bookings/[id]/submit-info`) that allows a guest (or authenticated customer via a separate path) to respond to an admin's info request. Backend and BFF are fully implemented (M08-S04/S05). This story creates only the frontend page and updates one backend string.

## File map

| File | Status | Action |
|---|---|---|
| `apps/web/app/bookings/[id]/submit-info/page.tsx` | ❌ GAP | Create — new route |
| `apps/web/components/booking/SubmitInfoForm.tsx` | ❌ GAP | Create — client component |
| `apps/backend/src/contexts/notification/application/use-cases/send-booking-info-requested-notification/send-booking-info-requested-notification.use-case.ts` | ✅ EXISTS | Update `buildRespondLink()` — change `responder` → `submit-info` |
| `apps/backend/src/contexts/notification/application/use-cases/send-booking-info-requested-notification/send-booking-info-requested-notification.use-case.spec.ts` | ✅ EXISTS | Update expected URL in spec |

## Prerequisite backend change

**Must ship in the same story as the frontend page** — otherwise email links go to a 404.

```ts
// send-booking-info-requested-notification.use-case.ts  ~line 84
// BEFORE:
return `${frontendUrl}/bookings/${dto.bookingId}/responder?token=${token}`;
// AFTER:
return `${frontendUrl}/bookings/${dto.bookingId}/submit-info?token=${token}`;
```

Update the companion spec to expect the new path:
```ts
// spec: expect(link).toContain('/bookings/${BOOKING_ID}/submit-info?token=');
```

## Screen 01 — Formulário de resposta (`SubmitInfoPage` / `SubmitInfoForm`)

**File:** `apps/web/app/bookings/[id]/submit-info/page.tsx` (GAP)

**Route:** `/bookings/[id]/submit-info?token=<JWT>`

**Routing note:** `bookings/` is a static Next.js segment — takes priority over the top-level `[slug]/` dynamic segment. No conflict.

**Page type:** Server component — decodes and verifies token server-side. Renders error state if invalid.

**Token validation (server-side):**
```ts
import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET!;
try {
  const payload = jwt.verify(token, secret) as { bookingId: string; tenantId: string; contactEmail: string };
  // validate payload.bookingId === params.id
} catch {
  // render 01b-invalid-link state
}
```

**BFF call to pre-fill booking summary:**
```
GET /v1/bookings/:id/submit-info/guest?token=<JWT>
  (verify this endpoint exists — if not, omit booking summary or use a minimal guest booking fetch)
```
*Fallback if endpoint doesn't exist:* render the form without booking summary (just "Booking ID: …"). The submission itself still works.

**Form component props:**
```ts
interface SubmitInfoFormProps {
  readonly bookingId: string;
  readonly token: string;
  readonly bookingSummary: {
    readonly serviceName: string;
    readonly scheduledAt: string;
    readonly contactName: string;
  } | null;
  readonly infoRequestMessage: string;
}
```

**BFF call (submission):**
```
PATCH /v1/bookings/:id/submit-info/guest?token=<JWT>
  Body: { response: string, photoUrls?: string[] }
  Response: { bookingId: string, status: "PENDING", infoSubmittedAt: string }
  No X-Tenant-Slug header required — TenantGuard bypassed by @Public()
```

**Validation:**
| Field | Rule | Error message (pt-BR) |
|---|---|---|
| `response` | `min(1)` after trim | "Informe sua resposta antes de enviar." |
| `photoUrls[]` | optional; each matches `tenants/*/uploads|bookings/*/**` pattern | (validated BFF-side only) |

**States:**
- `idle` → form shown, button enabled
- `submitting` → button disabled, spinner inline
- `success` → replace form with success banner (same page, no navigation)
- `error` → show red alert above button, preserve form values, show retry button
- `invalid-link` → show error state (rendered by server component before form mounts)

**Error messages (pt-BR):**
- Network/5xx: "Não foi possível enviar sua resposta. Verifique sua conexão e tente novamente."
- Token expired (detected client-side after 401 from PATCH): redirect to `?error=expired` to show 01b state

## Photo upload flow

> ⚠️ **Verify before implementing:** check if `POST /v1/bookings/:id/presigned-url/guest?token=` exists in BFF.
> If it does not exist, omit photo upload from MVP — guest can describe in text and staff uploads photos manually.

If the endpoint exists:
1. Guest selects files (max 5, max 10 MB each)
2. For each file: `POST /v1/bookings/:id/presigned-url/guest?token=` → `{ uploadUrl, storagePath }`
3. `PUT <uploadUrl>` with file binary (direct to S3, no BFF)
4. Collect `storagePath[]` → include as `photoUrls` in submission body

## Screen 01b — Link inválido (`SubmitInfoPage` error state)

**Rendered by:** same `page.tsx` when token is missing/invalid/expired or booking is no longer `INFO_REQUESTED`.

Shows: reason list + "Ir para o site" CTA + "Entrar / Criar conta" link.

**Detection order:**
1. No `token` query param → invalid
2. `jwt.verify()` throws → invalid
3. `payload.bookingId !== params.id` → invalid (token reuse attempt)
4. Optional: fetch booking status; if not `INFO_REQUESTED` → show "já respondido ou processado" variant

## Screen 02 — Sucesso

**Rendered by:** `SubmitInfoForm` component after 200 OK replaces the form in-place.

Shows: green check icon + "Resposta enviada!" + booking summary card + "Ir para o site" + "Criar conta / Entrar" CTA.

**"Criar conta" CTA reasoning:** Guest completing this flow has shown intent to engage — this is the lowest-friction moment to invite them into the authenticated experience. Keep it subtle (secondary link, not a button).

## Known limitations

- **No branding per tenant:** The page currently shows default `--ba-*` tokens. To show the tenant's actual branding, the token must include `tenantSlug` so the page can call `GET /[slug]/config` (public). Tracked as open question in `submit-info.md`.
- **No booking summary endpoint for guests:** There is no confirmed `GET /v1/bookings/:id/submit-info/guest?token=` endpoint. If missing, render the form without a summary card.
- **Photo upload unconfirmed:** Presigned-URL endpoint for unauthenticated context may not exist. Default to text-only in MVP.

## Mobile notes

- Single-column layout, max-width 560px centered
- Textarea min-height 7rem; user can expand
- Submit button full-width at bottom
- No auth bar, no nav, no bottom-tab — this is a standalone page
