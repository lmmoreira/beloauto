# M126 — Customer Minha Conta

**Phase:** Local Development  
**Goal:** Logged-in customer can view and manage their own bookings at `/{slug}/minha-conta` — browse Próximos / Pendentes / Histórico sections, check loyalty balance, cancel eligible bookings (UC-007), and respond to admin info requests (UC-005 A2).  
**Depends on:** M03 (JWT / auth), M08 (booking creation + submit-info backend), M09 (cancel-customer backend), M10 (loyalty balance endpoint), M12 (hotsite shell, `/{slug}/` route), M124 (customer login sets the httpOnly JWT cookie)  
**Blocks:** M13 (full dashboard frontend — Minha Conta is the customer slice of M13)  
**Journey prototype:** `plan/journey/customer/prototypes/minha-conta/` — reviewed; UC audit done 2026-06-16  
**UCs covered:** UC-006, UC-007, UC-016 (balance summary + full history), UC-023 (in-app trigger), UC-005 A2 (authenticated customer path)

> **Discovery note (applies to this entire milestone):** Several BFF endpoints were built in M08/M09 for guest/admin flows and may already serve the CUSTOMER role. Every story that touches the BFF has a "🔍 Discover before starting" callout. Read the existing controller before writing new code — the story scope may shrink to type additions only.

---

## Stories

---

### M126-S01 — Customer shell: layout, auth guard, route protection

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `docs/REPOSITORY_STRUCTURE.md`  
**Parallel with:** M126-S02

**Description:**  
Implement the foundational shell for the customer area. All `/{slug}/minha-conta/**` routes require a valid CUSTOMER JWT — unauthenticated users must be redirected to login. The visual shell matches `plan/journey/shared/customer-dashboard.html` and `plan/journey/customer/prototypes/minha-conta/01-minha-conta.html`.

> 🔍 **Discover before starting:** Check `apps/web/app/[slug]/` for any existing `minha-conta/` folder or `layout.tsx`. Check `apps/web/middleware.ts` — if it exists, read it in full before extending it; the staff guard (added in M125-S01) must not be broken. Read `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md` for the canonical folder structure before placing any files.

**What to create:**

Extend `apps/web/middleware.ts` — add protection for `/{slug}/minha-conta/**`:
- Read JWT from `access_token` httpOnly cookie
- If missing or expired → redirect to `/{slug}/login`
- If JWT role is not `CUSTOMER` → redirect to `/{slug}/login` (staff must not reach customer area)
- If valid → pass through; the `tenantSlug` in the JWT must match the `[slug]` path segment

`apps/web/app/[slug]/minha-conta/layout.tsx` — server component:
- Reads JWT from cookie (server-side via `cookies()`)
- Extracts `{ tenantName, userName, role }` from payload
- Renders `<CustomerShell tenantName={...} userName={...} />`

`apps/web/components/customer/CustomerShell.tsx` — `'use client'`:
- `dashboard-topbar` (brand: tenant logo/name + "+ Novo agendamento" desktop shortcut + avatar dropdown with "Sair" and "Site BeloAuto" links)
- Customer tab nav — **desktop only (`≥1024px`)**: Início | Agendamentos | Fidelidade (horizontal tab bar below topbar, same `.customer-nav` pattern from prototype)
- `<main class="main-content">` content slot
- `bottom-nav` — **mobile only (`<1024px`)**: 3 tabs — Início | Agendamentos | Fidelidade

**CSS class reference (do not invent new classes — use `shared/tokens.css`):**

| tokens.css class | Purpose |
|---|---|
| `.dashboard-topbar` | Sticky topbar wrapper |
| `.topbar-brand` / `.topbar-logo-mark` / `.topbar-tenant-name` | Brand block |
| `.dashboard-layout` / `.main-content` / `.dashboard-body` | Content layout |
| `.bottom-nav` / `.bottom-nav-item` / `.bottom-nav-icon` | Mobile tab bar |
| `.auth-avatar` | Avatar button |
| `.btn-primary` / `.btn-secondary` / `.btn-danger` | Action buttons |
| `.status-badge` + `.status-*` | Status chips |

**Acceptance criteria:**
- [ ] Unauthenticated `GET /{slug}/minha-conta` redirects to `/{slug}/login`
- [ ] JWT with role `STAFF` or `MANAGER` redirects to `/{slug}/login`
- [ ] JWT `tenantSlug` mismatch with URL `[slug]` → redirect to `/{slug}/login`
- [ ] Valid CUSTOMER JWT → shell renders; `userName` shown in avatar dropdown
- [ ] Bottom nav visible at `<1024px`; desktop tab nav visible at `≥1024px`; never both at once
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M124-S01 (cookie set on login), M124-S03 (`/{slug}/login` route exists)

---

### M126-S02 — BFF: customer booking list + loyalty balance endpoints

**Agent:** `bff-ts`  
**Complexity:** S  
**Docs to load:** `docs/14-API_CONTRACTS.md` § Bookings + Loyalty, `docs/24-BFF_ARCHITECTURE.md`  
**Parallel with:** M126-S01

**Description:**  
Provide the two data endpoints needed for the Minha Conta list page: a customer-scoped booking list and the loyalty balance strip.

> 🔍 **Discover before starting:**
> - Open `apps/bff/src/bookings/bookings.controller.ts`. Look for `GET /v1/bookings`. Check: (a) does it already allow `CUSTOMER` role via `@Roles`? (b) when called with a CUSTOMER JWT, does it filter to `customerId === JWT.sub`? (c) does its response shape include `status`, `scheduledAt`, `lines[].serviceName`, `lines[].priceAtBooking`, `totalPrice`, and `booking.notes`? If yes to all three, this story reduces to adding `CustomerBookingListResponse` to `packages/types/` only.
> - Open `apps/bff/src/loyalty/loyalty.controller.ts` (or similar). Check if `GET /v1/loyalty/balance` exists and is accessible to CUSTOMER role. Response should include `currentPoints`, `nextExpiryDate`, `nextExpiryPoints`.

**`@beloauto/types` additions** (`packages/types/src/booking.dto.ts`):
```typescript
export interface CustomerBookingLineItem {
  lineId: string;
  serviceName: string;
  durationMins: number;
  priceAtBooking: MoneyAmount;
}

export interface CustomerBookingListItem {
  bookingId: string;
  status: BookingStatus;
  scheduledAt: string | null;     // ISO-8601; null when PENDING with no slot yet
  lines: CustomerBookingLineItem[];
  totalPrice: MoneyAmount;
  notes: string | null;           // booking.notes — what the customer wrote on request
}

export interface CustomerBookingListResponse {
  items: CustomerBookingListItem[];
  total: number;
}
```

**`@beloauto/types` additions** (`packages/types/src/loyalty.dto.ts` — extend if exists):
```typescript
export interface CustomerLoyaltyBalanceResponse {
  currentPoints: number;
  nextExpiryDate: string | null;   // ISO-8601 date
  nextExpiryPoints: number | null;
}
```

**BFF changes (only if not already correct):**
- `GET /v1/bookings` — ensure `@Roles('CUSTOMER')` is included and the handler filters `WHERE customerId = X-Actor-ID AND tenantId = X-Tenant-ID`
- `GET /v1/loyalty/balance` — ensure `@Roles('CUSTOMER')` included; returns `CustomerLoyaltyBalanceResponse` shape

**Acceptance criteria:**
- [ ] `GET /v1/bookings` with CUSTOMER JWT returns only that customer's bookings for the tenant
- [ ] Response items include `status`, `scheduledAt`, `lines`, `totalPrice`, `notes`
- [ ] `GET /v1/bookings` with STAFF JWT → still works (no regression to M125-S02)
- [ ] `GET /v1/loyalty/balance` with CUSTOMER JWT → `CustomerLoyaltyBalanceResponse`
- [ ] Tenant isolation: Customer A cannot retrieve Customer B's bookings
- [ ] `CustomerBookingListResponse`, `CustomerBookingListItem`, `CustomerLoyaltyBalanceResponse` in `packages/types/`
- [ ] `.http` request blocks added/updated in `apps/bff/http/bookings/bookings.http` and `apps/bff/http/loyalty/loyalty.http`

**Dependencies:** M08 (booking list backend), M10 (loyalty balance backend)

---

### M126-S03 — Minha Conta home + booking list page (`/{slug}/minha-conta`)

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/04-USE_CASES.md` § UC-006, UC-016  
**Prototype references:**
- `plan/journey/shared/customer-dashboard.html` — Início tab (stat cards + upcoming preview)
- `plan/journey/customer/prototypes/minha-conta/01-minha-conta.html` — Agendamentos tab (3 sections)
- `plan/journey/customer/prototypes/minha-conta/01-minha-conta-empty.html` — empty state

**Description:**  
The customer's home — a single route with two tab views. The "Início" tab shows summary stats and a preview of upcoming/pending bookings. The "Agendamentos" tab shows the full sectioned list. Both views are rendered client-side from the same server-fetched data.

> 🔍 **Discover before starting:** Confirm that `CustomerBookingListResponse` and `CustomerLoyaltyBalanceResponse` from M126-S02 are available in `packages/types/`. Verify `apps/web/lib/api/` — check whether a customer fetcher file already exists (`customer.ts`, `minha-conta.ts`). Follow the convention already in place.

**What to create:**

`apps/web/lib/api/minha-conta.ts`:
```typescript
fetchCustomerBookings(): Promise<CustomerBookingListResponse>
// GET /v1/bookings — no status filter; all statuses returned, split client-side
// Sends auth cookie + X-Actor-* headers

fetchLoyaltyBalance(): Promise<CustomerLoyaltyBalanceResponse>
// GET /v1/loyalty/balance
```

`apps/web/app/[slug]/minha-conta/page.tsx` — server component:
- Calls `fetchCustomerBookings()` and `fetchLoyaltyBalance()` in parallel (`Promise.all`)
- On fetch error → render error boundary (not a crash)
- Renders `<MinhaContaPage bookings={items} loyaltyBalance={balance} />`

`apps/web/components/customer/minha-conta/MinhaContaPage.tsx` — `'use client'`:
- Manages `activeTab: 'inicio' | 'agendamentos'` state (default: `'inicio'`)
- Syncs active tab to the shell's tab nav + bottom nav (via props or context)
- Renders `<InicioDashboard>` or `<AgendamentosList>` based on active tab

`apps/web/components/customer/minha-conta/InicioDashboard.tsx`:
- Greeting: "Olá, {userName}"
- Stat cards: **Pontos** (`currentPoints`) + **Agendamentos** (`total`)
- Loyalty expiry strip: "X pontos expiram em {nextExpiryDate}" — hidden when `nextExpiryDate` is null
- Upcoming preview: up to 3 most recent APPROVED or PENDING/INFO_REQUESTED bookings as `<BookingListItem>` rows
- "Ver todos os agendamentos →" link → switches to `'agendamentos'` tab
- "+ Novo agendamento" CTA (mobile) → `/{slug}/booking`

`apps/web/components/customer/minha-conta/AgendamentosList.tsx`:
- **Client-side section split** (from one `items` array):
  ```ts
  const upcoming = items.filter(b => b.status === 'APPROVED' && new Date(b.scheduledAt!) >= today);
  const pending  = items.filter(b => b.status === 'PENDING' || b.status === 'INFO_REQUESTED');
  const history  = items.filter(b => ['COMPLETED','CANCELLED','REJECTED'].includes(b.status));
  ```
- Loyalty compact strip at top (points + expiry)
- Three labeled sections with section count badges
- Each section: list of `<BookingListItem>` rows; empty section → section hidden (not empty state)
- All sections empty → `<BookingEmptyState>` (UC-006 A1)

`apps/web/components/customer/minha-conta/BookingListItem.tsx`:
- Service name(s), date + time, total price, status badge
- For APPROVED: "Cancelar" text link (visible only within cancellation window — UC-006 A2) + links to detail page
- For INFO_REQUESTED: "Responder" text link + status badge (blue)
- For PENDING: "Cancelar solicitação" text link + status badge (yellow)
- For COMPLETED/CANCELLED/REJECTED: read-only, badge only, no action links

**Cancellation window check (UC-006 A2) — client-side:**
```ts
// tenantSettings.booking.cancellation_window_hours loaded from JWT or BFF
const deadline = new Date(booking.scheduledAt!);
deadline.setHours(deadline.getHours() - cancellationWindowHours);
const canCancel = new Date() < deadline;
// canCancel === false → hide "Cancelar" link; show note "Prazo encerrado"
```

`apps/web/components/customer/minha-conta/BookingEmptyState.tsx` — UC-006 A1:
- Icon + "Nenhum agendamento ainda"
- CTA "Fazer agendamento" → `/{slug}/booking`

**Acceptance criteria:**
- [ ] Page fetches both endpoints in parallel; renders within 2 network round trips
- [ ] Início tab: stat cards show `currentPoints` and `total`; loyalty expiry strip visible when `nextExpiryDate != null`
- [ ] Agendamentos tab: Próximos / Pendentes / Histórico sections contain correct items per status logic
- [ ] Empty sections are hidden; all three empty → `<BookingEmptyState>` shown
- [ ] "Cancelar" on APPROVED item: visible when `now < scheduledAt − windowHours`; hidden with "Prazo encerrado" note otherwise
- [ ] INFO_REQUESTED item shows "Responder" link (not "Cancelar")
- [ ] Status badges match tokens.css: `.status-approved`, `.status-pending`, `.status-info`, `.status-cancelled`
- [ ] Completed items: no action links
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings
- [ ] Vitest unit test for the client-side section-split logic (pure function)

**Dependencies:** M126-S01, M126-S02

---

### M126-S04 — BFF: customer booking detail endpoint

**Agent:** `bff-ts`  
**Complexity:** S  
**Docs to load:** `docs/14-API_CONTRACTS.md` § Bookings, `docs/24-BFF_ARCHITECTURE.md`  
**Parallel with:** M126-S03

**Description:**  
Provide the full booking detail for a customer viewing their own booking. Ownership is mandatory: a CUSTOMER may only fetch bookings where `customerId === JWT.sub`.

> 🔍 **Discover before starting:** Open `apps/bff/src/bookings/bookings.controller.ts`. Find `GET /v1/bookings/:id`. Check: (a) does it allow `CUSTOMER` role? (b) does it enforce `customerId === X-Actor-ID`, returning `403` otherwise? (c) does its response shape include `status`, `scheduledAt`, `lines`, `totalPrice`, `notes`, `infoRequestMessage`, `infoResponseMessage`? If yes to all three, this story is types-only.

**`@beloauto/types` additions** (`packages/types/src/booking.dto.ts`):
```typescript
export interface CustomerBookingDetailResponse {
  bookingId: string;
  status: BookingStatus;
  scheduledAt: string | null;
  lines: CustomerBookingLineItem[];   // reuse from M126-S02
  totalPrice: MoneyAmount;
  notes: string | null;               // customer's own notes at time of request

  // UC-005 A2 — present when status is INFO_REQUESTED or beyond
  infoRequestMessage: string | null;  // what the admin asked
  infoResponseMessage: string | null; // what the customer already answered (if any)

  // Photos — empty array if none
  beforeServicePhotoUrls: string[];   // signed read URLs (BFF generates)
  afterServicePhotoUrls: string[];    // populated only when COMPLETED
}
```

**BFF changes (only if not already correct):**
- `GET /v1/bookings/:id` — ensure `@Roles('CUSTOMER')` allowed and `customerId === X-Actor-ID` enforced (403 if not the owner)
- Before-service/after-service photo URLs: call `IStorageService.getSignedReadUrl()` per path (same pattern as M115-S01)

**Acceptance criteria:**
- [ ] `GET /v1/bookings/:id` with CUSTOMER JWT (owner) → `200 CustomerBookingDetailResponse`
- [ ] `GET /v1/bookings/:id` with CUSTOMER JWT (not the owner) → `403`
- [ ] `GET /v1/bookings/:id` with STAFF JWT → `200` (no regression to M125-S04)
- [ ] `infoRequestMessage` populated when booking is INFO_REQUESTED or beyond
- [ ] `afterServicePhotoUrls` non-empty only when `status === COMPLETED`
- [ ] Tenant isolation: `customerId` from Tenant A cannot retrieve Tenant B's bookings
- [ ] `CustomerBookingDetailResponse` in `packages/types/src/booking.dto.ts`
- [ ] `.http` block added/updated in `apps/bff/http/bookings/bookings.http`

**Dependencies:** M08 (booking detail backend), M115-S01 (signed URL pattern)

---

### M126-S05 — Booking detail page + cancel flow + info submit (`/{slug}/minha-conta/agendamentos/[id]`)

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/04-USE_CASES.md` § UC-006 step 5, UC-007, UC-005 A2  
**Prototype references:**
- `plan/journey/customer/prototypes/minha-conta/02-agendamento-detail.html` — APPROVED detail
- `plan/journey/customer/prototypes/minha-conta/02b-agendamento-info-requested.html` — INFO_REQUESTED + response form
- `plan/journey/customer/prototypes/minha-conta/02c-agendamento-historico.html` — COMPLETED read-only
- `plan/journey/customer/prototypes/minha-conta/03-cancel-confirm.html` — cancel confirmation page
- `plan/journey/customer/prototypes/minha-conta/03b-cancel-error.html` — outside window error

**Description:**  
The booking detail page for a customer. The page adapts based on status: APPROVED/PENDING show a cancel action; INFO_REQUESTED shows an info-submit form; COMPLETED/CANCELLED/REJECTED are read-only. Cancel confirmation is a dedicated sub-page (not a JS overlay — static prototype informed this decision).

> 🔍 **Discover before starting:** Confirm `CustomerBookingDetailResponse` from M126-S04 is available in types. Check `apps/bff/src/bookings/bookings.controller.ts` for `PATCH /v1/bookings/:id/cancel` and `PATCH /v1/bookings/:id/submit-info` — verify both accept CUSTOMER role and return the expected shapes. Check `tenants.settings.booking.cancellation_window_hours` is accessible from the JWT or a BFF settings endpoint; if not, default to `48`.

**What to create:**

`apps/web/lib/api/minha-conta.ts` (extend from S03):
```typescript
fetchCustomerBookingDetail(bookingId: string): Promise<CustomerBookingDetailResponse>
// GET /v1/bookings/:id

cancelBooking(bookingId: string): Promise<void>
// PATCH /v1/bookings/:id/cancel
// 200 → booking now CANCELLED
// 422 → outside window (UC-007 A1)

submitInfo(bookingId: string, message: string): Promise<void>
// PATCH /v1/bookings/:id/submit-info  { message }
// 200 → booking status returns to PENDING
```

`apps/web/app/[slug]/minha-conta/agendamentos/[id]/page.tsx` — server component:
- Calls `fetchCustomerBookingDetail(id)`
- `notFound()` on 404; `redirect('/{slug}/login')` on 401/403
- Renders `<AgendamentoDetailPage booking={data} cancellationWindowHours={windowHours} />`

`apps/web/components/customer/minha-conta/AgendamentoDetailPage.tsx` — `'use client'`:
- Topbar: `← Agendamentos` back link + status badge (updates after action)
- Renders `<AgendamentoDetailMain>` (read-only booking info)
- Conditionally renders:
  - `<CancelAction>` when status is APPROVED (within window) or PENDING/INFO_REQUESTED
  - `<InfoSubmitForm>` when status is INFO_REQUESTED and no `infoResponseMessage` yet
  - Nothing extra when COMPLETED/CANCELLED/REJECTED

`apps/web/components/customer/minha-conta/AgendamentoDetailMain.tsx` — read-only body:
- Date + time section
- Service lines table: name | duration | price; totals row
- "Suas observações" section: `booking.notes` — hidden when null
- Before-service photos grid (lazy loaded) — hidden when empty array
- After-service photos grid (COMPLETED only) — hidden when empty
- Loyalty points earned banner (COMPLETED only — show if `afterServicePhotoUrls.length > 0` or status COMPLETED)

`apps/web/components/customer/minha-conta/CancelAction.tsx`:
- "Cancelar agendamento" button → navigates to `/{slug}/minha-conta/agendamentos/[id]/cancelar`
- Window note: "Cancelamento gratuito até {deadline}" — shown for APPROVED within window

`apps/web/app/[slug]/minha-conta/agendamentos/[id]/cancelar/page.tsx` — server component:
- Renders `<CancelConfirmPage booking={...} />`

`apps/web/components/customer/minha-conta/CancelConfirmPage.tsx` — `'use client'`:
- Shows booking summary + warning
- "Confirmar cancelamento" → calls `cancelBooking()`
  - 200 → redirect to `/{slug}/minha-conta` (booking will appear as CANCELLED in Histórico)
  - 422 → redirect to `/{slug}/minha-conta/agendamentos/[id]/cancelar/erro` (UC-007 A1)
- "Voltar" → `router.back()`

`apps/web/app/[slug]/minha-conta/agendamentos/[id]/cancelar/erro/page.tsx`:
- Renders `<CancelErrorPage>` — static (no action needed, just shows error + "Voltar" + WhatsApp link)

`apps/web/components/customer/minha-conta/InfoSubmitForm.tsx` — UC-005 A2:
- Shows `infoRequestMessage` (admin's question) in a blue info box
- Textarea for response (required)
- "Enviar resposta" → calls `submitInfo()`
  - 200 → local state update: hide form, show "Resposta enviada" confirmation, status badge → PENDING
  - Error → inline error message; form stays open

**Bottom nav:** hidden on all detail and cancelar pages (drill-down pages — add `<style>.bottom-nav { display: none !important; }</style>` in layout or `page.tsx`).

**Acceptance criteria:**

*Detail page:*
- [ ] APPROVED detail: shows date, services, notes, cancel button (when within window), before-photos
- [ ] INFO_REQUESTED detail: shows admin's question + `<InfoSubmitForm>`
- [ ] COMPLETED detail: shows after-photos, loyalty points banner, "Fazer novo agendamento" CTA; no cancel button
- [ ] CANCELLED/REJECTED detail: read-only, no action buttons
- [ ] Bottom nav hidden (drill-down)

*Cancel flow (UC-007):*
- [ ] "Cancelar" → navigates to `/cancelar` page showing booking summary + warning
- [ ] "Confirmar cancelamento" → `PATCH /cancel` → 200 → redirect to minha-conta list
- [ ] `PATCH /cancel` 422 → redirect to `/cancelar/erro` with "Prazo encerrado" message + contact hint

*Info submit (UC-005 A2):*
- [ ] INFO_REQUESTED booking shows `infoRequestMessage` + textarea form
- [ ] Submit disabled when textarea empty
- [ ] 200 → form replaced with "Resposta enviada" confirmation; status badge updates to PENDING
- [ ] Network error → inline error; form remains usable

*Types:*
- [ ] `cancelBooking`, `submitInfo` fetchers in `apps/web/lib/api/minha-conta.ts`
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M126-S01, M126-S03, M126-S04

---

### M126-S06 — BFF: customer loyalty entries + redemptions

**Agent:** `bff-ts`
**Complexity:** S
**Parallel with:** S04
**Docs to load:** `docs/14-API_CONTRACTS.md` § Loyalty, `docs/24-BFF_ARCHITECTURE.md`, `plan/M10-COMPLETION-LOYALTY_IMPLEMENTATION_DETAILS_IA.md`

**Description:**
Provide the two paginated endpoints needed for the customer's full loyalty history page: earning entries and redemptions scoped to the authenticated customer.

> 🔍 **Discover before starting:**
> - Open `apps/bff/src/loyalty/` (or check where loyalty BFF routes live). Find `GET /v1/loyalty/entries` and `GET /v1/loyalty/redemptions`. Check: (a) do they exist? (b) do they include `@Roles('CUSTOMER')`? (c) do they filter results to `customerId === X-Actor-ID`?
> - If both exist and are CUSTOMER-scoped, this story is types-only.
> - Check `packages/types/src/loyalty.dto.ts` for existing `LoyaltyEntryResponse` and `LoyaltyRedemptionResponse` types. If present, verify shape matches what the BFF actually returns.

**`@beloauto/types` additions** (`packages/types/src/loyalty.dto.ts`):
```typescript
export interface CustomerLoyaltyEntryResponse {
  entryId: string;
  serviceName: string;
  pointsEarned: number;
  earnedAt: string;         // ISO-8601
  expiresAt: string | null; // ISO-8601; null = no expiry
  expired: boolean;         // server-computed: expiresAt != null && expiresAt < now
}

export interface CustomerLoyaltyEntriesResponse {
  items: CustomerLoyaltyEntryResponse[];
  total: number;
}

export interface CustomerLoyaltyRedemptionResponse {
  redemptionId: string;
  pointsUsed: number;
  amountSaved: string;       // formatted BRL e.g. "R$ 8,50"
  redeemedAt: string;        // ISO-8601
  bookingReference: string | null; // e.g. "Lavagem Completa" — from booking.lines
}

export interface CustomerLoyaltyRedemptionsResponse {
  items: CustomerLoyaltyRedemptionResponse[];
  total: number;
}
```

**BFF changes (only if not already correct):**
- `GET /v1/loyalty/entries` — ensure `@Roles('CUSTOMER')` included; filter `WHERE customerId = X-Actor-ID`; support `?limit=&offset=` for pagination (MVP default: `limit=50`)
- `GET /v1/loyalty/redemptions` — same role + ownership requirements

**Acceptance criteria:**
- [ ] `GET /v1/loyalty/entries` with CUSTOMER JWT → only that customer's entries for the tenant
- [ ] `GET /v1/loyalty/redemptions` with CUSTOMER JWT → only that customer's redemptions
- [ ] Entries include `expired: true` when `expiresAt < now`
- [ ] Tenant isolation: Customer A cannot retrieve Customer B's entries
- [ ] STAFF JWT on these endpoints still works (no regression to M128-S02)
- [ ] Types in `packages/types/`
- [ ] `.http` blocks updated in `apps/bff/http/loyalty/loyalty.http`

**Dependencies:** M10 (loyalty entries + redemptions backend)

---

### M126-S07 — Frontend: Fidelidade page (`/{slug}/minha-conta/fidelidade`)

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-016, `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`
**Prototype references:**
- `plan/journey/customer/prototypes/minha-conta/04-fidelidade.html` — full view with tabs
- `plan/journey/customer/prototypes/minha-conta/04b-fidelidade-empty.html` — 0 pts empty state

**Description:**
The customer's own loyalty history page — a full view of their balance, earning entries, and redemption history. Accessed by tapping the loyalty strip on the Minha Conta home page or the "Fidelidade" tab in the nav bar.

> 🔍 **Discover before starting:**
> - Confirm M126-S06 types (`CustomerLoyaltyEntriesResponse`, `CustomerLoyaltyRedemptionsResponse`) are in `packages/types/`.
> - Confirm `CustomerLoyaltyBalanceResponse` from M126-S02 is available.
> - Check `apps/web/lib/api/minha-conta.ts` — extend it rather than creating a new file.
> - Verify `tenants.settings.loyalty.points_per_currency_unit` is accessible from the JWT or a settings endpoint — it controls whether the "10 pts = R$ 1,00" conversion row is shown (hide when 0 or when setting is missing).

**What to create:**

`apps/web/lib/api/minha-conta.ts` (extend from S03):
```typescript
fetchLoyaltyEntries(limit?: number): Promise<CustomerLoyaltyEntriesResponse>
// GET /v1/loyalty/entries?limit=50

fetchLoyaltyRedemptions(limit?: number): Promise<CustomerLoyaltyRedemptionsResponse>
// GET /v1/loyalty/redemptions?limit=50
```

`apps/web/app/[slug]/minha-conta/fidelidade/page.tsx` — server component:
- Calls `fetchLoyaltyBalance()`, `fetchLoyaltyEntries()`, `fetchLoyaltyRedemptions()` in parallel
- Renders `<MinhaFidelidadePage balance={...} entries={...} redemptions={...} conversionRate={...} />`

`apps/web/components/customer/minha-conta/MinhaFidelidadePage.tsx` — `'use client'`:
- **Balance card** (gradient blue — same pattern as `04-fidelidade.html`):
  - `currentPoints` (large bold number)
  - "pontos ativos" label
  - Expiry strip: "X pts expiram em {date}" — hidden when `nextExpiryDate === null`
  - Conversion row: "10 pts = R$ 1,00 · Valor total: R$ {currentPoints / rate}" — hidden when `conversionRate === 0`
- **Tab bar**: "Histórico de ganhos" | "Resgates"
- **Ganhos tab**: list of `CustomerLoyaltyEntryResponse` rows
  - Service name + date + `+N pts` (green)
  - Expired entries: `opacity: 0.4`, "Expirado" badge, `+N pts` grey
- **Resgates tab**: list of `CustomerLoyaltyRedemptionResponse` rows
  - Description + date + `−N pts` (red) + "Economia: R$ X,XX"
  - Empty resgates: "Nenhum resgate realizado ainda"
- **Empty state** (when `currentPoints === 0 && entries.total === 0`):
  - Muted balance card (0, low opacity)
  - "Nenhum ponto acumulado ainda" + CTA "Agendar agora" → `/{slug}/booking`
- Vitest unit test: `MinhaFidelidadePage.spec.tsx` — key cases: renders balance, tabs switch correctly, empty state shown when both entries and balance are zero

**`CustomerShell` update** (M126-S01):
- "Fidelidade" tab nav link (desktop) and bottom-nav item (mobile) must link to `/{slug}/minha-conta/fidelidade`
- Loyalty strip on Minha Conta home (`01-minha-conta.html`) is a link → this page

**Acceptance criteria:**
- [ ] `GET /{slug}/minha-conta/fidelidade` renders balance card with `currentPoints`
- [ ] Expiry strip visible when `nextExpiryDate != null`; hidden otherwise
- [ ] Conversion row visible when `conversionRate > 0`; hidden otherwise
- [ ] Ganhos tab: entries shown with service name, date, green `+N pts`; expired entries faded
- [ ] Resgates tab: redemptions shown with `−N pts` and savings amount; empty message when list is empty
- [ ] Empty state (0 pts, no entries): muted balance card + "Agendar agora" CTA
- [ ] "Fidelidade" nav tab active on this page (both desktop and mobile)
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings
- [ ] Vitest unit tests pass

**Dependencies:** M126-S01 (shell), M126-S02 (`fetchLoyaltyBalance`), M126-S06 (entries + redemptions BFF)

---

### M126-S08 — Frontend: UC-023 tenant switch trigger + page

**Agent:** `frontend-ts` (frontend) + `bff-ts` (one new BFF endpoint)
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-023, `docs/24-BFF_ARCHITECTURE.md`, `plan/M03-AUTHENTICATION_IMPLEMENTATION_DETAILS_IA.md`
**Prototype references:**
- `plan/journey/customer/prototypes/minha-conta/05-trocar-empresa.html` — same visual pattern as `/select-tenant`
- `plan/journey/customer/prototypes/login/01-select-tenant.html` — reference for card pattern

**Description:**
Completes UC-023: a logged-in customer who belongs to multiple tenants can switch their active tenant from the avatar dropdown in the customer shell. The BFF already issues a new cookie-set JWT on `POST /v1/auth/switch-tenant` (fixed in M124-S01); this story adds the tenant-list endpoint and the UI.

> 🔍 **Discover before starting:**
> - Confirm M124-S01 is deployed: `POST /v1/auth/switch-tenant` sets the `access_token` httpOnly cookie and returns `{ tenantSlug, expiresIn }`.
> - Check `apps/bff/src/customers/customers.controller.ts` — does `GET /v1/customers/tenants` exist? If not, it must be added (see BFF part below).
> - Check `apps/web/app/switch-tenant/page.tsx` — this is separate from `/select-tenant` (login flow). Same visual, different endpoint and context.
> - In the JWT payload, check if `tenantCount` or a list of tenant IDs is included. If not, the frontend must always call the BFF endpoint (cannot short-circuit based on JWT alone).

**BFF part — `GET /v1/customers/tenants` (if missing):**

Add to `apps/bff/src/customers/customers.controller.ts`:
```typescript
@Get('tenants')
@Roles('CUSTOMER')
getCustomerTenants(
  @CurrentUser() user: CurrentUserPayload,
): Promise<TenantOption[]> {
  // Calls GET /internal/customers/{user.sub}/tenants
  // Excludes the current tenant (user.tenantId) from the returned list
  // Returns TenantOption[] (same type used by /select-tenant)
}
```

`TenantOption` is already in `@beloauto/types` (added in M124-S01). Confirm it contains: `{ id, name, slug, loyaltyPoints }`. If `loyaltyPoints` is not available from the internal tenant endpoint, call `GET /internal/customers/{customerId}/loyalty-balance?tenantId={id}` per tenant or set to `0` for now (note the limitation in dev-notes).

**`@beloauto/types` addition** (if not already in M124-S01):
```typescript
// packages/types/src/auth.dto.ts
export interface SwitchTenantRequest {
  readonly targetTenantId: string;
}
// SwitchTenantResponse already defined in M124-S01: { tenantSlug, expiresIn }
```

**Frontend part:**

`apps/web/lib/api/auth.ts` (extend from M124-S03):
```typescript
fetchCustomerTenants(): Promise<TenantOption[]>
// GET /api/customers/tenants — returns other tenants (current excluded)

switchTenant(targetTenantId: string): Promise<SwitchTenantResponse>
// POST /api/auth/switch-tenant { targetTenantId }
// BFF sets httpOnly cookie; returns { tenantSlug }
```

`apps/web/app/switch-tenant/page.tsx` — `'use client'`:
- Same visual layout as `plan/journey/customer/prototypes/login/01-select-tenant.html` (centered, full height, BeloAuto logo, tenant cards)
- On mount: calls `fetchCustomerTenants()`
  - Loading: skeleton cards
  - Empty (customer has only 1 tenant): redirect to `/{currentSlug}/minha-conta` (should not reach this page)
- Shows current tenant first, marked "Atual" (non-clickable) — read `tenantSlug` from JWT cookie to identify current
- Other tenant cards: clickable → calls `switchTenant(targetTenantId)` → on success `router.push('/{newSlug}')` → cookie updated → hotsite refreshes as logged-in customer of new tenant
- `"← Voltar sem trocar"` link at bottom → `router.back()`
- Error (network failure on switch): inline alert "Não foi possível trocar de empresa. Tente novamente." + retry button

`CustomerShell` update (in `apps/web/components/customer/CustomerShell.tsx`):
- Avatar dropdown: add "Trocar empresa" item between "← Site BeloAuto" and "Sair" links
- **Only render this item when customer has 2+ tenants.** Detection: call `fetchCustomerTenants()` on mount of CustomerShell (or include tenant count in JWT payload if available). If the call returns an empty list → do not render the "Trocar empresa" item.
- "Trocar empresa" links to `/switch-tenant`

**Acceptance criteria:**
- [ ] `GET /v1/customers/tenants` (CUSTOMER JWT) returns list of tenants excluding current; each with name, slug, loyaltyPoints
- [ ] Tenant isolation: Customer A cannot retrieve Customer B's tenant list
- [ ] "Trocar empresa" item visible in avatar dropdown when `fetchCustomerTenants()` returns at least 1 item
- [ ] "Trocar empresa" item hidden when customer has only 1 tenant
- [ ] `GET /switch-tenant` renders current tenant (marked "Atual") + other tenants as cards
- [ ] Clicking another tenant calls `POST /api/auth/switch-tenant` + redirects to `/{newSlug}` on success
- [ ] New tenant's hotsite renders in logged-in state (cookie updated)
- [ ] Network error on switch → inline alert + retry; no navigation
- [ ] `"← Voltar sem trocar"` navigates back without switching
- [ ] `.http` block added for `GET /v1/customers/tenants`
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M124-S01 (switch-tenant cookie fix), M124-S03 (`TenantOption` type + `/select-tenant` visual pattern), M126-S01 (CustomerShell exists)

---

## Dependency order

```
S01 ──────────────────────────────────────────────────────────┐
S02 ─────────────────────┐                                    │
                         ▼                                    ▼
                        S03 ──── S04 (parallel) ──────────── S05
                                  │
                                  ▼
                                 S06 (parallel with S04)
                                  │
                         ┌────────┴──────────┐
                         ▼                   ▼
                        S07               S08 (needs M124-S01 too)
```

S01 and S02 can start in parallel on day 1.
S03 starts after S01 + S02.
S04 and S06 start in parallel with S03.
S05 starts after S03 + S04.
S07 starts after S01 (shell) + S02 (balance BFF) + S06 (entries BFF).
S08 starts after S01 (shell) + M124-S01 (switch cookie fix).

---

## Open questions (resolve before S03 starts)

- [ ] **`cancellation_window_hours` availability:** is this value accessible to the frontend without a dedicated settings endpoint? Options: (a) include it in the JWT payload (already done for tenantSlug), (b) add a `GET /v1/tenant/settings` BFF endpoint returning the public booking settings, (c) hardcode `48` as MVP default and read from settings later. Option (c) is simplest for MVP.
- [ ] **"Total washes completed" (UC-006 step 6):** not available from `GET /v1/loyalty/balance`. Drop from MVP Minha Conta or derive from `items.filter(b => b.status === 'COMPLETED').length` client-side?
- [ ] **After-cancel destination (UC-007):** confirmed — redirect to `/{slug}/minha-conta` list after successful cancel. Booking appears in Histórico as CANCELLED on next load.
- [ ] **`infoResponseMessage` already filled:** if the customer already responded to an info request (status back to PENDING but then re-requested), should the form be shown again or just display the previous response? Recommendation: hide the form when `infoResponseMessage != null`.
- [ ] **`GET /v1/bookings` pagination for MVP:** UC-006 does not specify pagination. Load all bookings with `limit=50` and display all. No infinite scroll for MVP.
