# M128 — Staff Loyalty Dashboard

**Phase:** Local Development
**Goal:** Staff and managers can look up any customer's loyalty balance, earning history, and redemption history from a dedicated dashboard section (`/dashboard/loyalty`); and can apply a points-based discount when marking a booking complete (UC-009 A6), with the redemption recorded automatically via the event chain.
**Depends on:** M10 (loyalty backend — balance, entries, redemptions, redeem use cases all exist), M125 (staff dashboard shell + `MarkCompleteSheet` base — M125-S12 must ship before M128-S04), M127-S03 (Configurações form — see M128-S05 note)
**Blocks:** nothing (standalone feature slice)
**Journey prototypes:** `plan/journey/staff/prototypes/fidelidade/` · `plan/journey/staff/prototypes/agenda/04-mark-complete.html` (loyalty strip added)
**UCs covered:** UC-016 (admin/staff variant), UC-009 A6 (redemption during completion)

> **Architecture decision — redemption via event (not BFF orchestration):**
> The redemption is triggered by the existing `BookingCompleted` domain event, not by the BFF calling `POST /v1/loyalty/redeem` as a second HTTP call. The loyalty `BookingCompletedHandler` is extended to check `event.data.discountByPoints` — if present, it calls `RecordRedemptionUseCase` after recording earning entries. This keeps the BFF thin (one call: `PATCH /complete`) and the redemption idempotent (dedup via `eventId` in `processed_events`). The BFF's `POST /v1/loyalty/redeem` route remains for future use cases (standalone manual redemption).

---

## Story dependency order

```
S01 (backend) ──────────────────────────┐
                                        ▼
S02 (BFF) ──────────────────────────── S03 (frontend: loyalty pages)
                                     ── S04 (frontend: mark-complete strip)  ← also needs M125-S12
S05 (frontend: settings field) ──────── (parallel with S03/S04, needs M127-S03)
```

---

## Stories

---

### M128-S01 — Backend: `points_per_currency_unit` + `discountByPoints` in booking completion

**Agent:** `backend-ts`
**Complexity:** M
**Docs to load:** `docs/21-TENANTS_SETTINGS_SCHEMA.md` §1, `docs/04-USE_CASES.md` § UC-009 A6, `docs/ENGINEERING_RULES.md`, `plan/M10-COMPLETION-LOYALTY_IMPLEMENTATION_DETAILS_IA.md`

**Description:**
Three targeted additions across two bounded contexts. No new use cases — all changes are extensions of existing ones.

> 🔍 **Discover before starting:**
> - Read `apps/backend/src/contexts/platform/domain/value-objects/tenant-settings.vo.ts` in full — confirm `LoyaltySettings` interface and Zod schema location.
> - Read `apps/backend/src/contexts/booking/application/dtos/complete-booking.dto.ts` and `apps/backend/src/contexts/booking/domain/booking.aggregate.ts` `complete()` method — understand how `totalActualPrice` is currently computed.
> - Read `apps/backend/src/contexts/loyalty/infrastructure/events/booking-completed.handler.ts` — understand the existing earning entry flow before extending it.
> - Verify `RecordRedemptionUseCase` exists in `apps/backend/src/contexts/loyalty/application/use-cases/` — confirm its DTO shape (`customerId`, `pointsToRedeem`, `bookingId?`, `notes?`).

---

#### Part A — `points_per_currency_unit` in `TenantSettingsVO`

**File:** `apps/backend/src/contexts/platform/domain/value-objects/tenant-settings.vo.ts`

Add to `LoyaltySettings` interface:
```typescript
points_per_currency_unit: number; // 0 = redemption disabled; e.g. 10 = 10 pts → 1 currency unit
```

Add to the Zod loyalty schema:
```typescript
points_per_currency_unit: z.number().int().min(0).max(10000).default(0),
```

Add to `TenantSettingsDefaults.loyalty`:
```typescript
points_per_currency_unit: 0,
```

**Tests:** Update `apps/backend/src/contexts/platform/domain/value-objects/tenant-settings.spec.ts` — add cases: valid `points_per_currency_unit = 10`, zero (disabled), boundary 10000, reject negative, reject > 10000.

---

#### Part B — `discountByPoints` in `CompleteBookingDto` + `Booking.complete()`

**File:** `apps/backend/src/contexts/booking/application/dtos/complete-booking.dto.ts`

Add optional field to `CompleteBookingBodySchema`:
```typescript
discountByPoints: z
  .object({
    pointsUsed: z.number().int().positive(),
    amountDeducted: z.number().positive(),
  })
  .optional(),
```

Add to `CompleteBookingDto`:
```typescript
discountByPoints?: { pointsUsed: number; amountDeducted: number };
```

**Validation in use case** (`CompleteBookingUseCase`):
- If `dto.discountByPoints` is present AND `booking.customerId` is null → throw `LoyaltyRedemptionNotAvailableError` (guest bookings cannot redeem points)
- If `dto.discountByPoints` is present AND `settings.loyalty.points_per_currency_unit === 0` → throw `LoyaltyRedemptionDisabledError`
- Cap check: `pointsUsed <= currentBalance` is enforced by `RecordRedemptionUseCase` (loyalty context) — do not duplicate here
- `amountDeducted` must equal `Math.floor(pointsUsed / points_per_currency_unit)` within ±0.01 — reject if mismatch to prevent frontend manipulation

**`Booking.complete()` signature update** (`booking.aggregate.ts`):
```typescript
complete(
  completedBy: string,
  lines: { lineId: string; actualPriceCharged: number }[],
  afterServicePhotoUrls: string[],
  adminNotes?: string,
  discountByPoints?: { pointsUsed: number; amountDeducted: number },
): void
```

`totalActualPrice` calculation:
```typescript
const linesTotal = lines.reduce((sum, l) => sum + l.actualPriceCharged, 0);
const discount = discountByPoints?.amountDeducted ?? 0;
this.props.totalActualPrice = linesTotal - discount; // cannot go below 0
```

---

#### Part C — `discountByPoints` in `BookingCompleted` event + loyalty handler extension

**File:** `apps/backend/src/contexts/booking/domain/events/booking-completed.event.ts`

Add to `BookingCompletedData`:
```typescript
discountByPoints?: { pointsUsed: number; amountDeducted: number };
```

The `Booking.complete()` method already publishes `BookingCompleted` — update it to include `discountByPoints` in the event data when present.

**File:** `apps/backend/src/contexts/loyalty/infrastructure/events/booking-completed.handler.ts`

After `await this.recordLoyaltyEntries.execute(...)`, add:
```typescript
if (event.data.discountByPoints && event.data.customerId) {
  await this.recordRedemption.execute({
    tenantId: event.tenantId,
    eventId: event.eventId + '-redemption', // sub-key to keep idempotency key unique
    correlationId: event.correlationId,
    customerId: event.data.customerId,
    pointsToRedeem: event.data.discountByPoints.pointsUsed,
    bookingId: event.data.bookingId,
    notes: `Desconto na conclusão do agendamento`,
  });
}
```

Inject `RecordRedemptionUseCase` into the handler (add to `LoyaltyModule` providers and the handler's constructor).

> **Idempotency note:** `eventId + '-redemption'` is stored in `processed_events` separately from the earning-entry pass (`eventId` alone). This ensures a nack/retry of the full handler doesn't re-record the earning entries but also doesn't skip the redemption.

---

**HTTP file** (`apps/backend/http/booking/bookings.http`):
Update the `PATCH /bookings/:id/complete` request block to include an example with `discountByPoints`.

**Acceptance criteria:**
- [ ] `TenantSettingsVO` accepts and validates `loyalty.points_per_currency_unit` (0–10000, default 0)
- [ ] `PATCH /bookings/:id/complete` with `discountByPoints` → `totalActualPrice = linesTotal - amountDeducted`
- [ ] `PATCH /bookings/:id/complete` with `discountByPoints` on a guest booking → `422` with `loyalty-redemption-not-available`
- [ ] `PATCH /bookings/:id/complete` when `points_per_currency_unit = 0` → `422` with `loyalty-redemption-disabled`
- [ ] `BookingCompleted` event carries `discountByPoints` when present
- [ ] `BookingCompletedHandler` in loyalty context calls `RecordRedemptionUseCase` when `discountByPoints` is in event
- [ ] Redemption is idempotent — replaying the event does not create duplicate redemption
- [ ] Unit tests for `Booking.complete()` with and without `discountByPoints`
- [ ] Integration test: complete booking with discount → loyalty balance decremented by `pointsUsed`
- [ ] Integration test: tenant isolation — cannot apply discount to another tenant's customer

**Dependencies:** M10

---

### M128-S02 — BFF: customer search + balance enrichment + complete body update

**Agent:** `bff-ts`
**Complexity:** M
**Docs to load:** `docs/24-BFF_ARCHITECTURE.md`, `docs/14-API_CONTRACTS.md`

**Description:**
Three additions to the BFF: a new staff-facing customer search endpoint, enriching the loyalty balance response with the conversion rate, and forwarding `discountByPoints` through the booking completion body. Also fixes the stale `@beloauto/types` loyalty shapes.

> 🔍 **Discover before starting:**
> - Read `apps/bff/src/customers/customers.controller.ts` — confirm there is no `STAFF|MANAGER`-accessible GET route yet. The only routes are `GET /me` and `PATCH /me` (CUSTOMER-only).
> - Check `apps/backend/src/contexts/customer/infrastructure/` for an existing staff-facing customer list/search endpoint. If it exists (`GET /customers?search=`), the BFF just proxies it. If not, this story adds it to the backend as a thin read — check the customer controller in the backend too.
> - Read `apps/bff/src/loyalty/loyalty.types.ts` — confirm `LoyaltyBalanceResponse` shape.
> - Confirm `points_per_currency_unit` is accessible from `TenantContext` in the BFF after M128-S01 ships.

---

#### Part A — Customer search endpoint

Add to `apps/bff/src/customers/customers.controller.ts`:

```typescript
@Get()
@Roles('STAFF', 'MANAGER')
searchCustomers(
  @Query('search') search: string,
  @Query('limit') limit?: string,
): Promise<CustomerSearchListResponse> {
  const params = new URLSearchParams({ search });
  if (limit) params.set('limit', limit);
  return this.backendHttp.get<CustomerSearchListResponse>(`/customers?${params}`);
}
```

If the backend `GET /customers` endpoint does not exist, add it in the same commit:
- Backend: `apps/backend/src/contexts/customer/infrastructure/controllers/customer.controller.ts`
- Route: `GET /customers?search=&limit=20`
- Guard: `StaffOrManagerRoleGuard`
- Query: `ILIKE %search%` on `name` + `email`, scoped to `tenantId`, returns `{ customerId, name, email, currentPoints }`
- `currentPoints` requires joining `loyalty_balances` — or calling `ILoyaltyBalanceRepository.findByCustomer()` per result (N+1 acceptable at limit=20 for MVP). Use port, not direct join.

`@beloauto/types` additions (`packages/types/src/customer.dto.ts` or new file):
```typescript
export interface CustomerSearchResult {
  readonly customerId: string;
  readonly name: string;
  readonly email: string;
  readonly currentPoints: number;
}

export interface CustomerSearchListResponse {
  readonly items: CustomerSearchResult[];
  readonly total: number;
}
```

---

#### Part B — Balance response enrichment

Update `apps/bff/src/loyalty/loyalty.controller.ts` `getBalanceAdmin()` (and `getBalance()` for the customer-facing route):

After fetching balance from backend, read `points_per_currency_unit` from tenant context and append it:

```typescript
@Get('customers/:customerId/loyalty/balance')
@Roles('MANAGER', 'STAFF')
async getBalanceAdmin(
  @Param('customerId', ParseUUIDPipe) customerId: string,
): Promise<EnrichedLoyaltyBalanceResponse> {
  const balance = await this.backendHttp.get<LoyaltyBalanceResponse>(
    `/customers/${customerId}/loyalty/balance`,
  );
  return {
    ...balance,
    conversionRate: this.tenantContext.settings.loyalty.points_per_currency_unit,
  };
}
```

Similarly enrich `getBalance()` (customer-own route) — the frontend loyalty strip needs `conversionRate` there too.

`@beloauto/types` — fix and extend (`packages/types/src/loyalty.dto.ts`):
```typescript
// Replace the stale LoyaltyBalanceResponse:
export interface LoyaltyBalanceResponse {
  readonly currentPoints: number;
  readonly nextExpiryDate: string | null;   // ISO-8601
  readonly nextExpiryPoints: number | null;
}

export interface EnrichedLoyaltyBalanceResponse extends LoyaltyBalanceResponse {
  readonly conversionRate: number; // points_per_currency_unit; 0 = redemption disabled
}

// Replace the stale LoyaltyEntryResponse:
export interface LoyaltyEntryItem {
  readonly id: string;
  readonly serviceName: string;
  readonly points: number;
  readonly earnedAt: string;  // ISO-8601
  readonly expiresAt: string; // ISO-8601
  readonly isActive: boolean; // expiresAt > now
}

export interface LoyaltyRedemptionItem {
  readonly id: string;
  readonly pointsRedeemed: number;
  readonly amountDeducted: number;
  readonly redeemedAt: string; // ISO-8601
  readonly bookingId: string | null;
  readonly notes: string | null;
}

export interface PaginatedLoyaltyEntriesResponse {
  readonly items: LoyaltyEntryItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface PaginatedLoyaltyRedemptionsResponse {
  readonly items: LoyaltyRedemptionItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
```

> **Breaking change:** `LoyaltyBalanceResponse` shape changes. Since no frontend currently consumes it (loyalty frontend doesn't exist yet), this is safe. The BFF's `loyalty.types.ts` local type must also be aligned.

---

#### Part C — `discountByPoints` forwarded through completion

Update `apps/bff/src/bookings/bookings.controller.ts` complete route body schema:

```typescript
const CompleteBookingBodySchema = z.object({
  lines: z.array(z.object({
    lineId: z.uuid(),
    actualPriceCharged: z.number().nonnegative(),
  })).min(1),
  afterServicePhotoUrls: z.array(z.string()).optional().default([]),
  adminNotes: z.string().optional(),
  discountByPoints: z.object({
    pointsUsed: z.number().int().positive(),
    amountDeducted: z.number().positive(),
  }).optional(),
});
```

Forward `discountByPoints` to backend in the request body. No BFF-side validation — backend is authoritative.

`@beloauto/types` addition:
```typescript
export interface CompleteBookingRequest {
  readonly lines: CompleteBookingLineInput[];
  readonly afterServicePhotoUrls?: string[];
  readonly adminNotes?: string;
  readonly discountByPoints?: {
    readonly pointsUsed: number;
    readonly amountDeducted: number;
  };
}
```

---

**HTTP files:**
- `apps/bff/http/customers/customers.http` — add `GET /v1/customers?search=` block with STAFF token
- `apps/bff/http/loyalty/loyalty.http` — update balance block to show `conversionRate` in response
- `apps/bff/http/bookings/bookings.http` — update complete block to show `discountByPoints` example

**Acceptance criteria:**
- [ ] `GET /v1/customers?search=jo` with STAFF JWT → list of matching customers with `currentPoints`
- [ ] `GET /v1/customers` with CUSTOMER JWT → `403`
- [ ] `GET /v1/customers/:id/loyalty/balance` response includes `conversionRate` field (0 when disabled)
- [ ] `PATCH /v1/bookings/:id/complete` forwards `discountByPoints` to backend when present
- [ ] `LoyaltyBalanceResponse`, `EnrichedLoyaltyBalanceResponse`, `LoyaltyEntryItem`, `LoyaltyRedemptionItem`, `PaginatedLoyaltyEntriesResponse`, `PaginatedLoyaltyRedemptionsResponse`, `CompleteBookingRequest`, `CustomerSearchResult`, `CustomerSearchListResponse` all exported from `packages/types/src/index.ts`
- [ ] `tsc --noEmit` passes across monorepo (breaking type change handled everywhere)

**Dependencies:** M128-S01

---

### M128-S03 — Frontend: `/dashboard/loyalty` — customer search + loyalty detail pages

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `plan/journey/staff/fidelidade.md`, `plan/journey/staff/prototypes/fidelidade/dev-notes.md`

**Description:**
Two pages under a new `/dashboard/loyalty` route. The search page lets staff find any customer by name/email; the detail page shows their active balance (with currency equivalent), earning history tab (active vs. expired entries), and redemption history tab.

> 🔍 **Discover before starting:**
> - Confirm M128-S02 has shipped: `GET /v1/customers?search=` and enriched balance response exist.
> - Check `apps/web/app/dashboard/` structure — place new route at `loyalty/`.
> - Confirm `apps/web/lib/api/dashboard/` convention (flat files or per-module folders).

**Prototype references:**
- `plan/journey/staff/prototypes/fidelidade/00-customer-search.html`
- `plan/journey/staff/prototypes/fidelidade/01-customer-loyalty.html`
- `plan/journey/staff/prototypes/fidelidade/01b-no-entries.html`
- `plan/journey/staff/prototypes/fidelidade/01c-no-results.html`

---

**`apps/web/lib/api/dashboard/loyalty.ts`:**
```typescript
searchCustomers(term: string): Promise<CustomerSearchListResponse>
// GET /v1/customers?search=:term&limit=20

fetchCustomerLoyaltyBalance(customerId: string): Promise<EnrichedLoyaltyBalanceResponse>
// GET /v1/customers/:customerId/loyalty/balance

fetchCustomerLoyaltyEntries(customerId: string, page?: number): Promise<PaginatedLoyaltyEntriesResponse>
// GET /v1/customers/:customerId/loyalty/entries?page=:page&limit=20

fetchCustomerLoyaltyRedemptions(customerId: string, page?: number): Promise<PaginatedLoyaltyRedemptionsResponse>
// GET /v1/customers/:customerId/loyalty/redemptions?page=:page&limit=20
```

---

**`apps/web/app/dashboard/loyalty/page.tsx`** — server component:
- Reads `searchParams.customerId` (optional)
- If no `customerId`: renders `<LoyaltySearchPage />`
- If `customerId` present: fetches balance + entries + redemptions in parallel (`Promise.all`), renders `<CustomerLoyaltyPage balance={...} entries={...} redemptions={...} />`
- 404 if `customerId` given but backend returns 404

**`apps/web/components/dashboard/loyalty/LoyaltySearchPage.tsx`** — `'use client'`:
- Search input with debounce (300ms)
- On empty: "Clientes recentes" — `GET /v1/customers?search=&limit=5` (most recent, sorted by last booking date)
- On search: live results as user types
- Each result row: avatar (initials), name, email, `currentPoints` badge; entire row → `router.push('/dashboard/loyalty?customerId=:id')`
- No results state (per `01c-no-results.html`)

**`apps/web/components/dashboard/loyalty/CustomerLoyaltyPage.tsx`** — `'use client'` (manages tab state):
- Customer header: avatar + name + email
- **Balance card** (blue gradient per prototype):
  - `currentPoints` (large number)
  - If `nextExpiryDate`: amber inline strip "X pts expiram em DD MMM YYYY"
  - `conversionRate > 0`: "N pts = R$1 · Valor total: R$ X"
  - `conversionRate === 0`: no conversion line (feature disabled)
- **Tab bar**: "Histórico de ganhos" | "Resgates"
- **Earnings tab** (`LoyaltyEntryItem[]`): sorted `earnedAt DESC`; active entries normal weight; expired entries `opacity: 0.45` with "expirado" badge; "+N pts" right-aligned in green
- **Redemptions tab** (`LoyaltyRedemptionItem[]`): `redeemedAt DESC`; each row shows pts redeemed, amount saved, linked booking ref when `bookingId` present; "−N pts" right-aligned in red
- "Carregar mais" button per tab when `total > items.length` (calls fetcher with `page + 1`, appends results)
- **Zero entries state** (per `01b-no-entries.html`): muted balance card (grey) + "Nenhum ponto acumulado ainda"

**Validation (per SonarCloud rules):**
```typescript
interface Props {
  readonly balance: EnrichedLoyaltyBalanceResponse;
  readonly entries: PaginatedLoyaltyEntriesResponse;
  readonly redemptions: PaginatedLoyaltyRedemptionsResponse;
}
```

**Testing:** `app/**/page.tsx` — no unit tests (Playwright E2E). No Vitest tests needed for this story.

**Acceptance criteria:**
- [ ] `GET /dashboard/loyalty` renders search input + "Clientes recentes" list
- [ ] Typing in search field debounces 300ms and updates results
- [ ] No results for unknown term → "Nenhum cliente encontrado" empty state
- [ ] Clicking a customer row navigates to `/dashboard/loyalty?customerId=:id`
- [ ] Balance card shows `currentPoints`, expiry strip (when `nextExpiryDate != null`), conversion line (when `conversionRate > 0`)
- [ ] "Histórico de ganhos" tab: active entries normal, expired at 45% opacity with badge
- [ ] "Resgates" tab: each redemption shows pts, amount saved, booking ref (when present)
- [ ] "Carregar mais" appends next page without replacing current results
- [ ] Zero entries state renders without JS error
- [ ] Fidelidade item active in sidebar navigation
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M128-S02, M125-S01 (dashboard shell + sidebar Fidelidade nav item)

---

### M128-S04 — Frontend: loyalty strip in `MarkCompleteSheet` (UC-009 A6)

**Agent:** `frontend-ts`
**Complexity:** S
**Docs to load:** `docs/04-USE_CASES.md` § UC-009 A6, `plan/journey/staff/prototypes/agenda/04-mark-complete.html`

**Description:**
Extends the `MarkCompleteSheet` component (built in M125-S12) with the loyalty redemption strip. Visible only when `booking.customerId != null` AND `conversionRate > 0`. Staff enters points to use (or clicks "Usar todos"), sees the BRL discount live, and the discount is included in the completion request body.

> 🔍 **Discover before starting:**
> - Confirm M125-S12 shipped `MarkCompleteSheet`. Read it in full before adding anything.
> - Confirm `StaffBookingDetailResponse` (from M125-S04) includes `loyaltyBalance: number | null` and that `conversionRate` is available — either from `EnrichedLoyaltyBalanceResponse` (a separate BFF call at mount) or already in the detail response. Decide: does the completion screen need a separate `GET /loyalty/balance` call to get `conversionRate`, or should `StaffBookingDetailResponse` include it? Recommend the latter — add `loyaltyConversionRate: number` to `StaffBookingDetailResponse` (small addition to M128-S02 scope or here).
> - Read `apps/web/lib/api/dashboard/bookings.ts` `completeBooking()` fetcher — confirm it accepts `CompleteBookingRequest` from `@beloauto/types` and that `discountByPoints` is now in the type.

**Prototype reference:** `plan/journey/staff/prototypes/agenda/04-mark-complete.html` (loyalty strip section)

**What to add to `MarkCompleteSheet`:**

Condition: `props.loyaltyBalance !== null && props.loyaltyBalance > 0 && props.conversionRate > 0`

If condition is false (guest booking or feature disabled): loyalty strip not rendered.

**`LoyaltyRedemptionStrip` component** (inline or separate file):

```
Props:
  availablePoints: number          // booking.loyaltyBalance
  conversionRate: number           // points_per_currency_unit
  linesTotalAmount: number         // live sum of actualPriceCharged across lines
  onChange: (discount: { pointsUsed: number; amountDeducted: number } | null) => void
```

Layout (per prototype):
- Blue-tinted card section
- Header: "João tem N pontos disponíveis" + pts badge + "= R$X" hint
- Input: `[____] pts = R$ X` (live conversion as user types) + "Usar todos" button
- Validation:
  - `pointsUsed ≤ availablePoints`
  - `amountDeducted = Math.floor(pointsUsed / conversionRate)`
  - Cap: `amountDeducted` cannot exceed `linesTotalAmount` (discount ≤ booking total)
- When `pointsUsed > 0`: discount row appears below the lines total: "Desconto fidelidade (N pts): − R$X"
- Final total = `linesTotalAmount - amountDeducted`

**`MarkCompleteSheet` state additions:**
```typescript
discountByPoints: { pointsUsed: number; amountDeducted: number } | null
```

On confirm: pass `discountByPoints` to `completeBooking()` fetcher.

**Acceptance criteria:**
- [ ] Loyalty strip not rendered for guest bookings (`loyaltyBalance === null`)
- [ ] Loyalty strip not rendered when `conversionRate === 0`
- [ ] Points input accepts integer values; "Usar todos" fills maximum valid amount
- [ ] `amountDeducted` live-updates as user types points
- [ ] Discount is capped at lines total (cannot go below R$0)
- [ ] Discount row appears in the totals section when `pointsUsed > 0`
- [ ] On confirm: `completeBooking()` called with `discountByPoints` when points are applied
- [ ] On confirm: `completeBooking()` called without `discountByPoints` when strip is unused
- [ ] Completion success banner shows loyalty discount row when discount was applied
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S12 (base `MarkCompleteSheet`), M128-S02 (`CompleteBookingRequest` type with `discountByPoints`)

---

### M128-S05 — Frontend: `points_per_currency_unit` in Configurações form

**Agent:** `frontend-ts`
**Complexity:** S
**Docs to load:** `docs/04-USE_CASES.md` § UC-026, `docs/21-TENANTS_SETTINGS_SCHEMA.md` §1

**Description:**
Add the `points_per_currency_unit` field to the Fidelidade section of the Configurações settings form. If M127-S03 has not shipped yet, include this field there directly — do not ship this as a separate story, fold it into M127-S03's AC. If M127-S03 has already shipped, this story patches `SettingsForm.tsx`.

> 🔍 **Discover before starting:** Check whether `apps/web/components/dashboard/settings/SettingsForm.tsx` exists. If yes, this story applies. If not, tell the implementation agent to add this field to M127-S03 directly.

**What to add to `SettingsForm.tsx`** (in the Fidelidade section, after `loyaltyExpiryDays`):

| Field | Input | Label | Validation |
|---|---|---|---|
| `pointsPerCurrencyUnit` | `<input type="number">` | "Pontos por unidade monetária" | integer ≥ 0, ≤ 10000 |

Hint text: "Quantos pontos equivalem a 1 unidade monetária (ex: 10 = 10 pts → R$1). Zero desativa o desconto por pontos."

`UpdateTenantSettingsRequest` already includes this field after M128-S02.

**Acceptance criteria:**
- [ ] Field renders in Fidelidade section with correct label and hint
- [ ] Value 0 is accepted (disables feature)
- [ ] Value > 10000 → inline validation error "Máximo 10000"
- [ ] Non-integer input → rounded down or rejected
- [ ] Save sends `pointsPerCurrencyUnit` in the PATCH body
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S03 (settings form base), M128-S02 (`UpdateTenantSettingsRequest` type)

---

## Open questions (resolve before stories start)

- [ ] **`loyaltyConversionRate` in booking detail response:** should `StaffBookingDetailResponse` (M125-S04) include `loyaltyConversionRate: number` so `MarkCompleteSheet` doesn't need a separate balance call on mount? Recommended: yes — add to M128-S02 scope and M128-S04 implementation.
- [ ] **"Clientes recentes" query:** does `GET /v1/customers?search=&limit=5` with empty `search` return the 5 most recently active customers (sorted by last booking `completedAt`)? Confirm the backend query plan or simplify to alphabetical sort for MVP.
- [ ] **Redemption notes field in UI:** the `RecordRedemptionUseCase` accepts optional `notes`. The prototype auto-fills "Desconto na conclusão do agendamento". Should staff be able to add a custom note? MVP recommendation: auto-fill only, no extra input.
- [ ] **`points_per_currency_unit` in balance response for the customer-facing route:** `GET /v1/loyalty/balance` (CUSTOMER) is used by M126 (`minha-conta`) to show the balance strip. Should it also include `conversionRate`? If the tenant has redemption enabled, the customer might want to see "Seus 350 pts valem R$35,00". Recommendation: yes, enrich both routes in M128-S02 — M126 can use the field when it ships.
- [ ] **Sidebar "Fidelidade" nav item in M125-S01:** the dashboard shell spec (M125-S01) lists "Fidelidade" as a nav item. Confirm it was included and links to `/dashboard/loyalty`. If omitted, M128-S03 must patch `Sidebar.tsx`.
