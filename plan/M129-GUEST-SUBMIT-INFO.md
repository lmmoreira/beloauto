# M129 — Guest Info Response (UC-005 A2 Frontend)

**Phase:** Local Development
**Goal:** A guest (or authenticated customer via a separate path) who receives an admin's "more info needed" email can follow the link and submit their response through a dedicated standalone page — completing the UC-005 A2 flow end-to-end. Backend and BFF are already fully implemented (M08-S04/S05); this milestone adds the missing frontend page, an optional BFF read endpoint for booking summary pre-fill, and a required backend string rename.
**Depends on:** M08 (backend + BFF UC-005 A2 already complete — `PATCH /v1/bookings/:id/submit-info/guest` exists), M12 (Next.js app shell, `apps/web/app/` folder structure exists)
**Blocks:** nothing — standalone feature slice
**Journey prototype:** `plan/journey/guest/prototypes/submit-info/`
**UCs covered:** UC-005 A2 (Guest / Customer submits requested info)

> **Deployment constraint — S01 must ship in the same deployment as S03:**
> S01 renames the email link from `/bookings/:id/responder` to `/bookings/:id/submit-info`. If S01 ships without S03, new emails will link to a 404. If S03 ships without S01, the page exists but no email links to it. Ship them together. Existing emails (already sent, pointing to `/responder`) will 404 after S01 — acceptable given the 7-day token TTL.

---

## Story dependency order

```
S01 (backend: URL rename) ──────────────────────────────── must co-deploy with S03
S02 (BFF: guest booking read — OPTIONAL) ───────────────── enhances S03 form with summary card
                                        ▼
                                 S03 (frontend: SubmitInfoPage + SubmitInfoForm)
```

---

## Stories

---

### M129-S01 — Backend: rename email link URL (`responder` → `submit-info`)

**Agent:** `backend-ts`
**Complexity:** XS (2 files, ~3 line changes)
**Must co-deploy with:** M129-S03
**Docs to load:** none beyond this file

**Description:**
The info-request email currently links guests to `/bookings/:id/responder?token=`. The new frontend page lives at `/bookings/:id/submit-info`. Update the link builder and its spec.

> 🔍 **Discover before starting:**
> Read `apps/backend/src/contexts/notification/application/use-cases/send-booking-info-requested-notification/send-booking-info-requested-notification.use-case.ts` in full.
> Confirm `buildRespondLink()` is the only place this path is constructed — grep the entire `apps/backend/` for `responder` to find any other occurrences.

**File 1:** `apps/backend/src/contexts/notification/application/use-cases/send-booking-info-requested-notification/send-booking-info-requested-notification.use-case.ts`

Change in `buildRespondLink()`:
```ts
// Before:
return `${frontendUrl}/bookings/${dto.bookingId}/responder?token=${token}`;
// After:
return `${frontendUrl}/bookings/${dto.bookingId}/submit-info?token=${token}`;
```

**File 2:** `apps/backend/src/contexts/notification/application/use-cases/send-booking-info-requested-notification/send-booking-info-requested-notification.use-case.spec.ts`

Update the assertion that checks the constructed link. Grep for `responder` in the spec — replace with `submit-info`.

**Acceptance criteria:**
- [ ] `buildRespondLink()` emits `/submit-info` for guest path; authenticated path unchanged (`/dashboard/bookings/${id}`)
- [ ] All existing spec assertions pass with updated URL expectation
- [ ] `grep -r "responder" apps/backend/src/contexts/notification/` returns zero matches

---

### M129-S02 — BFF: guest booking read endpoint (OPTIONAL — enhances S03)

**Agent:** `bff-ts`
**Complexity:** S
**Optional:** S03 can ship without this. Without S02, the form shows no booking summary card (graceful degradation). Implement if time allows — it meaningfully improves UX.
**Docs to load:** `docs/24-BFF_ARCHITECTURE.md`, `docs/14-API_CONTRACTS.md` (bookings section), `plan/M08-BOOKING-APPROVAL_IMPLEMENTATION_DETAILS_IA.md`

**Description:**
Add `GET /v1/bookings/:id/guest?token=` to the BFF — a `@Public()` endpoint that validates the guest token and returns the minimal booking fields needed to pre-fill the form (service name, date, info request message). Without this, the frontend form has no way to show a booking summary to the guest.

> 🔍 **Discover before starting:**
> Read `apps/bff/src/bookings/bookings.controller.ts` — locate `submitInfoGuest()` (the existing `@Public()` PATCH handler). **Understand how it derives tenant context** without a `X-Tenant-Slug` header (TenantGuard is bypassed by `@Public()`). Whatever mechanism it uses to call the backend with the correct tenant must be replicated for this GET endpoint. Read `apps/bff/src/shared/http/backend-http.service.ts` to understand how the BFF passes headers to the backend.
>
> Also check: does `apps/backend/src/contexts/booking/infrastructure/controllers/booking.controller.ts` have a guest-accessible `GET /bookings/:id` variant? Or does the existing `GET /bookings/:id` work without authentication at the backend level (since the BFF validates the token and the backend relies on `X-Internal-Key`)?

**Endpoint:**
```
GET /v1/bookings/:id/guest?token=<JWT>
@Public()

Response 200:
{
  bookingId: string;
  status: "INFO_REQUESTED";           // if not INFO_REQUESTED → 409
  serviceSummary: string;             // e.g. "Lavagem Simples"
  scheduledAt: string;                // ISO-8601
  infoRequestMessage: string;         // what the admin asked for
  contactName: string;
}

Response 400: token missing or invalid JWT
Response 401: token bookingId ≠ path :id (mismatch)
Response 409: booking is not INFO_REQUESTED (already processed)
Response 404: booking not found
```

**Token validation:** reuse the existing `verifyGuestToken()` function already in the BFF bookings controller. Do not duplicate logic.

**Zod schema (response):**
```ts
export const GuestBookingReadResponseSchema = z.object({
  bookingId: z.uuid(),
  status: z.literal('INFO_REQUESTED'),
  serviceSummary: z.string(),
  scheduledAt: z.string(),
  infoRequestMessage: z.string(),
  contactName: z.string(),
});
export type GuestBookingReadResponse = z.infer<typeof GuestBookingReadResponseSchema>;
```

**`.http` file:** add a request block to `apps/bff/http/bookings/bookings.http`:
```http
### UC-005 A2 — Guest reads booking summary before submitting info
GET {{bffUrl}}/v1/bookings/{{bookingId}}/guest?token={{guestToken}}
```

**Acceptance criteria:**
- [ ] Returns 200 with booking summary fields when token is valid and booking is `INFO_REQUESTED`
- [ ] Returns 400 when `?token=` is absent or JWT signature is invalid
- [ ] Returns 401 when token `bookingId` ≠ path `:id`
- [ ] Returns 409 when booking status ≠ `INFO_REQUESTED`
- [ ] No `X-Tenant-Slug` or JWT auth cookie required
- [ ] `.http` block added
- [ ] Unit test covers: valid token, invalid token, mismatched bookingId, wrong status

---

### M129-S03 — Frontend: `SubmitInfoPage` + `SubmitInfoForm`

**Agent:** `web-ts`
**Complexity:** M
**Depends on:** M129-S01 must co-deploy; M129-S02 optional (degrade gracefully if absent)
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `plan/M12-HOTSITE-FRONTEND_IMPLEMENTATION_DETAILS_IA.md`
**Prototype:** `plan/journey/guest/prototypes/submit-info/` — read `dev-notes.md` in full before starting

**Description:**
Create the standalone public page that guests arrive at via the info-request email link. No authentication required. The page validates the guest token server-side, optionally fetches the booking summary, and renders a form for the guest to type their response and optionally upload photos.

> 🔍 **Discover before starting:**
> - Confirm `apps/web/app/bookings/` does NOT exist yet — this is a new top-level Next.js route.
> - Read `apps/web/app/[slug]/booking/page.tsx` to understand the existing public booking page pattern (auth bar, fetch pattern, error states).
> - Confirm that `jsonwebtoken` is already a dependency in `apps/web/package.json`. If not, add `jose` instead (Web Crypto API, works in Edge Runtime — `jsonwebtoken` requires Node.js runtime).
> - Read `apps/bff/src/bookings/bookings.controller.ts` — locate `SubmitGuestBookingInfoBodySchema` (lines ~109–121) to confirm the exact body shape: `{ response: string, photoUrls?: string[] }`.
> - Check if `POST /v1/bookings/:id/presigned-url/guest?token=` exists in the BFF. If it does not exist, **omit photo upload from this story** — text-only response is sufficient for MVP. Document the gap in a comment.

**New files to create:**

| File | Notes |
|---|---|
| `apps/web/app/bookings/[id]/submit-info/page.tsx` | Server component — token validation + data fetch |
| `apps/web/components/booking/SubmitInfoForm.tsx` | Client component — form state machine |
| `apps/web/components/booking/SubmitInfoForm.spec.tsx` | Vitest + `@testing-library/react` unit tests |

---

#### `apps/web/app/bookings/[id]/submit-info/page.tsx` (server component)

```ts
// @vitest-environment jsdom  ← NOT here (this is a server component, not tested directly)
import { SubmitInfoForm } from '@/components/booking/SubmitInfoForm';

interface Props {
  params: { id: string };
  searchParams: { token?: string };
}

export default async function SubmitInfoPage({ params, searchParams }: Props) {
  const { token } = searchParams;

  // 1. Token presence check
  if (!token) {
    return <InvalidLinkView reason="missing" />;
  }

  // 2. Token signature + expiry validation (server-side)
  const payload = verifyGuestToken(token); // returns null on failure
  if (!payload || payload.bookingId !== params.id) {
    return <InvalidLinkView reason="invalid" />;
  }

  // 3. Optional: fetch booking summary (if M129-S02 shipped)
  const summary = await fetchGuestBookingSummary(params.id, token).catch(() => null);
  // If summary?.status is not INFO_REQUESTED → render InvalidLinkView with reason="processed"

  return (
    <SubmitInfoForm
      bookingId={params.id}
      token={token}
      summary={summary}  // null if S02 not available
    />
  );
}
```

**`verifyGuestToken(token: string)`** — implement inline or as a shared util in `apps/web/lib/auth/guest-token.ts`:
- Use `jose` (`jwtVerify`) or `jsonwebtoken` (`jwt.verify`) with `process.env.JWT_SECRET`
- Payload shape: `{ bookingId: string, tenantId: string, contactEmail: string }`
- Return `null` on any error (expired, invalid signature, malformed)

**`fetchGuestBookingSummary(id, token)`** — in `apps/web/lib/api/bookings.ts`:
```ts
// GET /v1/bookings/:id/guest?token=
// Returns GuestBookingReadResponse | null (null if endpoint not found or 409)
```

---

#### `apps/web/components/booking/SubmitInfoForm.tsx` (client component)

**Props:**
```ts
interface SubmitInfoFormProps {
  readonly bookingId: string;
  readonly token: string;
  readonly summary: {
    readonly serviceSummary: string;
    readonly scheduledAt: string;
    readonly infoRequestMessage: string;
    readonly contactName: string;
  } | null;
}
```

**State machine:**
```
idle → submitting → success
              └──→ error (retry available, form values preserved)
```

**BFF call (submission):**
```
PATCH /v1/bookings/:id/submit-info/guest?token=<token>
  Body: { response: string, photoUrls?: string[] }
  No Authorization header, no X-Tenant-Slug
  Response 200: { bookingId, status: "PENDING", infoSubmittedAt }
```

**Validation (client-side before submit):**
| Field | Rule | Error message |
|---|---|---|
| `response` | `trim().length >= 1` | "Informe sua resposta antes de enviar." |

**Screens to implement** (from prototype):
| Screen | File | State |
|---|---|---|
| Form (idle) | `01-submit-form.html` | default render |
| Submitting | `01c-submitting.html` | button disabled + spinner |
| Validation error | `01d-validation-error.html` | field red border + inline error |
| Submit error | `01e-submit-error.html` | red alert + retry button, values preserved |
| Success | `02-success.html` | replaces form in-place (no navigation) |
| Invalid link | `01b-invalid-link.html` | rendered by page.tsx before form mounts |

**Photo upload (MVP scope: text-only):**
```ts
// TODO: photo upload requires presigned-url endpoint for guests
// POST /v1/bookings/:id/presigned-url/guest?token= — verify this exists before implementing
// If missing: omit the upload zone; add a comment explaining the gap
```
If the presigned-URL endpoint does not exist, render a static note: _"Para enviar fotos, responda diretamente a este email com os arquivos em anexo."_

**Routing note (add as code comment):**
```ts
// This page lives at apps/web/app/bookings/[id]/submit-info/page.tsx
// Next.js static segment 'bookings/' takes priority over [slug]/ — no conflict.
// No auth required: page is fully public, token is the only access control.
```

---

#### `apps/web/components/booking/SubmitInfoForm.spec.tsx`

```ts
// @vitest-environment jsdom
```

**Minimum test cases:**
| Test | What to assert |
|---|---|
| renders form with summary card | `serviceSummary` and `infoRequestMessage` appear in DOM |
| renders form without summary | no summary card, form still functional |
| submit with empty response | field error message appears; no fetch called |
| submit success | success banner appears; form hidden |
| submit network error | error alert appears; retry button visible; response field value preserved |
| submit in progress | button disabled; spinner present |

Use `vi.mock` for `fetch`. Do NOT test `page.tsx` — server component, Playwright only.

---

**Acceptance criteria:**
- [ ] `GET /bookings/[id]/submit-info?token=<valid>` renders the form (with or without summary)
- [ ] `GET /bookings/[id]/submit-info` (no token) renders the invalid-link screen
- [ ] `GET /bookings/[id]/submit-info?token=<expired>` renders the invalid-link screen
- [ ] Empty response field shows inline validation error; no API call made
- [ ] Successful submit shows success screen in-place; does not navigate
- [ ] Network error shows retry alert; form values preserved
- [ ] Button disabled + spinner during submission
- [ ] All tests pass (`pnpm test --filter apps/web`)
- [ ] `tsc --noEmit` zero errors
- [ ] No `[slug]/` route captures `/bookings/` — verify by opening `localhost:3000/bookings/some-id/submit-info?token=test` and confirming it does not render the hotsite

---

## Open questions / gaps to resolve before starting S03

| # | Question | Impact |
|---|---|---|
| 1 | Does `jsonwebtoken` work server-side in Next.js 16 (Node.js runtime only, not Edge)? Or should `jose` be used? | Affects `verifyGuestToken()` implementation |
| 2 | Does a presigned-URL BFF endpoint exist for unauthenticated guests? | Determines whether photo upload is in scope |
| 3 | Should the page show the tenant's branding (colors, logo)? Token contains `tenantId` but not `tenantSlug`. Adding `tenantSlug` to the JWT payload would allow the page to call `GET /[slug]` for branding. | Cosmetic but affects trust |
| 4 | What happens if the guest opens the link after the booking has been approved/rejected/cancelled (no longer `INFO_REQUESTED`)? The API returns an error — should the invalid-link screen say "seu agendamento já foi processado"? | UX copy; needs a distinct `reason` variant |

---

## Non-goals (out of scope for this milestone)

- Photo upload (unless presigned-URL guest endpoint is confirmed to exist — see Q2 above)
- Authenticated customer path — that form lives in `BookingDetailPage` (`/dashboard/bookings/[id]`) as part of the Minha Conta milestone (M126)
- Tenant branding on the page (tracked as open question — enhancement post-MVP)
- Email template changes (the email body is not modified here; only the link URL)
