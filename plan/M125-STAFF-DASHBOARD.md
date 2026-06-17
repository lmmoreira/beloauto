# M125 — Staff Booking Management Dashboard

**Phase:** Local Development  
**Goal:** Staff and Manager can manage a booking's full lifecycle from a real dashboard — view PENDING/INFO_REQUESTED requests and take triage action (approve / reject / request more info), then for an APPROVED booking, mark it complete, reschedule it, or cancel it — without touching the backend API directly.  
**Depends on:** M08 (booking approval backend + BFF action endpoints already implemented), M09 (cancellation + reschedule backend), M10 (loyalty earning on completion), M115 (production readiness baseline)  
**Blocks:** M13 (full dashboard — this milestone delivers the booking management slice, M13 may add other sections on top)  
**Journey prototype:** `plan/journey/staff/prototypes/agenda/` — reviewed; UC-003/004/005 audit done 2026-06-16; UC-008/009 audit + prototype extension done 2026-06-16 (same day — `agenda.md` extended in place rather than a new journey file, since the lifecycle actions live on the same `/dashboard/bookings/[id]` route, branched by status)

> **Discovery note (applies to this entire milestone):** Stories S02–S05, S11, S12 are scoped from the prototype and UC audit. Several details will only be resolved when implementation begins — particularly what BFF endpoints already exist vs. what needs adding, and which `@beloauto/types` booking types survived M12. Explicit "🔍 Discover before starting" callouts mark every assumption that must be verified before writing code. Do not skip these — acting on a wrong assumption here caused two CI failures in M12. For S11/S12 specifically: the UC-008/UC-009 audit already confirmed `cancel-admin`, `reschedule`, and `complete` backend+BFF endpoints are fully implemented (not just planned) — these two stories are frontend-only.

---

## Stories

---

### M125-S01 — Dashboard shell: layout, middleware, auth guard

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `docs/REPOSITORY_STRUCTURE.md`

**Description:**  
Implement the foundational shell that every dashboard page will live inside. This is the prerequisite for all other M125 stories — nothing else can be built until the layout exists.

The shell matches `plan/journey/shared/dashboard-shell.html` and `plan/journey/staff/prototypes/agenda/00-agenda.html`:
- **Mobile (`<1024px`):** sticky topbar (brand + avatar) + `main` + bottom tab nav (Agenda | Horários | Serviços | Fidelidade | + Manager-only tabs)
- **Desktop (`≥1024px`):** fixed left sidebar (logo, nav, manager section, user footer) + topbar (page title + date + avatar) + `main`
- **Role-aware nav:** "Somente Gerente" section in sidebar is only rendered when JWT role = MANAGER

> 🔍 **Discover before starting:** Check `apps/web/app/dashboard/` — there may be a `layout.tsx` stub or middleware already. If `apps/web/middleware.ts` exists, read it in full before adding route protection. Read `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md` for canonical folder structure before placing any new files.

**What to create:**

`apps/web/middleware.ts` — route protection for `/dashboard/**`:
- Read JWT from `httpOnly` cookie (same cookie set by UC-022/UC-025 login flow)
- If no JWT or JWT role is not `STAFF` | `MANAGER` → redirect to `/{tenantSlug}/staff-login` (exact path TBD — verify with UC-022 implementation)
- If JWT valid → pass through

`apps/web/app/dashboard/layout.tsx` — server component:
- Reads JWT from cookie (server-side, via `cookies()`)
- Extracts `{ tenantSlug, tenantName, userName, role }` from JWT payload
- Renders `<DashboardShell>` with those props

`apps/web/components/dashboard/DashboardShell.tsx` — `'use client'`, the shell wrapper:
- Sidebar (desktop) + topbar + `<main>` + bottom nav (mobile)
- Accepts `role: 'STAFF' | 'MANAGER'` and conditionally renders manager-only nav items

`apps/web/components/dashboard/Sidebar.tsx`:
- Logo block (tenant name + slug)
- Nav items: Agenda, Horários, Serviços, Fidelidade (STAFF + MANAGER)
- "Somente Gerente" label + Equipe + Configurações (MANAGER only — hidden for STAFF)
- Footer: avatar + user name + role badge + logout link

`apps/web/components/dashboard/Topbar.tsx`:
- Back arrow + title (drill-down pages)
- Page title (list pages)
- Status badge slot (optional — used by detail page)
- Avatar + today's date (desktop)

`apps/web/components/dashboard/BottomNav.tsx`:
- Mobile only (`<1024px`)
- Tabs matching sidebar nav items (role-aware)

**`dashboard-shell.html` CSS class reference (do not invent new classes — use what's in `shared/tokens.css`):**

| tokens.css class | Purpose |
|---|---|
| `.dashboard-topbar` | Sticky topbar wrapper |
| `.topbar-page-title` | Page title (hidden mobile) |
| `.topbar-date` | Date string (hidden mobile) |
| `.dashboard-layout` | Sidebar + main grid |
| `.sidebar` | Left sidebar (hidden mobile) |
| `.sidebar-header` | Logo + tenant name block |
| `.sidebar-nav` / `.sidebar-nav-item` / `.sidebar-nav-icon` | Nav items |
| `.sidebar-section-label` | "Somente Gerente" label |
| `.sidebar-footer` | Avatar + name + logout |
| `.main-content` | Right main area |
| `.dashboard-body` | Content padding wrapper |
| `.bottom-nav` | Mobile tab bar (hidden desktop) |
| `.auth-avatar` | Clickable avatar (NOT `.topbar-avatar` — hidden desktop) |
| `.role-badge` / `.role-badge-manager` | Role chip |
| `.status-badge` / `.status-pending` / `.status-approved` / etc. | Status chips |

**Acceptance criteria:**
- [ ] `GET /dashboard` redirects to `/dashboard/bookings` (or first meaningful page) — no blank screen
- [ ] Unauthenticated request to `/dashboard/**` redirects to staff login
- [ ] JWT with role `CUSTOMER` redirects to staff login (not a valid dashboard user)
- [ ] Sidebar visible at `≥1024px`; bottom nav visible at `<1024px`; neither both at once
- [ ] Manager-only nav section visible when role = MANAGER; hidden when role = STAFF
- [ ] `auth-avatar` (not `topbar-avatar`) used for all avatar elements — avatar is visible on both mobile and desktop
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M03 (JWT structure), UC-022/025 (login sets cookie)

---

### M125-S02 — BFF: staff booking list endpoint

**Agent:** `bff-ts`  
**Complexity:** S  
**Docs to load:** `docs/14-API_CONTRACTS.md` § Bookings, `docs/24-BFF_ARCHITECTURE.md`

**Description:**  
Provide a paginated, filterable booking list endpoint shaped for the booking queue UI. The queue shows a summary card per booking — customer name, services, scheduled time, status badge, total price.

> 🔍 **Discover before starting:** Open `apps/bff/src/bookings/bookings.controller.ts`. There is likely a `GET /v1/bookings` route already (built in M08/M09 for customer-side listing). Read its current shape, query params, and `@Roles` decorator. If it already returns a staff-friendly shape (customer name, service names, status), this story may reduce to adding/adjusting query params only. If it returns a customer-shaped response (own bookings only), a new dedicated staff variant is needed.

**Proposed endpoint (adjust based on discovery):**

> **Queue grouping resolved 2026-06-16** (see `agenda.md` "Queue scope"): the queue is grouped by urgency, not date — "Precisa de ação" (no date filter, ALL pending/info-requested), "Hoje" (approved, today only), "Próximos dias" (approved, future). One endpoint shape serves all three via different query params — no separate routes needed.

```
GET /v1/bookings
Headers: X-Actor-Role: STAFF | MANAGER, X-Tenant-ID: {tenantId}
Query params:
  status?   comma-separated BookingStatus values (default: PENDING,INFO_REQUESTED)
  date?     YYYY-MM-DD — exact-date filter, used for "Hoje" (status=APPROVED&date=today)
  from?     YYYY-MM-DD — range-start filter, used for "Próximos dias" (status=APPROVED&from=tomorrow)
  page?     integer (default: 1)
  limit?    integer (default: 20, max: 100)
```

`date` and `from` are mutually exclusive — "Precisa de ação" sends neither (no date filter at all, sorted by `scheduledAt ASC` regardless of day).

Response shape (new type `StaffBookingCardResponse` in `@beloauto/types`):
```typescript
interface StaffBookingCardResponse {
  bookingId: string;
  status: BookingStatus;
  scheduledAt: string;           // ISO-8601
  contactName: string;           // guest name or customer name
  serviceNames: string[];        // one per line, e.g. ["Lavagem Simples", "Enceramento"]
  totalPrice: MoneyAmount;
  totalDurationMins: number;
  isCustomer: boolean;           // true = authenticated customer; false = guest
}

interface StaffBookingListResponse {
  items: StaffBookingCardResponse[];
  total: number;
  page: number;
  limit: number;
}
```

**Acceptance criteria:**
- [ ] `GET /v1/bookings?status=PENDING,INFO_REQUESTED` (no date) returns ALL matching bookings regardless of date, sorted by `scheduledAt ASC`, scoped to tenant
- [ ] `GET /v1/bookings?status=APPROVED&date=2026-06-16` returns only that exact date's approved bookings
- [ ] `GET /v1/bookings?status=APPROVED&from=2026-06-17` returns approved bookings on/after that date
- [ ] `GET /v1/bookings` with CUSTOMER JWT → `403`
- [ ] `GET /v1/bookings` without auth → `401`
- [ ] Tenant isolation: Tenant A's MANAGER cannot retrieve Tenant B's bookings
- [ ] Empty result → `{ items: [], total: 0, page: 1, limit: 20 }` (not 404)
- [ ] `StaffBookingCardResponse` and `StaffBookingListResponse` added to `packages/types/src/booking.dto.ts`
- [ ] `.http` request block added to `apps/bff/http/bookings/bookings.http`

**Dependencies:** M125-S01, M08

---

### M125-S03 — Booking queue page (`/dashboard/bookings`)

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `plan/journey/staff/prototypes/agenda/00-agenda.html` (reference), `plan/journey/staff/agenda.md`

**Description:**  
Implement the booking queue — grouped by **urgency, not date** (resolved 2026-06-16, see `plan/journey/staff/agenda.md` "Queue scope"): "Precisa de ação" (all PENDING + INFO_REQUESTED, any date), "Hoje" (today's APPROVED, actionable), "Próximos dias" (future APPROVED, read-only glance). This is the first page a staff member sees after logging in.

> 🔍 **Discover before starting:** Verify the exact path of `fetchStaffBookings` — it must call `GET /v1/bookings` with `X-Actor-*` headers forwarded, three times with different query params (see M125-S02). Check whether a `lib/api/dashboard/` directory exists or if fetchers live flat in `lib/api/`. Follow whatever convention is already there.

**Prototype reference:** `plan/journey/staff/prototypes/agenda/00-agenda.html`  
**Route:** `/dashboard/bookings`

**What to create:**

`apps/web/lib/api/dashboard/bookings.ts`:
```typescript
fetchStaffBookings(params: { status: string; date?: string; from?: string; page?: number }): Promise<StaffBookingListResponse>
// GET /v1/bookings, sends auth cookie, X-Actor-* headers
```

`apps/web/app/dashboard/bookings/page.tsx` — server component:
- Calls `fetchStaffBookings` three times in parallel: `{ status: 'PENDING,INFO_REQUESTED' }` (no date), `{ status: 'APPROVED', date: today() }`, `{ status: 'APPROVED', from: tomorrow() }`
- Renders `<BookingQueuePage actionNeeded={...} today={...} upcoming={...} />`
- Empty state handled inline, per section

`apps/web/components/dashboard/bookings/BookingQueuePage.tsx`:
- Three sections, each a `<BookingSection title="..." items={...} />`: "Precisa de ação", "Hoje", "Próximos dias"
- Each card in "Precisa de ação" and "Próximos dias" shows its own date inline (e.g. "Hoje · 10:00", "Amanhã · 09:00", "Qui, 18 de junho · 09:00") since these sections span multiple days — "Hoje" cards show time only (date is implied by the section)
- Empty state per section: "Nenhum agendamento precisa de ação." / "Nenhum agendamento confirmado para hoje." / "Nenhum agendamento confirmado nos próximos dias." (pt-BR, not an error)
- Week-strip (`plan/journey/staff/prototypes/agenda/00-agenda.html`'s `.week-strip`) is a visual "this week at a glance" overview, NOT a filter — clicking "Hoje" scrolls to the Hoje section; clicking any future day scrolls to "Próximos dias" (an approximation — see `agenda.md` open question "Week-strip click target for future days"; a future PENDING booking for that day actually lives in "Precisa de ação", not "Próximos dias")

`apps/web/components/dashboard/bookings/BookingCard.tsx`:
- Customer name (truncated with ellipsis if long)
- Service names joined ", " 
- Scheduled time, with date prefix when the card is in "Precisa de ação" or "Próximos dias" (see above)
- Total price + duration
- Status badge (`.status-pending` / `.status-info` / `.status-approved`)
- INFO_REQUESTED card has blue left border (matches prototype `border-left: 3px solid var(--ba-primary)`)
- "Hoje" section cards show "Marcar concluído" as the primary quick action (links into M125-S12's flow) instead of "Aprovar"
- "Próximos dias" section cards have **no quick actions at all** — read-only, nothing to do until the day arrives (matches prototype's `opacity: 0.7`, non-link card)
- Entire card is a link → `/dashboard/bookings/:bookingId` (except "Próximos dias" cards, which are not links)

**Acceptance criteria:**
- [ ] Page renders three sections from three `fetchStaffBookings` calls, in the order: Precisa de ação, Hoje, Próximos dias
- [ ] "Precisa de ação" includes bookings from any date, sorted by `scheduledAt ASC`, each showing its date inline
- [ ] PENDING cards rendered with correct badge + no left border accent
- [ ] INFO_REQUESTED cards rendered with blue left border accent (see prototype)
- [ ] "Hoje" section only shows today's APPROVED bookings; primary action is "Marcar concluído"
- [ ] "Próximos dias" cards render with no quick actions and are not clickable links
- [ ] Empty state renders pt-BR message per section (not a JS error)
- [ ] Each actionable card links to `/dashboard/bookings/:bookingId`
- [ ] Customer name with long text is truncated (ellipsis) — does not break card layout
- [ ] Page is protected by M125-S01 middleware — unauthenticated access redirects
- [ ] No decorative filter tabs (Pendentes/Confirmados/Todos) — removed in the 2026-06-16 redesign; the sections themselves are the filter

**Dependencies:** M125-S01, M125-S02

---

### M125-S04 — BFF: booking detail endpoint for staff

**Agent:** `bff-ts`  
**Complexity:** M  
**Docs to load:** `docs/14-API_CONTRACTS.md` § Bookings + Loyalty, `docs/24-BFF_ARCHITECTURE.md`, `docs/04-USE_CASES.md` § UC-003

**Description:**  
Provide the full booking detail, enriched with the customer's loyalty balance. UC-003 step 1 explicitly says "The dashboard shows the customer's current active-points balance so the admin can decide." This requires BFF orchestration: backend booking detail + loyalty balance lookup.

> 🔍 **Discover before starting:** Open `apps/bff/src/bookings/bookings.controller.ts` and look for `GET /v1/bookings/:id`. It likely exists from M08. Check: (a) whether it already includes `loyaltyBalance`, (b) its `@Roles` guard — does it allow STAFF|MANAGER, or is it customer-only? If it serves both actors, the staff enrichment (loyalty balance) might need to be conditional on role. Verify `GET /v1/loyalty/:customerId/balance` or equivalent exists in the BFF from M10.

**Proposed endpoint (adjust based on discovery):**

```
GET /v1/bookings/:id
Headers: X-Actor-Role: STAFF | MANAGER, X-Tenant-ID, X-Actor-ID
```

Staff-shaped response type `StaffBookingDetailResponse` (add to `packages/types/src/booking.dto.ts`):
```typescript
interface StaffBookingDetailResponse {
  bookingId: string;
  status: BookingStatus;
  scheduledAt: string;
  type: 'GUEST' | 'CUSTOMER';

  // Contact / customer info
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: Address | null;
  pickupAddress: Address | null;

  // Loyalty (null for guest bookings)
  customerId: string | null;
  loyaltyBalance: number | null;     // current active points

  // Lines
  lines: StaffBookingLineResponse[];
  totalPrice: MoneyAmount;
  totalDurationMins: number;

  // Media
  beforeServicePhotoUrls: string[];   // signed read URLs

  // Admin-recorded fields
  infoRequestMessage: string | null;  // UC-005: what admin asked
  infoResponseMessage: string | null; // UC-005 A2: what customer answered
  approvedAt: string | null;
  approvedBy: string | null;          // staffId UUID
  rejectionReason: string | null;
}

interface StaffBookingLineResponse {
  lineId: string;
  serviceName: string;
  priceAtBooking: MoneyAmount;
  durationMinsAtBooking: number;
  pointsValueAtBooking: number;
  requiresPickupAddressAtBooking: boolean;
}
```

**BFF orchestration:**

When `customerId != null`:
1. `GET /bookings/:id` → backend booking detail
2. `GET /loyalty/balance?customerId=:customerId` (or equivalent loyalty endpoint) → `{ currentPoints }`
3. Compose response with `loyaltyBalance = currentPoints`

When `customerId == null` (guest booking): skip loyalty call, return `loyaltyBalance: null`.

Before-service photo URLs: call `IStorageService.getSignedReadUrl(path)` per photo path (same pattern as M115-S01). Or pass filePaths to frontend and have Next.js image proxy — decide at discovery.

**Acceptance criteria:**
- [ ] `GET /v1/bookings/:id` with STAFF|MANAGER JWT returns `StaffBookingDetailResponse`
- [ ] `loyaltyBalance` is populated for customer bookings; `null` for guest bookings
- [ ] `infoRequestMessage` populated when booking is INFO_REQUESTED or beyond
- [ ] `infoResponseMessage` populated when customer submitted info (UC-005 A2)
- [ ] CUSTOMER JWT → `403` (staff-only endpoint)
- [ ] Booking not in tenant → `404`
- [ ] Tenant isolation: MANAGER of Tenant A cannot retrieve Tenant B's booking detail
- [ ] `StaffBookingDetailResponse` + `StaffBookingLineResponse` in `packages/types/src/booking.dto.ts`
- [ ] `.http` block added/updated in `apps/bff/http/bookings/bookings.http`

**Dependencies:** M125-S01, M08, M10 (loyalty balance endpoint)

---

### M125-S05 — Booking detail page + all action flows (`/dashboard/bookings/[id]`)

**Agent:** `frontend-ts`  
**Complexity:** L  
**Docs to load:** `docs/04-USE_CASES.md` § UC-003, UC-004, UC-005, `plan/journey/staff/prototypes/agenda/01-booking-detail.html`, `plan/journey/staff/prototypes/agenda/01b-slot-conflict.html`

**Description:**  
The core of this milestone: the booking detail page where staff take action on each request. Three actions (approve / reject / request info) each have their own flow, and approval has an error branch (slot conflict). All success and error states are inline — no navigation to a separate page.

> 🔍 **Discover before starting:** Confirm the BFF action endpoints are wired correctly: `PATCH /v1/bookings/:id/approve`, `PATCH /v1/bookings/:id/reject`, `PATCH /v1/bookings/:id/request-info`. These were built in M08/M09 and should exist. Verify their exact request bodies and error codes (409 for slot conflict, 422 for validation). Also check whether `@beloauto/types` has `ApproveBookingRequest`, `RejectBookingRequest`, `RequestMoreInfoRequest` — M12-S07 explicitly dropped these ("re-added when the dashboard story is built"). They need to be re-added here.

**Prototype references:**  
- `plan/journey/staff/prototypes/agenda/01-booking-detail.html` — main detail + action panel + bottom sheets  
- `plan/journey/staff/prototypes/agenda/01b-slot-conflict.html` — slot conflict (UC-003 A1)  
- `plan/journey/staff/prototypes/agenda/01c-reject-success.html` — rejection confirmed inline state  
- `plan/journey/staff/prototypes/agenda/01d-info-success.html` — info request sent inline state  

**Route:** `/dashboard/bookings/[id]`

**`@beloauto/types` additions (do first, blocks component work):**
```typescript
// packages/types/src/booking.dto.ts
export interface ApproveBookingRequest { }  // empty body

export interface RejectBookingRequest {
  reason: string;  // max 200 chars, required
}

export interface RequestMoreInfoRequest {
  message: string; // max 200 chars, required
}

export interface ApproveBookingResponse {
  bookingId: string;
  status: 'APPROVED';
  approvedAt: string;
}

export interface SlotConflictSuggestion {
  startsAt: string;  // ISO-8601
  endsAt: string;
}

export interface SlotConflictError {
  error: 'slot-conflict';
  suggestions: SlotConflictSuggestion[];
}
```

**API fetcher additions (`apps/web/lib/api/dashboard/bookings.ts`):**
```typescript
fetchStaffBookingDetail(bookingId: string): Promise<StaffBookingDetailResponse>
approveBooking(bookingId: string): Promise<ApproveBookingResponse>
// 409 → parse body as SlotConflictError
rejectBooking(bookingId: string, reason: string): Promise<void>
requestMoreInfo(bookingId: string, message: string): Promise<void>
```

**What to create:**

`apps/web/app/dashboard/bookings/[id]/page.tsx` — server component:
- Calls `fetchStaffBookingDetail(id)` (with ISR off — booking state must always be fresh)
- If not found → `notFound()`
- Renders `<BookingDetailPage booking={data} />`

`apps/web/components/dashboard/bookings/BookingDetailPage.tsx` — `'use client'` (manages action state):
- Renders topbar status badge (changes after action)
- Renders `<BookingDetailMain>` (customer info, lines, photos — read-only)
- Renders `<BookingActionPanel>` on desktop right column; triggers mobile bottom sheet
- Manages `actionState: 'idle' | 'submitting' | 'approved' | 'rejected' | 'info-requested' | 'slot-conflict'`
- On `approved`: replaces action panel with inline green success banner
- On `rejected`: replaces with inline red banner + reason shown
- On `info-requested`: replaces with inline blue banner + message shown; detail page remains with updated badge
- On `slot-conflict`: renders `<SlotConflictAlert>` with suggested slots

`apps/web/components/dashboard/bookings/BookingDetailMain.tsx` — read-only detail body:
- Customer section: avatar + name + email + phone + loyalty points badge (null → hidden)
- Info request section (if `infoRequestMessage != null`): shows what admin asked + customer's response
- Date/time section
- Service lines table: name | price | duration | points per line; totals row
- Photos grid: before-service photos (if any), `loading="lazy"`

`apps/web/components/dashboard/bookings/BookingActionPanel.tsx` — action buttons:
- "Aprovar" (primary) → calls `approveBooking()`; disabled while submitting
- "Rejeitar" (secondary) → opens `<RejectBookingSheet>`
- "Pedir info" (ghost) → opens `<RequestInfoSheet>`
- Hidden once booking is in a terminal/actioned state (`actionState != 'idle'`)

`apps/web/components/dashboard/bookings/RejectBookingSheet.tsx` — bottom sheet (mobile) / panel (desktop):
- Textarea: reason, max 200 chars, required
- Character counter: `X / 200`
- Submit disabled until at least 1 char entered (no enforced minimum in UI — backend validates)
- On submit: calls `rejectBooking()`; on success: parent transitions to `'rejected'`

`apps/web/components/dashboard/bookings/RequestInfoSheet.tsx`:
- Textarea: message, max 200 chars, required
- Submit disabled when empty
- On submit: calls `requestMoreInfo()`; on success: parent transitions to `'info-requested'`

`apps/web/components/dashboard/bookings/SlotConflictAlert.tsx` — UC-003 A1:
- Red error card: "O horário das HH:MM foi ocupado enquanto você revisava o agendamento."
- List of `SlotConflictSuggestion` as tappable rows: "HH:MM — HH:MM" + "Aprovar neste →"
- Clicking a slot calls `approveBooking()` with the new `scheduledAt`

**Mobile vs. desktop layout (from prototype):**
- Mobile: no sticky action panel; instead fixed `.mobile-action-bar` at bottom (`position: fixed; bottom: 0; env(safe-area-inset-bottom, 0)`)
- Desktop (`≥1024px`): two-column grid (`1fr 22rem`); action panel in right column, `position: sticky; top: 1.5rem`
- Bottom nav hidden on this page (`.bottom-nav { display: none !important }` — drill-down page rule)

**Acceptance criteria:**

*Approve (UC-003):*
- [ ] "Aprovar" calls `PATCH /v1/bookings/:id/approve`; `200` → inline green banner "Agendamento aprovado!"; topbar badge → APROVADO; action buttons hidden
- [ ] `409` conflict → `<SlotConflictAlert>` with suggestions; selecting a slot calls approve with the new `scheduledAt`
- [ ] Other server error → toast "Erro ao aprovar. Tente novamente."

*Reject (UC-004):*
- [ ] "Rejeitar" opens bottom sheet; submit disabled when textarea empty
- [ ] On confirm: calls `PATCH /v1/bookings/:id/reject { reason }`; `200` → inline red banner with reason text; badge → REJEITADO; action buttons hidden
- [ ] Server error → sheet stays open with error message

*Request info (UC-005):*
- [ ] "Pedir info" opens bottom sheet; submit disabled when textarea empty
- [ ] On submit: calls `PATCH /v1/bookings/:id/request-info { message }`; `200` → inline blue banner with message text; badge → INFO_SOLICITADO; "Pedir info" button hidden; "Aprovar" and "Rejeitar" remain available (UC-005 A3)
- [ ] Server error → sheet stays open with error message

*Layout:*
- [ ] Mobile (`<1024px`): fixed action bar at bottom; main content scrollable
- [ ] Desktop (`≥1024px`): two-column; action panel sticky on right
- [ ] Bottom nav hidden on this page

*Types:*
- [ ] `ApproveBookingRequest`, `RejectBookingRequest`, `RequestMoreInfoRequest`, `ApproveBookingResponse`, `SlotConflictError`, `SlotConflictSuggestion` added to `packages/types/src/booking.dto.ts`
- [ ] `tsc --noEmit` passes across monorepo

**Dependencies:** M125-S01, M125-S04

---

### M125-S06 — Horários: schedule management page + closure/opening flows

**Agent:** `frontend-ts`  
**Complexity:** L  
**Docs to load:** `docs/04-USE_CASES.md` § UC-010, `plan/journey/staff/prototypes/horarios/dev-notes.md`, `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`

**Description:**  
Implement the Horários section of the staff dashboard — a weekly schedule view where staff can see approved bookings on a time grid and manage schedule closures (UC-010a, UC-010b) and special openings (UC-010c, UC-010d). All backend and BFF endpoints for this section are already implemented; this is a **frontend-only story**.

> 🔍 **Discover before starting:** Verify that `GET /v1/schedule/closures`, `POST /v1/schedule/closures`, `DELETE /v1/schedule/closures/:id`, `GET /v1/schedule/openings`, `POST /v1/schedule/openings`, and `DELETE /v1/schedule/openings/:id` exist in `apps/bff/src/` and return the shapes described below. Check `GET /v1/bookings?status=APPROVED&from=...&to=...` — this likely exists from M125-S02; confirm the `from`/`to` filter params work for a date range. Verify `apps/bff/http/schedule/` exists; if `schedule-openings.http` or `availability.http` are missing, create them as part of this story.

**Prototype reference:** `plan/journey/staff/prototypes/horarios/` (10 screens — `00-schedule.html` through `06-remove-opening.html`)  
**Route:** `/dashboard/schedule`

**What to create:**

`apps/web/app/dashboard/schedule/page.tsx` — server component:
- Fetches closures, openings, and approved bookings for current week (Mon–Sun)
- Reads `businessHours` from tenant settings
- Renders `<ScheduleView initialClosures={...} initialOpenings={...} initialBookings={...} businessHours={...} tenantSlug={...} />`

`apps/web/components/schedule/ScheduleView.tsx` — `'use client'`:
- Holds `ScheduleState` (see below)
- Renders `<WeekNav>` (imported from `components/dashboard/WeekNav.tsx` — created in M125-S03) above the week strip
- Week strip: Mon–Sun day buttons; selected day shown in time grid below
- Time grid: slots from `businessHours[dayOfWeek].open` to `.close`; closed days → empty state + "Abrir dia especial" CTA
- Booking blocks: blue left border + `--ba-secondary` bg; link to `/dashboard/bookings/[id]`
- Closure blocks: grey hatch (`repeating-linear-gradient 135deg`); click opens `RemoveClosureDialog`
- Booking inside a closure window: orange tint + warning icon (UC-010a A4)
- Open days: FAB `+ Bloquear período` → opens `ClosureFormSheet`
- Closed (business-hours) days: FAB replaced with "Abrir dia especial" CTA → opens `OpeningFormSheet`
- Week strip dots: green dot per day with ≥1 approved booking or a ScheduleOpening; closed days at 40% opacity
- Advancing a week: set `startOfWeek + 7 days`, re-fetch all three lists via client-side BFF calls

```ts
type ScheduleState = {
  startOfWeek: Date;
  selectedDate: Date;
  closureSheet: 'closed' | 'open' | 'submitting' | 'conflict' | 'warning';
  openingSheet: 'closed' | 'open' | 'submitting' | 'conflict';
  removeClosureTarget: ScheduleClosure | null;
  removeOpeningTarget: ScheduleOpening | null;
}
```

`apps/web/components/schedule/ClosureFormSheet.tsx` — shadcn `<Sheet side="bottom">` (desktop: `side="right"`):

| Field | Component | Validation |
|---|---|---|
| `date` | `<Input type="date">` | required; not in the past |
| `reason` | `<Select>` | required; `STAFF_DAY_OFF` / `MAINTENANCE` / `HOLIDAY` |
| `startTime` | `<Input type="time">` | optional; if set, `endTime` required |
| `endTime` | `<Input type="time">` | optional; must be > `startTime` |
| `notes` | `<Textarea>` | optional; max 200 chars |

pt-BR labels: `STAFF_DAY_OFF` → "Folga da equipe", `MAINTENANCE` → "Manutenção", `HOLIDAY` → "Feriado". Empty start/end = full-day (hint: "Vazio = bloqueio do dia inteiro").

Error messages (pt-BR):
- 409 overlap → "Já existe um bloqueio nesse período."
- 409 full-day vs partial → "Conflito com bloqueio parcial existente na mesma data."
- 422 past date → "Não é possível bloquear datas passadas."
- 201 + bookings exist (UC-010a A4) → non-blocking inline warning banner after close: "X agendamento(s) aprovado(s) existe(m) nesse período. Reagende ou cancele manualmente."

`apps/web/components/schedule/RemoveClosureDialog.tsx` — shadcn `<Sheet side="bottom">`, compact confirmation:
- Shows: reason label + formatted date + time range
- "Remover bloqueio" button — destructive red
- `DELETE /v1/schedule/closures/:id` → 204 → close sheet, remove from local state

`apps/web/components/schedule/OpeningFormSheet.tsx` — UC-010c:

| Field | Component | Validation |
|---|---|---|
| `date` | `<Input type="date" readOnly>` | pre-filled from selected closed day |
| `startTime` | `<Input type="time">` | required |
| `endTime` | `<Input type="time">` | required; must be > `startTime` |
| `notes` | `<Textarea>` | optional; max 200 chars |

Error messages (pt-BR):
- 409 → "Já existe uma abertura para esta data."
- 422 past date → "Não é possível abrir datas passadas."
- 422 day already open → "Esse dia já está aberto nas configurações regulares. Ajuste os horários de funcionamento."

`apps/web/components/schedule/RemoveOpeningDialog.tsx` — same pattern as `RemoveClosureDialog`. "Remover abertura" — destructive. 204 → revert day to closed state.

`apps/web/lib/api/schedule.ts`:
```typescript
fetchClosures(params: { from: string; to: string }): Promise<{ closures: ScheduleClosure[] }>
createClosure(body: CreateClosureRequest): Promise<ScheduleClosure>
deleteClosure(id: string): Promise<void>
fetchOpenings(params: { from: string; to: string }): Promise<{ openings: ScheduleOpening[] }>
createOpening(body: CreateOpeningRequest): Promise<ScheduleOpening>
deleteOpening(id: string): Promise<void>
```
Approved bookings for the schedule grid reuse `fetchStaffBookings({ status: 'APPROVED', from, to })` from `lib/api/bookings-staff.ts` (M125-S02).

**BFF `.http` gaps (create in this story if missing):**
- `apps/bff/http/schedule/schedule-openings.http` — `POST` and `DELETE /v1/schedule/openings` request blocks
- `apps/bff/http/schedule/availability.http` — `GET /v1/schedule/availability/summary` request block

**`@beloauto/types` additions (new file or extend existing):**
```typescript
export interface ScheduleClosure {
  id: string;
  date: string;
  reason: 'STAFF_DAY_OFF' | 'MAINTENANCE' | 'HOLIDAY';
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}
export interface ScheduleOpening {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
}
export interface CreateClosureRequest {
  date: string;
  reason: 'STAFF_DAY_OFF' | 'MAINTENANCE' | 'HOLIDAY';
  startTime?: string;
  endTime?: string;
  notes?: string;
}
export interface CreateOpeningRequest {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}
```

**Acceptance criteria:**

*View (UC-010):*
- [ ] `/dashboard/schedule` loads with current week's data pre-fetched server-side
- [ ] Week strip shows Mon–Sun; today highlighted; selected day shown in time grid
- [ ] `WeekNav` `‹ junho 2026 ›` above strip; `‹` disabled on current week; `›` advances one week and re-fetches
- [ ] Open days: time grid slots per `businessHours`; closed days: empty state + "Abrir dia especial" CTA
- [ ] Green dot on days with ≥1 approved booking or ScheduleOpening; closed days at 40% opacity

*Create closure (UC-010a):*
- [ ] FAB → `ClosureFormSheet`; date pre-filled from selected day
- [ ] 201 → sheet closes; closure block appears in grid; warning banner if bookings exist (non-blocking)
- [ ] 409 overlap → "Já existe um bloqueio nesse período." inline in sheet
- [ ] 422 past → "Não é possível bloquear datas passadas." inline in sheet

*Remove closure (UC-010b):*
- [ ] Clicking closure block → `RemoveClosureDialog` with reason + date
- [ ] "Remover bloqueio" → 204 → block removed from grid

*Create opening (UC-010c):*
- [ ] "Abrir dia especial" on a closed day → `OpeningFormSheet` with date read-only
- [ ] 201 → day shows opening window in grid
- [ ] 409/422 → pt-BR inline errors

*Remove opening (UC-010d):*
- [ ] Clicking opening block → `RemoveOpeningDialog`
- [ ] "Remover abertura" → 204 → day reverts to closed

*Layout:*
- [ ] BottomNav visible (top-level page)
- [ ] Horários item active in sidebar and bottom nav
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01 (shell), M125-S02 (`fetchStaffBookings` with APPROVED filter), M125-S03 (`WeekNav` component)

---

### M125-S07 — BFF: staff service management endpoints

**Agent:** `bff-ts`  
**Complexity:** S  
**Docs to load:** `docs/14-API_CONTRACTS.md` § Services, `docs/24-BFF_ARCHITECTURE.md`, `docs/04-USE_CASES.md` § UC-012, UC-013

**Description:**  
Verify and fill the BFF surface for staff service management. `POST /v1/services`, `PATCH /v1/services/:id`, and `DELETE /v1/services/:id` were implemented in M05 — this story confirms they exist and adds any missing pieces: a staff-authenticated list endpoint that returns **inactive** services (the public hotsite endpoint only returns `isActive: true`), and a single-service fetch for edit pre-fill.

> 🔍 **Discover before starting:** Open `apps/bff/src/` and locate the services module (likely `platform/` or `catalog/`). Check: (a) does `GET /v1/services` already exist with a STAFF|MANAGER guard? Does it return `isActive`? (b) does `GET /v1/services/:id` exist for authenticated staff? (c) do `POST`, `PATCH`, `DELETE` endpoints exist with correct `@Roles('STAFF','MANAGER')` guard and `.http` blocks? List every gap — this story fills all of them.

**Endpoints to verify or add:**

```
GET    /v1/services          X-Actor-Role: STAFF|MANAGER   → StaffServiceListResponse
GET    /v1/services/:id      X-Actor-Role: STAFF|MANAGER   → StaffServiceResponse
POST   /v1/services          X-Actor-Role: STAFF|MANAGER   → StaffServiceResponse   (likely already exists)
PATCH  /v1/services/:id      X-Actor-Role: STAFF|MANAGER   → StaffServiceResponse   (likely already exists)
DELETE /v1/services/:id      X-Actor-Role: STAFF|MANAGER   → 204                    (likely already exists)
```

**`@beloauto/types` additions (new file `packages/types/src/service.dto.ts` or extend existing):**

```typescript
export interface StaffServiceResponse {
  serviceId: string;
  name: string;
  description: string | null;
  price: MoneyAmount;
  durationMins: number;
  loyaltyPointsValue: number;
  requiresPickupAddress: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface StaffServiceListResponse {
  items: StaffServiceResponse[];
  total: number;
}

export interface CreateServiceRequest {
  name: string;                   // max 100 chars, required
  description?: string;           // max 500 chars
  priceAmountCents: number;       // integer, > 0
  durationMins: number;           // integer, > 0
  loyaltyPointsValue?: number;    // integer, ≥ 0, default 0
  requiresPickupAddress?: boolean; // default false
  isActive?: boolean;             // default true
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  priceAmountCents?: number;
  durationMins?: number;
  loyaltyPointsValue?: number;
  requiresPickupAddress?: boolean;
}
```

**Acceptance criteria:**
- [ ] `GET /v1/services` with STAFF|MANAGER returns all services including `isActive: false` ones, scoped to tenant
- [ ] `GET /v1/services` with CUSTOMER JWT → `403`; without auth → `401`
- [ ] `GET /v1/services/:id` with STAFF|MANAGER returns single service (active or inactive)
- [ ] `POST /v1/services` with duplicate name → `409` with RFC 9457 body
- [ ] `DELETE /v1/services/:id` → `204`; subsequent `GET /v1/services/:id` returns `isActive: false`
- [ ] Tenant isolation: MANAGER of Tenant A cannot read/modify Tenant B's services
- [ ] `.http` blocks present in `apps/bff/http/services/` for all 5 operations
- [ ] All types added to `@beloauto/types` and re-exported from `packages/types/src/index.ts`
- [ ] `tsc --noEmit` passes across monorepo

**Dependencies:** M05 (Service aggregate + backend endpoints), M125-S01

---

### M125-S08 — Serviços: service list page (`/dashboard/services`)

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `plan/journey/staff/prototypes/servicos/01-servicos-list.html` (reference)

**Description:**  
The main service management page — a filterable list of all services (active + inactive) with quick visual indicators and entry points to create or edit.

> 🔍 **Discover before starting:** Check whether a `lib/api/dashboard/services.ts` fetcher file exists. If not, create it. Verify `apps/web/app/dashboard/` folder structure matches `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md` — place the route at `/dashboard/services`.

**Prototype reference:** `plan/journey/staff/prototypes/servicos/01-servicos-list.html`  
**Route:** `/dashboard/services`

**What to create:**

`apps/web/lib/api/dashboard/services.ts`:
```typescript
fetchStaffServices(): Promise<StaffServiceListResponse>
// GET /v1/services, X-Actor-* headers forwarded, auth cookie
```

`apps/web/app/dashboard/services/page.tsx` — server component:
- Calls `fetchStaffServices()`
- Renders `<ServiceListPage services={data.items} />`

`apps/web/components/dashboard/services/ServiceListPage.tsx` — `'use client'`:
- Filter tabs: **Todos** (N) | **Ativos** (N) | **Inativos** (N) — client-side filter, no re-fetch
- Service cards via `<ServiceCard>` — full list at mount; filtered array on tab change
- Empty state per tab: "Nenhum serviço cadastrado." / "Nenhum serviço ativo." / "Nenhum serviço inativo." (pt-BR)
- FAB (mobile `<1024px`): `+ Criar` → `/dashboard/services/new`; `bottom: 5rem` to clear bottom nav
- Desktop create button (`.topbar-create-btn` pattern — CSS `display:none` / `≥1024px display:inline-flex`): in topbar right area → `/dashboard/services/new`

`apps/web/components/dashboard/services/ServiceCard.tsx`:
- Service name (bold)
- Meta row: duration · price (R$ formatted) · points (pts)
- Pickup badge (`🚗 Coleta`) when `requiresPickupAddress: true`
- Inactive service: `opacity: 0.55`; status chip "Inativo"
- Entire card is a link → `/dashboard/services/[id]/edit`

**Acceptance criteria:**
- [ ] Page renders full list from `fetchStaffServices()`
- [ ] "Todos" tab shows all; "Ativos" shows only `isActive: true`; "Inativos" shows only `isActive: false`
- [ ] Tab counts update correctly when a service was just deactivated (stale data handled by Next.js `revalidatePath` from edit page)
- [ ] Inactive cards render at 55% opacity with "Inativo" chip
- [ ] Pickup badge visible only when `requiresPickupAddress: true`
- [ ] Empty state (zero services) shows pt-BR message, no JS error
- [ ] FAB visible on mobile, hidden on desktop; desktop create button visible on desktop, hidden on mobile
- [ ] Both entry points link to `/dashboard/services/new`
- [ ] Serviços item active in sidebar and bottom nav
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01 (shell), M125-S07 (BFF endpoints + types)

---

### M125-S09 — Serviços: create service page (`/dashboard/services/new`)

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/04-USE_CASES.md` § UC-012, `plan/journey/staff/prototypes/servicos/02-service-create.html`, `plan/journey/staff/prototypes/servicos/02b-service-create-error.html`

**Description:**  
The service creation form. The prototype shows a clean single-page form with two toggles and inline validation for the duplicate-name 409 error.

**Prototype references:**  
- `plan/journey/staff/prototypes/servicos/02-service-create.html` — happy path  
- `plan/journey/staff/prototypes/servicos/02b-service-create-error.html` — 409 duplicate name error state

**Route:** `/dashboard/services/new`

**`apps/web/lib/api/dashboard/services.ts` additions:**
```typescript
createService(body: CreateServiceRequest): Promise<StaffServiceResponse>
// POST /v1/services → 201; 409 → duplicate name
```

**What to create:**

`apps/web/app/dashboard/services/new/page.tsx` — server component wrapper, renders `<ServiceCreatePage />`.

`apps/web/components/dashboard/services/ServiceCreatePage.tsx` — `'use client'`:

| Field | Input | Validation |
|---|---|---|
| Nome do serviço | `<input type="text">` | required; max 100 chars |
| Descrição | `<textarea>` | optional; max 500 chars |
| Preço | `<input type="number">` with R$ prefix | required; > 0 |
| Duração | `<input type="number">` with "min" suffix | required; integer > 0 |
| Pontos de fidelidade | `<input type="number">` | optional; integer ≥ 0; default 0 |
| Coleta e entrega | toggle (OFF by default) | maps to `requiresPickupAddress` |
| Criar como ativo | toggle (ON by default) | maps to `isActive` |

- Topbar: back arrow → `/dashboard/services` + title "Criar serviço"
- On submit: calls `createService()`
  - `201` → `router.push('/dashboard/services')` + `revalidatePath('/dashboard/services')`
  - `409` duplicate name → name field gets error state (red border + `#fef2f2` bg) + error message "Já existe um serviço com este nome. Escolha outro nome." (exact text from prototype)
  - Other error → toast "Erro ao criar serviço. Tente novamente."
- Submit button disabled while submitting

**Acceptance criteria:**
- [ ] All 5 fields + 2 toggles render; price shows R$ prefix, duration shows "min" suffix
- [ ] Validation: name required; price and duration must be > 0
- [ ] 201 → redirects to `/dashboard/services`; new service visible in list
- [ ] 409 → name field highlighted (red border + light red bg); error message shown inline below field; other fields unchanged
- [ ] "Criar como ativo" toggle defaults to ON; "Coleta e entrega" defaults to OFF
- [ ] Submit button disabled during in-flight request
- [ ] Topbar back arrow returns to `/dashboard/services` without submit
- [ ] Bottom nav visible (mobile); Serviços item active
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01 (shell), M125-S07 (BFF endpoints + `CreateServiceRequest` type)

---

### M125-S10 — Serviços: edit + deactivate service (`/dashboard/services/[id]/edit`)

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/04-USE_CASES.md` § UC-013, `plan/journey/staff/prototypes/servicos/03-service-edit.html`, `plan/journey/staff/prototypes/servicos/03b-deactivate-confirm.html`

**Description:**  
The service edit form (pre-filled, price-change warning, status badge in topbar) and the deactivation flow (danger zone → confirmation page → `DELETE /v1/services/:id`).

**Prototype references:**  
- `plan/journey/staff/prototypes/servicos/03-service-edit.html` — edit form  
- `plan/journey/staff/prototypes/servicos/03b-deactivate-confirm.html` — deactivation confirmation

**Routes:** `/dashboard/services/[id]/edit` and `/dashboard/services/[id]/deactivate`

**`apps/web/lib/api/dashboard/services.ts` additions:**
```typescript
fetchStaffService(serviceId: string): Promise<StaffServiceResponse>
// GET /v1/services/:id

updateService(serviceId: string, body: UpdateServiceRequest): Promise<StaffServiceResponse>
// PATCH /v1/services/:id → 200; 409 → duplicate name

deactivateService(serviceId: string): Promise<void>
// DELETE /v1/services/:id → 204
```

**What to create:**

`apps/web/app/dashboard/services/[id]/edit/page.tsx` — server component:
- Calls `fetchStaffService(id)`; if not found → `notFound()`
- Renders `<ServiceEditPage service={data} />`

`apps/web/components/dashboard/services/ServiceEditPage.tsx` — `'use client'`:
- Topbar: back arrow → `/dashboard/services` + breadcrumb "Serviços" + title "Editar serviço" + status badge ("Ativo" green / "Inativo" grey)
- Same 5 fields as create, pre-filled from `service` prop; **no** `isActive` toggle — status is managed via deactivation flow only
- Price field shows inline warning `.form-warn`: "Só afeta novos agendamentos" (triangle icon, amber colour — exact text from prototype)
- On submit: calls `updateService()`
  - `200` → `router.push('/dashboard/services')` + `revalidatePath`
  - `409` → name field error state (same pattern as S09)
  - Other error → toast
- **Danger zone** section (bottom of form, separated by red border-top):
  - Heading: "Zona de perigo"
  - Description: "Desativar este serviço impede novos agendamentos. Agendamentos existentes não são afetados."
  - Button: "Desativar serviço" (destructive style) → navigates to `/dashboard/services/[id]/deactivate`
  - Only shown when `service.isActive === true`

`apps/web/app/dashboard/services/[id]/deactivate/page.tsx` — server component:
- Calls `fetchStaffService(id)` to populate the confirmation card; `notFound()` if missing or already inactive
- Renders `<ServiceDeactivatePage service={data} />`

`apps/web/components/dashboard/services/ServiceDeactivatePage.tsx` — `'use client'`:
- Topbar: back arrow → `/dashboard/services/[id]/edit` + "Editar serviço" breadcrumb + title "Desativar serviço"
- Service summary card: name + meta (duration · price · points)
- Warning box (amber border): three bullet impacts (hides from booking form / existing bookings unaffected / can be reactivated)
- "Confirmar desativação" button (red/destructive): calls `deactivateService()`
  - `204` → `router.push('/dashboard/services')` + `revalidatePath('/dashboard/services')`
  - Error → toast "Erro ao desativar. Tente novamente."
- "Cancelar" button → `router.back()`
- Bottom nav visible; Serviços item active

**Acceptance criteria:**

*Edit (UC-013 main flow):*
- [ ] Form pre-filled with current service data
- [ ] Price field shows amber inline warning "Só afeta novos agendamentos"
- [ ] `200` → redirects to list; updated service visible
- [ ] `409` → name field error inline; other fields unchanged
- [ ] Status badge in topbar reflects `isActive`

*Deactivate (UC-013 A1):*
- [ ] Danger zone visible only when `isActive: true`
- [ ] "Desativar serviço" navigates to `/dashboard/services/[id]/deactivate`
- [ ] Deactivation confirmation page shows service card + impact bullets
- [ ] `204` → redirects to list; service shown at 55% opacity with "Inativo" chip
- [ ] "Cancelar" returns to edit page without changes

*Layout:*
- [ ] Both pages: back arrow in topbar; bottom nav visible; Serviços active in nav
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01 (shell), M125-S07 (BFF endpoints + types), M125-S08 (`revalidatePath` target)

---

### M125-S11 — Booking lifecycle: cancel + reschedule (UC-008)

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/04-USE_CASES.md` § UC-008, `plan/journey/staff/prototypes/agenda/03-booking-detail-approved.html`, `05-reschedule.html`, `05b-reschedule-conflict.html`, `dev-notes.md`

**Description:**  
Extends `BookingDetailPage` (M125-S05) with a second action panel — `BookingLifecyclePanel` — rendered when `booking.status === 'APPROVED'` instead of `BookingActionPanel`. Staff can cancel an approved booking (optional reason, no enforced minimum) or reschedule it to a new slot. Booking stays `APPROVED` after a reschedule — it is not a status transition. Backend + BFF endpoints already exist and were verified in the 2026-06-16 UC audit (`cancel-admin`, `reschedule` — both fully implemented, not just planned).

> 🔍 **Discover before starting:** Confirm `PATCH /v1/bookings/:id/cancel` (BFF dispatches to backend `/cancel-admin` for STAFF|MANAGER) and `PATCH /v1/bookings/:id/reschedule` are wired exactly as found in the audit (`apps/bff/src/bookings/bookings.controller.ts` lines ~306–337 at time of audit — re-verify line numbers). Confirm whether the booking flow's `AvailabilityCalendar` component (built for the guest/customer booking flow, UC-011) is extracted in a way `RescheduleBookingCalendar` can reuse without pulling in basket/duration-recompute logic — reschedule duration is frozen at the existing booking's `totalDurationMins`. Decide: nested routes (`/dashboard/bookings/[id]/reschedule`) vs. a modal/sheet over `[id]` — the prototype models both cancel (sheet) and reschedule (full screen) but doesn't mandate the production routing approach.

**Prototype references:**
- `plan/journey/staff/prototypes/agenda/03-booking-detail-approved.html` — APPROVED branch of the detail page + inline cancel sheet
- `plan/journey/staff/prototypes/agenda/03b-cancel-success.html` — cancel success inline state
- `plan/journey/staff/prototypes/agenda/05-reschedule.html` — calendar + "Revisar reagendamento" summary
- `plan/journey/staff/prototypes/agenda/05b-reschedule-conflict.html` — 409 conflict + adjacent slot suggestions
- `plan/journey/staff/prototypes/agenda/05c-reschedule-success.html` — reschedule success inline state (booking stays APPROVED, panel returns)

**Route:** `/dashboard/bookings/[id]` (same route as M125-S05, branched by status) + reschedule sub-route (TBD — see discovery)

**`@beloauto/types` additions (`packages/types/src/booking.dto.ts`):**
```typescript
export interface CancelBookingAsAdminRequest { bookingId: string; reason?: string; }
export interface CancelBookingAsAdminResponse { id: string; status: 'CANCELLED'; cancelledAt: string; }
export interface RescheduleBookingRequest { bookingId: string; scheduledAt: string; adminNotes?: string; }
export interface RescheduleBookingResponse { id: string; status: 'APPROVED'; scheduledAt: string; }
```

**API fetcher additions (`apps/web/lib/api/dashboard/bookings.ts`):**
```typescript
cancelBookingAsAdmin(bookingId: string, reason?: string): Promise<CancelBookingAsAdminResponse>
rescheduleBooking(bookingId: string, scheduledAt: string, adminNotes?: string): Promise<RescheduleBookingResponse>
// 409 → parse body as SlotConflictError (same shape as approve's 409, reused)
```

**What to create:**

`apps/web/components/dashboard/bookings/BookingLifecyclePanel.tsx` — Marcar concluído (primary, links into M125-S12) / Reagendar (secondary) / Cancelar (secondary) buttons. Renders in `BookingDetailPage`'s desktop aside / mobile action bar, replacing `BookingActionPanel` when `status === 'APPROVED'`.

`apps/web/components/dashboard/bookings/AdminCancelBookingSheet.tsx` — bottom sheet: reason textarea, **optional**, no minimum length (unlike Reject's required ≥10 chars — confirmed in the UC audit against `CancelBookingAsAdminBody`). On confirm: calls `cancelBookingAsAdmin()`; success → parent `actionState = 'cancelled'`.

`apps/web/components/dashboard/bookings/RescheduleBookingCalendar.tsx` — reuses `AvailabilityCalendar` (day-pill/slot-btn UI from UC-011). "Revisar reagendamento" summary panel (De/Para slot comparison, live-updates as a new slot is picked) per the README's "Summary card" convention. On confirm: calls `rescheduleBooking()`.

`apps/web/components/dashboard/bookings/RescheduleConflictAlert.tsx` — same pattern as `SlotConflictAlert` (M125-S05), reused for the reschedule confirm's 409 response.

**`actionState` additions to `BookingDetailPage`** (extends M125-S05's machine):
```typescript
type ActionState = /* ...existing... */
  | 'cancelled'           // UC-008 success — red banner, terminal
  | 'rescheduled'         // UC-008 A1 success — green banner, NOT terminal — panel buttons return (status stays APPROVED)
  | 'reschedule-conflict' // UC-008 A1 → 409
```

**Acceptance criteria:**

*Cancel:*
- [ ] "Cancelar agendamento"/"Cancelar" opens `AdminCancelBookingSheet`; submit is never disabled (reason is optional)
- [ ] Confirm → `PATCH /v1/bookings/:id/cancel`; `200` → inline red banner "Agendamento cancelado"; badge → CANCELADO; no further actions (terminal)

*Reschedule:*
- [ ] "Reagendar" opens calendar; summary panel shows current slot → newly selected slot, updating live as a slot is picked
- [ ] Confirm → `PATCH /v1/bookings/:id/reschedule`; `200` → inline green banner with old/new slot; badge stays APROVADO; `BookingLifecyclePanel` buttons return (not terminal)
- [ ] `409` → `RescheduleConflictAlert` with adjacent slot suggestions; picking one retries the reschedule

*Layout:*
- [ ] Same `detail-layout` two-column / `mobile-action-bar` shell as M125-S05 — no bespoke layout
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01, M125-S05, M12 (`AvailabilityCalendar` component — verify it exists and is reusable)

---

### M125-S12 — Mark booking complete (UC-009)

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/04-USE_CASES.md` § UC-009, `plan/journey/staff/prototypes/agenda/04-mark-complete.html`, `04b-complete-success.html`

**Description:**  
The "Marcar concluído" action from `BookingLifecyclePanel` (M125-S11) — staff confirm a completed wash, optionally adjusting the actual price charged per line (discount/waiver — defaults to the quoted `priceAtBooking`), uploading after-service photos, and adding notes. Triggers loyalty point earning server-side (computed from `pointsValueAtBooking`, unaffected by `actualPriceCharged`). Backend + BFF endpoint already exist (verified in the 2026-06-16 UC audit — `PATCH /v1/bookings/:id/complete` is fully implemented).

> 🔍 **Discover before starting:** Same routing question as M125-S11 (nested route vs. modal/sheet over `[id]`) — decide once, apply to both stories consistently. Confirm the after-service photo upload reuses the same GCS signed-URL upload component/pattern as the guest/customer "before" photos (M115-S01), not a new implementation.

**Prototype references:**
- `plan/journey/staff/prototypes/agenda/04-mark-complete.html` — per-line price editor + photo upload + notes
- `plan/journey/staff/prototypes/agenda/04b-complete-success.html` — completion success inline state (cotado vs. cobrado summary)

**Route:** `/dashboard/bookings/[id]/complete` (TBD — see M125-S11 discovery)

**`@beloauto/types` additions (`packages/types/src/booking.dto.ts`):**
```typescript
export interface CompleteBookingLineInput { lineId: string; actualPriceCharged: number; }
export interface CompleteBookingRequest {
  bookingId: string;
  lines: CompleteBookingLineInput[];   // required, one entry per line, even if unchanged
  afterServicePhotoUrls?: string[];
  adminNotes?: string;
}
export interface CompleteBookingResponse {
  id: string; status: 'COMPLETED'; completedAt: string; totalActualPrice: number;
}
```

**API fetcher additions (`apps/web/lib/api/dashboard/bookings.ts`):**
```typescript
completeBooking(body: CompleteBookingRequest): Promise<CompleteBookingResponse>
// PATCH /v1/bookings/:id/complete
```

**What to create:**

`apps/web/components/dashboard/bookings/MarkCompleteSheet.tsx`:
- One row per booking line: service name, quoted price (read-only), editable "charged" amount pre-filled with `priceAtBooking`
- Live-updating total (`Total a cobrar`), recalculated on every keystroke, client-side only — no BFF round-trip
- After-service photo upload — optional, reuses M115-S01's signed-URL upload component
- Notes textarea — optional
- "Confirmar conclusão" lives in the same sticky aside (desktop) / fixed bottom bar (mobile) as every other actionable screen — not inline at the end of the form

**`actionState` addition to `BookingDetailPage`:**
```typescript
| 'completed'  // UC-009 success — green banner with cotado-vs-cobrado summary, terminal
```

**Acceptance criteria:**
- [ ] Each line's "charged" input defaults to `priceAtBooking`; editing it updates the live total immediately
- [ ] Confirming with all lines unchanged sends `actualPriceCharged === priceAtBooking` for every line (not omitted)
- [ ] Photos are optional — confirming with zero photos succeeds (UC-009 A3)
- [ ] `200` → inline green banner: per-line quoted-vs-charged + total quoted-vs-charged + "ganhou N pontos de fidelidade"; badge → CONCLUÍDO; no further actions (terminal)
- [ ] Primary action button lives in sticky aside (desktop) / fixed bottom bar (mobile), matching M125-S05/S11's shell
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01, M125-S05, M125-S11 (entry point), M115-S01 (photo upload pattern)

---

## Future discovery — stories NOT yet scoped

The following UCs were identified during the UC audit and journey mapping as likely additions to this milestone or a follow-up (M126). Each needs its own `/uc-audit` + journey file before a story is written.

| UC | Title | Current status | Notes |
|---|---|---|---|
| UC-006 | Customer views & manages bookings | Frontend GAP | Customer-side dashboard (`/minha-conta`) — belongs in `customer/` journey, not here |
| UC-025 | Staff first login / accept invite | Backend exists (M04) | Onboarding flow after receiving invite email — needs `customer/` + `staff/` journey mapping |
| Real-time queue | Queue live updates | Not designed | Polling (simple) vs. WebSocket (complex). Decide at M125 retrospective — do not add to S03 scope unless polling is already proven cheap |

---

## Open questions (resolve before M125-S02 starts)

- [ ] Does `GET /v1/bookings` already exist for staff in the BFF? If yes — what is its current shape and does it filter by role?
- [ ] Does `GET /v1/bookings/:id` already exist for staff? Does it include `loyaltyBalance`?
- [ ] After approval, does the admin stay on the detail page (confirmed here: yes, inline state) or navigate back to queue (open)?
- [ ] After rejection/info-request, same question — inline banner + stay, or auto-navigate?
- [ ] Should the slot conflict suggestions come from the backend's `409` response body, or does the BFF need to call availability and compose them?
- [ ] Photo URL strategy: GCS signed read URLs generated by BFF at detail-fetch time, or Next.js image proxy? (M115-S01 pattern used signed URLs — recommend same here)
