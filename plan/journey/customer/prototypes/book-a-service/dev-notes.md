# Dev Notes — CUSTOMER: Book a Service

> **Status:** Steps 1, 2, 4 reuse existing components. Login flow (screen 0), review step (step 3), `BookingForm` branching, and `createAuthenticatedBooking()` fetcher are new builds — target M13-S02 or a dedicated story.

---

## Overview

The authenticated customer path shares steps 1 and 2 with the guest path, replaces step 3 with a new review component (no personal info form), and calls a different BFF endpoint on submit. The login flow (UC-021) is a prerequisite — steps 1–4 are unreachable until login ships.

---

## File map

| File | Status | Action |
|---|---|---|
| `apps/web/app/auth/login/page.tsx` | ❌ Gap | Create — screen 0 |
| `apps/web/app/api/auth/google/route.ts` | ❌ Gap | Create — OAuth redirect |
| `apps/web/app/api/auth/callback/google/route.ts` | ❌ Gap | Create — OAuth callback, set JWT cookie |
| `apps/web/app/select-tenant/page.tsx` | ❌ Gap | Create — multi-tenant picker (UC-021 A3) |
| `apps/web/components/booking/AuthenticatedBookingReviewStep.tsx` | ❌ Gap | Create — step 3 |
| `apps/web/components/booking/BookingForm.tsx` | ✅ Exists | Modify — add `mode: 'guest' \| 'customer'` prop |
| `apps/web/lib/api/bookings.ts` | ✅ Exists | Add `createAuthenticatedBooking()` function |
| `apps/web/app/[slug]/booking/page.tsx` | ✅ Exists | Modify — detect auth from cookie, pass `mode` to `BookingForm` |
| `apps/web/components/booking/ServiceSelectionStep.tsx` | ✅ Exists | No changes |
| `apps/web/components/booking/AvailabilityCarousel.tsx` | ✅ Exists | No changes |
| `apps/web/components/booking/SlotPicker.tsx` | ✅ Exists | No changes |
| `apps/web/components/booking/ConfirmationStep.tsx` | ✅ Exists | No changes |
| `apps/web/components/booking/PhotoUpload.tsx` | ✅ Exists | No changes |
| `apps/web/components/booking/AddressFields.tsx` | ✅ Exists | No changes |

---

## Screen 0 — Login (`/auth/login`)

**File:** `apps/web/app/auth/login/page.tsx` (Server Component)

**UI:**
- Centered card (`max-w-sm mx-auto`)
- Tenant logo (from `hotsiteConfig.branding.logoUrl`, fallback: tenant name initial in `--ba-primary` box)
- Heading: `"Entrar na {tenantName}"`
- Google sign-in button: border-1 + Google SVG + `"Entrar com Google"`
- Fine print: `"Ao entrar, você concorda com os termos de uso."`

**Flow:**
```
Click → GET /api/auth/google?redirect=/{slug}/booking
  → BFF builds Google OAuth URL (scopes: email, profile openid)
  → Browser → Google consent
  → Google → GET /api/auth/callback/google?code=...&state=...
  → BFF exchanges code, upserts Customer row, signs JWT
  → Sets httpOnly cookie: name=ba_jwt, sameSite=lax, secure
  → Reads tenants from JWT:
      1 tenant  → redirect /{slug}/booking (or ?redirect param)
      >1 tenants → redirect /select-tenant?redirect=/{slug}/booking
```

**`/select-tenant` page (UC-021 A3):**
- BFF call: `GET /auth/me/tenants` (verify this endpoint exists — may need creating)
- Renders tenant list as cards (logo + name)
- On select → redirect to `/{tenantSlug}/booking`

---

## `BookingForm` branching (`mode` prop)

**Change:** Add `mode: 'guest' | 'customer'` prop.

```tsx
// apps/web/app/[slug]/booking/page.tsx
const isAuthenticated = /* read JWT from cookie headers */ false; // implement with next/headers

<BookingForm slug={slug} services={services} mode={isAuthenticated ? 'customer' : 'guest'} />
```

**Inside `BookingForm`:**
```tsx
// Step 3:
{step === 3 && mode === 'guest' && <PersonalInfoStep ... />}
{step === 3 && mode === 'customer' && <AuthenticatedBookingReviewStep ... />}

// Submit:
const submit = mode === 'guest'
  ? () => createBooking(slug, buildGuestPayload(...))
  : () => createAuthenticatedBooking(buildCustomerPayload(...));
```

---

## Step 3 — `AuthenticatedBookingReviewStep` (new component)

**File:** `apps/web/components/booking/AuthenticatedBookingReviewStep.tsx`

**What it renders:**
1. **Read-only summary card** — selected services + formatted date/time (context before confirming)
2. **Pickup address fields** (conditional: `requiresPickupAddress`) — pre-filled from `customer.defaultAddress`
3. **PhotoUpload** (optional) — reuse existing component unchanged

**What it does NOT render:**
- ❌ `contactName` / `contactEmail` / `contactPhone` fields (customer is authenticated)

**Customer `defaultAddress` fetch:**
```
GET /customers/me
  Header: Authorization: Bearer <jwt>  (BFF reads from cookie)
  Response: { id, name, email, phone, defaultAddress?: Address }
```
Call on step mount (when `step === 3 && mode === 'customer'`). Show skeleton while loading.
If fetch fails: show inline error and disable "Próximo".

**Open question:** Does `GET /customers/me` exist in BFF (`apps/bff/src/`)? If not, add it to the story scope.

**Props:**
```tsx
interface AuthenticatedBookingReviewStepProps {
  readonly slug: string;
  readonly services: readonly HotsiteServiceResponse[];
  readonly selectedServiceIds: readonly string[];
  readonly selectedDate: string;
  readonly selectedSlot: AvailableSlot;
  readonly requiresPickupAddress: boolean;
  readonly pickupAddress: Address;
  readonly onPickupAddressChange: (address: Address) => void;
  readonly photoFilePaths: readonly string[];
  readonly onPhotoFilePathsChange: (paths: string[]) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
}
```

---

## Screen 4 — Confirmation + Submit (`ConfirmationStep`)

**States:** `idle → submitting → success / error`

| Status | Button text | Button state | UI |
|---|---|---|---|
| `'idle'` | "Confirmar agendamento" | enabled | Normal view |
| `'submitting'` | "Enviando..." | disabled | Normal view — see `04b-submitting.html` |
| `'success'` | — | — | Success view replaces step (data-testid: `confirmation-success`) — see `04d-success.html` |
| `'error'` | "Confirmar agendamento" | enabled | Error message shown (data-testid: `confirmation-error`) — see `04c-submission-error.html` |

**Error messages:**
- `errorMessage = 'Não foi possível enviar sua solicitação. Tente novamente.'` (all non-409 errors)
- 409 → navigate back to step 2, not shown in step 4

---

## New fetcher — `createAuthenticatedBooking()`

**File:** `apps/web/lib/api/bookings.ts` (add to existing file)

```ts
export async function createAuthenticatedBooking(
  payload: AuthenticatedBookingRequest,
): Promise<BookingResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BFF_URL}/bookings/authenticated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // JWT cookie sent automatically by browser (httpOnly, sameSite=lax)
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new CreateBookingError(res.status, 'Failed to create authenticated booking');
  return res.json() as Promise<BookingResponse>;
}
```

**BFF endpoint (EXISTS):**
```
POST /bookings/authenticated
  @Roles('CUSTOMER')  — requires valid JWT cookie
  Body (AuthenticatedBookingBodySchema):
    {
      scheduledAt:             string,     // ISO-8601 UTC
      serviceIds:              string[],   // uuid[]
      pickupAddress?:          Address,
      beforeServicePhotoUrls?: string[],
    }
  201 Created → BookingResponse
  409 Conflict → slot taken
```

---

## Photo upload — authenticated variant

`PhotoUpload` is reused unchanged. The BFF endpoint `POST /bookings/attachments/signed-url` handles both paths:

- **Guest** (no auth): send `{ fileName, contentType, tenantSlug: slug }` in body
- **Customer** (auth): send `{ fileName, contentType }` — BFF reads `tenantId` from JWT (Scenario 1 in `bookings.controller.ts`)

`PhotoUpload` already calls `createAttachmentSignedUrl(slug, ...)` which passes `tenantSlug`. For the customer path, pass the JWT via `credentials: 'include'` instead — or update `PhotoUpload` to accept a `mode` prop. Simpler: pass `tenantSlug` for customer too (BFF accepts it if user is authenticated).

---

## Auth header bar

A small bar showing `"{name} · {email}"` at the top of steps 1–4 for the customer path. Options:
- **Option A:** Rendered by `page.tsx` (reads JWT from cookie), passed as prop to `BookingForm`
- **Option B:** Rendered by a layout wrapper at `app/[slug]/booking/layout.tsx`
- **Recommended:** Option A — keeps the layout simple, `BookingForm` controls its own chrome

---

## Testing notes

New files require Vitest unit tests (`*.spec.tsx` alongside each new component) and at least one integration test for `POST /bookings/authenticated`. Reused components (`ServiceSelectionStep`, etc.) do not need new tests.

`AuthenticatedBookingReviewStep` key test cases:
- Renders read-only summary (service name, date, time)
- `requiresPickupAddress: true` → `AddressFields` rendered with pre-filled values
- `requiresPickupAddress: false` → no address fields
- PhotoUpload present regardless of `requiresPickupAddress`
- "Próximo" disabled while `defaultAddress` is loading
- "Próximo" calls `onNext` when pickup address filled (if required)
