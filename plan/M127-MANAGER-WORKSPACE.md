# M127 — Manager Workspace (Equipe, Configurações, Hotsite)

**Phase:** Local Development
**Goal:** Managers can run the parts of the business that only they're allowed to touch — invite/deactivate teammates, edit tenant-wide operational settings, and customize + publish the public hotsite — through a real dashboard instead of calling the API directly.
**Depends on:** M02 (Platform context — tenant settings VO, TenantContext), M04 (Staff aggregate — invite/deactivate use cases), M12 (Hotsite config aggregate + BFF `hotsite-admin.controller.ts`), M125 (dashboard shell — `DashboardShell`/`Sidebar`/`BottomNav`/middleware built there; this milestone adds three `MANAGER`-only routes on top of it)
**Blocks:** M13 (full dashboard frontend — this milestone delivers the manager-only slice, same pattern as M125/M126)
**Journey prototypes:** `plan/journey/manager/prototypes/equipe/` · `plan/journey/manager/prototypes/configuracoes/` · `plan/journey/manager/prototypes/hotsite/` — built 2026-06-16; UC audit (UC-026–029) done same day; pending user click-through review
**UCs covered:** UC-026, UC-027, UC-028, UC-029

> **Discovery note (applies to this entire milestone):** Equipe and Hotsite were confirmed fully backend+BFF-ready by direct code inspection on 2026-06-16 (not just the UC audit) — `GET /staff` already returns active+inactive members, and Hotsite already has every CRUD/publish/image-upload route it needs. **Configurações is the exception and the critical path of this milestone:** the backend has no GET endpoint for tenant settings (only `PATCH`), so S01 must land before S02 (BFF) can proxy it, before S03 (frontend) can build against it. **Cross-milestone alert:** M125-S01's Sidebar spec lists only "Equipe + Configurações" under "Somente Gerente" — it omits **Hotsite**, even though `plan/journey/shared/dashboard-shell.html` and every manager prototype include it as a third item. If M125-S01 ships before this milestone starts, verify `Sidebar.tsx` actually has a Hotsite nav entry; if not, add it as part of S07 below rather than filing a separate M125 patch.

---

## Stories

---

### M127-S01 — Backend: add `GET /tenants/settings`

**Agent:** `backend-ts`
**Complexity:** S
**Docs to load:** `docs/21-TENANTS_SETTINGS_SCHEMA.md`, `docs/02-DOMAIN_MODEL.md` (Tenant aggregate), `docs/04-USE_CASES.md` § UC-026

**Description:**
Add a read endpoint for tenant settings. Today the only way to read `tenants.settings` is the internal `GET /internal/tenants/:tenantId` route (gated by `InternalApiGuard` + `X-Internal-Key` — wrong audience for a `MANAGER`-authenticated dashboard request). This story adds a tenant-scoped, `MANAGER`-guarded GET mirroring the existing `PATCH`'s shape, so the settings form has something to load before editing.

> 🔍 **Discover before starting:** Read `apps/backend/src/contexts/platform/infrastructure/controllers/tenant-settings.controller.ts` in full. Confirm the exact guard class used by `PATCH` (expected: `ManagerRoleGuard`) and which repository/use case it calls — the new GET use case should reuse the same repository load, not duplicate mapping logic. Check whether the repository already exposes a `findById`/`findByTenantId` that returns the full `TenantSettingsProps` VO; if so this story is a thin read wrapper, not new persistence code.

**What to create:**
- New use case `GetTenantSettingsUseCase` (application layer) → `{ tenantId, name, slug, settings: TenantSettingsProps }`
- New route on `tenant-settings.controller.ts`: `GET tenants/settings`, `@UseGuards(ManagerRoleGuard)`, scoped via `TenantContext` (not `X-Internal-Key`)
- `.http` request block in `apps/backend/http/platform/tenant-settings.http`

**Acceptance criteria:**
- [ ] `GET /tenants/settings` with `MANAGER` role returns `{ tenantId, name, slug, settings }` — `settings` fields stay snake_case, matching `PATCH`'s existing shape exactly
- [ ] `STAFF` role → `403`
- [ ] No auth → `401`
- [ ] Tenant isolation: returns only the requesting tenant's settings (dedicated integration test, per CLAUDE.md §7)
- [ ] Unit + integration test for the new use case
- [ ] `.http` block added in the same commit

**Dependencies:** M02

---

### M127-S02 — BFF: proxy `GET`/`PATCH /tenants/settings` (camelCase translation layer)

**Agent:** `bff-ts`
**Complexity:** M
**Docs to load:** `docs/24-BFF_ARCHITECTURE.md`, `docs/14-API_CONTRACTS.md`

**Description:**
Add the BFF module surface that doesn't exist today. The backend speaks snake_case (`cancellation_window_hours`, `business_hours.monday`, …); everything `apps/web` consumes elsewhere speaks camelCase (per the existing read-only `TenantSettings` interface in `packages/types/src/tenant.dto.ts`). This story is the translation layer, plus the write DTO that doesn't exist yet — `tenant.dto.ts` currently has no update/write shape at all.

> 🔍 **Discover before starting:** Read `packages/types/src/tenant.dto.ts` in full and confirm the exact field names/nesting of the existing camelCase `TenantSettings` read interface **before** defining `UpdateTenantSettingsRequest` — the write shape must mirror the read shape field-for-field, not invent new names. Read `apps/bff/src/platform/hotsite-admin.controller.ts` and `platform.module.ts` to copy the exact registration pattern for a new controller in the same module (per CLAUDE.md's BFF naming rule — this belongs in the `platform` module, not a new one).

**What to create:**

`apps/bff/src/platform/tenant-settings.controller.ts`:
```
GET   tenants/settings   @Roles('MANAGER')  -> calls backend GET, maps snake_case -> camelCase, returns TenantSettingsResponse
PATCH tenants/settings   @Roles('MANAGER')  -> validates UpdateTenantSettingsRequest (Zod, camelCase), maps camelCase -> snake_case, calls backend PATCH, maps response back to camelCase
```

Register the controller in `apps/bff/src/platform/platform.module.ts` alongside `HotsiteAdminController`.

`packages/types/src/tenant.dto.ts` additions:
```typescript
export interface TenantSettingsResponse extends TenantSettings {
  tenantId: string;
  name: string;
  slug: string;
}

export interface UpdateTenantSettingsRequest {
  name?: string;
  cancellationWindowHours?: number;
  serviceBufferMinutes?: number;
  loyaltyExpiryDays?: number;
  businessHours?: {
    timezone: string;
    monday?: { open: string; close: string } | null;
    tuesday?: { open: string; close: string } | null;
    wednesday?: { open: string; close: string } | null;
    thursday?: { open: string; close: string } | null;
    friday?: { open: string; close: string } | null;
    saturday?: { open: string; close: string } | null;
    sunday?: { open: string; close: string } | null;
  };
  businessInfo?: {
    phone?: string | null;
    email?: string | null;
    address?: {
      street: string; number: string; complement?: string;
      neighborhood: string; city: string; state: string; zipCode: string;
    } | null;
  };
}
```

`.http` blocks in `apps/bff/http/platform/tenant-settings.http`.

**Acceptance criteria:**
- [ ] `GET /tenants/settings` (BFF) returns camelCase fields matching `TenantSettingsResponse` exactly
- [ ] `PATCH /tenants/settings` (BFF) accepts a camelCase body and correctly maps every field — including nested per-day `businessHours` objects — to the backend's snake_case DTO
- [ ] `STAFF` JWT → `403`; no auth → `401`
- [ ] Backend `422` (invalid field) is forwarded as an RFC 9457 Problem Detail, not swallowed or remapped to a generic 500
- [ ] Round-trip integration test: `PATCH` a field, then `GET`, confirms the persisted value comes back correctly mapped
- [ ] `.http` blocks added for both routes
- [ ] `tsc --noEmit` passes across the monorepo (the `packages/types` change touches multiple consumers)

**Dependencies:** M127-S01

---

### M127-S03 — Configurações: settings form page (`/dashboard/settings`)

**Agent:** `frontend-ts`
**Complexity:** L
**Docs to load:** `docs/04-USE_CASES.md` § UC-026, `plan/journey/manager/configuracoes.md`, `plan/journey/manager/prototypes/configuracoes/dev-notes.md`

**Description:**
The settings form — five sections matching the prototype: Geral, Agendamento, Fidelidade, Horário de funcionamento, Contato. Scope is exactly what's in the prototype and UC-026 — the backend supports additional fields (`auto_approve_enabled`, `slot_granularity_minutes`, `localization`, etc.) that are **explicitly out of scope** here; see "Future discovery" at the bottom of this file.

> 🔍 **Discover before starting:** Confirm the exact `TenantSettingsResponse`/`UpdateTenantSettingsRequest` field names against what M127-S02 actually shipped — don't build the form against the UC text or this plan's draft shape, the landed BFF types are the source of truth.

**Prototype reference:** `plan/journey/manager/prototypes/configuracoes/01-settings-form.html` (happy path), `01b-validation-error.html`, `01c-saved-success.html`

**What to create:**

`apps/web/lib/api/dashboard/settings.ts`:
```typescript
fetchTenantSettings(): Promise<TenantSettingsResponse>
updateTenantSettings(body: UpdateTenantSettingsRequest): Promise<TenantSettingsResponse>
```

`apps/web/app/dashboard/settings/page.tsx` — server component: calls `fetchTenantSettings()`, renders `<SettingsForm initial={data} />`.

`apps/web/components/dashboard/settings/SettingsForm.tsx` — `'use client'`, five section cards per the prototype:

| Section | Fields |
|---|---|
| Geral | `name` (editable), `slug` (read-only — gray background, `disabled` input) |
| Agendamento | `cancellationWindowHours` (0–720, suffix "horas"), `serviceBufferMinutes` (0–120, suffix "min") |
| Fidelidade | `loyaltyExpiryDays` (1–3650, suffix "dias") |
| Horário de funcionamento | `timezone` select + 7 day-rows (open/close time pickers + "Fechado" checkbox per day) |
| Contato | `phone`, `email`, `address` (street/number/complement/neighborhood/city/state/zipCode) — all optional |

- `SettingsFormSchema` (Zod) mirrors the backend's validation ranges exactly (see table in dev-notes.md)
- On submit: `200` → inline toast "Configurações salvas com sucesso." (stays on page, no redirect — matches `01c-saved-success.html`); `422` → the offending field gets `has-error` styling + inline message, other fields keep their values (matches `01b-validation-error.html`)

**Acceptance criteria:**
- [ ] Form loads pre-filled from `fetchTenantSettings()`
- [ ] `slug` is read-only and visually distinct from editable fields
- [ ] All five sections render with exactly the fields listed above — no more, no less
- [ ] Submitting `cancellationWindowHours > 720` shows an inline error on that field only; other field values are preserved
- [ ] Successful save shows a toast and the user stays on `/dashboard/settings`
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S02, M125-S01 (shell + manager-only route guard — see M127-S04's note on extending the middleware)

---

### M127-S04 — Equipe: team list page (`/dashboard/team`)

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-028, UC-029; `plan/journey/manager/equipe.md`; `plan/journey/manager/prototypes/equipe/dev-notes.md`

**Description:**
The team list with Ativo / Convite pendente / Inativo filter tabs. The data model has no dedicated "pending invite" status — both a never-activated invitee and a deactivated former member have `isActive: false`. The list must derive the displayed status client-side.

> 🔍 **Discover before starting:** `GET /staff` (BFF) already exists and returns a `StaffListResponse` (`apps/bff/src/staff/staff.controller.ts`) — confirm via `apps/bff/src/staff/staff.types.ts` whether each list item exposes `googleOAuthId` or `deactivatedBy`. If neither is exposed, this story must add one of them to the BFF response (a small addition here, not a new story) — without it, "Convite pendente" vs. "Inativo" cannot be computed. Also reconcile: `packages/types/src/staff.dto.ts`'s `StaffResponse` differs slightly from the BFF's local `staff.types.ts` shapes — per CLAUDE.md's `@beloauto/types` scope rule (BFF→Frontend contract only), confirm `apps/web` should import from `@beloauto/types`, and align the BFF's local type with it if they've drifted.

**Prototype reference:** `plan/journey/manager/prototypes/equipe/01-team-list.html`
**Route:** `/dashboard/team`

**What to create:**

`apps/web/lib/api/dashboard/team.ts`:
```typescript
fetchTeam(): Promise<StaffListResponse>
// GET /staff, auth cookie + X-Actor-* headers
```

`apps/web/app/dashboard/team/page.tsx` — server component: calls `fetchTeam()`, renders `<TeamListPage members={data.items} currentStaffId={jwt.sub} />`.

`apps/web/components/dashboard/team/TeamListPage.tsx` — `'use client'`:
- Filter tabs: **Todos** | **Ativos** | **Convites pendentes** | **Inativos** — client-side filter on the derived status, no re-fetch
- `memberStatus(member)` helper (per dev-notes.md):
  ```typescript
  function memberStatus(m: StaffListItem): 'active' | 'pending' | 'deactivated' {
    if (m.isActive) return 'active';
    return m.googleOAuthId === null ? 'pending' : 'deactivated';
  }
  ```
- The logged-in admin's own row (`member.staffId === currentStaffId`) never renders a "Desativar" action (server-side guard already exists via `StaffSelfDeactivationError`; this is the UX nicety, not the safety net)
- A `pending` row shows "Reenviar convite" instead of "Desativar" — reopens the invite form (M127-S05) pre-filled with the same email
- Desktop create button + mobile FAB → `/dashboard/team/invite`

`apps/web/components/dashboard/team/MemberRow.tsx`:
- Avatar (initials) + name + email
- Role badge (`Gerente` / `Equipe`)
- Status badge (`Ativo` green / `Convite pendente` yellow / `Inativo` red)
- Action: "Desativar" → `/dashboard/team/[id]/deactivate`, or "Reenviar convite" for pending rows, or nothing for the current user's own row

**Acceptance criteria:**
- [ ] List loads from `fetchTeam()`, renders all four filter tabs with correct counts
- [ ] Status badge correctly distinguishes Ativo / Convite pendente / Inativo using the `memberStatus()` heuristic
- [ ] The current admin's own row has no "Desativar" action
- [ ] A pending row's action is "Reenviar convite", not "Desativar"
- [ ] Create entry points (FAB mobile, button desktop) link to `/dashboard/team/invite`
- [ ] Page is `MANAGER`-only — `STAFF` role hitting `/dashboard/team` redirects (extend M125-S01's middleware: add `/dashboard/team`, `/dashboard/settings`, `/dashboard/hotsite` to the manager-only route list)
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01

---

### M127-S05 — Equipe: invite member form (`/dashboard/team/invite`)

**Agent:** `frontend-ts`
**Complexity:** S
**Docs to load:** `docs/04-USE_CASES.md` § UC-028, `plan/journey/manager/prototypes/equipe/02-invite-form.html`, `02b-invite-error.html`

**Description:**
The invite form — name, email, role selector. `POST /staff/invite` already exists and is fully guarded; this is a frontend-only story.

**Route:** `/dashboard/team/invite`

**`apps/web/lib/api/dashboard/team.ts` additions:**
```typescript
inviteStaff(body: InviteStaffRequest): Promise<InviteStaffResponse>
// POST /staff/invite -> 201; 409 -> email already has an active record
```

**What to create:**

`apps/web/app/dashboard/team/invite/page.tsx` — server component wrapper, renders `<InviteForm />`.

`apps/web/components/dashboard/team/InviteForm.tsx` — `'use client'`:

| Field | Input | Validation |
|---|---|---|
| Nome | `<input>` | required |
| Sobrenome | `<input>` | required |
| E-mail | `<input type="email">` | `z.email()` |
| Função | card-select: Equipe / Gerente | required, defaults to "Equipe" |

- Topbar: back arrow → `/dashboard/team`
- On submit: `inviteStaff({ firstName, lastName, email, role })`
  - `201` → `router.push('/dashboard/team')` + `revalidatePath('/dashboard/team')` + toast "Convite enviado para [email]."
  - `409` → email field gets `has-error` styling + "Este e-mail já está cadastrado na sua equipe." (matches `02b-invite-error.html`); other fields unchanged
  - Inactive record with same email (UC-028 A2) → backend reactivates silently; same `201` success path, no special handling needed client-side
- Submit disabled while in flight

**Acceptance criteria:**
- [ ] All 4 fields render; role selector defaults to "Equipe"
- [ ] `201` → redirects to `/dashboard/team`; new member visible with "Convite pendente" status
- [ ] `409` → email field shows inline error; first/last name and role selection are preserved
- [ ] Back arrow returns to `/dashboard/team` without submitting
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S04

---

### M127-S06 — Equipe: deactivate member flow

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-029, `plan/journey/manager/prototypes/equipe/03-deactivate-confirm.html`, `03b-deactivate-self-error.html`, `03c-deactivate-lastmanager-error.html`

**Description:**
The deactivation confirmation flow, including the two business-rule error states already enforced server-side: self-deactivation (`403`) and last-active-MANAGER (`409`). `PATCH /staff/:id/deactivate` already exists with both guards implemented in `DeactivateStaffUseCase` — frontend-only story.

**Route:** `/dashboard/team/[id]/deactivate`

**`apps/web/lib/api/dashboard/team.ts` additions:**
```typescript
deactivateStaff(staffId: string): Promise<DeactivateStaffResponse>
// PATCH /staff/:id/deactivate -> 200; 403 self; 409 last manager
```

**What to create:**

`apps/web/app/dashboard/team/[id]/deactivate/page.tsx` — server component: looks up the member from the already-fetched team list (or a single `GET /staff/:id` call — confirm which is cheaper at discovery), renders `<DeactivateConfirmPage member={data} />`.

`apps/web/components/dashboard/team/DeactivateConfirmPage.tsx` — `'use client'`:
- Member summary card: avatar + name + email + role
- Warning box: 3 bullets (loses access immediately / past actions stay in history / can be re-invited later) — matches `03-deactivate-confirm.html`
- "Confirmar desativação" (`btn-danger`) → calls `deactivateStaff()`
  - `200` → `router.push('/dashboard/team')` + `revalidatePath('/dashboard/team')`; member now shows "Inativo"
  - `403` → render `<SelfDeactivationError>` inline (matches `03b-deactivate-self-error.html`) — should be unreachable via normal navigation since M127-S04 hides the action on the admin's own row, but the page must still handle it defensively
  - `409` → render `<LastManagerError>` inline (matches `03c-deactivate-lastmanager-error.html`)
- "Cancelar" → `router.back()`

**Acceptance criteria:**
- [ ] Confirmation page shows the correct member's summary card
- [ ] `200` → redirects to `/dashboard/team`; member now shows "Inativo" status
- [ ] `403` → inline error matching `03b-deactivate-self-error.html`'s copy exactly: "Você não pode desativar sua própria conta."
- [ ] `409` → inline error matching `03c-deactivate-lastmanager-error.html`'s copy exactly: "O estabelecimento precisa de pelo menos um gerente ativo."
- [ ] "Cancelar" returns to the previous page without calling the API
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S04

---

### M127-S07 — Hotsite: editor shell + Branding tab

**Agent:** `frontend-ts`
**Complexity:** L
**Docs to load:** `docs/04-USE_CASES.md` § UC-027, `plan/journey/manager/hotsite.md`, `plan/journey/manager/prototypes/hotsite/dev-notes.md`

**Description:**
The Hotsite editor page itself — tabbed shell (Branding / Layout / SEO, client-side tab state, no separate routes, matching the prototype) — plus the Branding tab's full field set. `GET`/`PATCH /tenants/hotsite` and the image signed-URL endpoint already exist and are fully typed in `@beloauto/types` (`packages/types/src/hotsite.ts`) — frontend-only story. Branding scope is the 13-field set agreed during the audit (2026-06-16), not the original 4-field UC-027 text.

> 🔍 **Discover before starting:** Confirm `HotsiteAdminContentResponse`'s exact branding field names in `packages/types/src/hotsite.ts` before building the form. Confirm whether an `UpdateHotsiteContentRequest` TS interface already exists alongside the BFF's `UpdateHotsiteContentBodySchema` Zod schema, or only the Zod schema exists on the BFF side — if the frontend has nothing to import, add the missing TS interface to `packages/types/src/hotsite.ts` as part of this story (small addition, not a new story). Also check `POST /tenants/hotsite/images/signed-url`'s exact request/response shape (`GenerateHotsiteImageSignedUrlResponse`) before wiring the logo upload.

**Prototype references:**
- `plan/journey/manager/prototypes/hotsite/01-hotsite-editor.html` — shell + Branding tab
- `plan/journey/manager/prototypes/hotsite/01b-color-error.html` — invalid hex color (UC-027 A1)
- `plan/journey/manager/prototypes/hotsite/01c-image-upload-fallback.html` — upload failure → URL fallback (UC-027 A2)

**Route:** `/dashboard/hotsite`

**What to create:**

`apps/web/lib/api/dashboard/hotsite.ts`:
```typescript
fetchHotsiteConfig(): Promise<HotsiteAdminContentResponse>
updateHotsiteConfig(body: UpdateHotsiteContentRequest): Promise<HotsiteAdminContentResponse>
requestImageUploadUrl(fileName: string, contentType: string): Promise<GenerateHotsiteImageSignedUrlResponse>
```

`apps/web/app/dashboard/hotsite/page.tsx` — server component: calls `fetchHotsiteConfig()`, renders `<HotsiteEditor initial={data} />`.

`apps/web/components/dashboard/hotsite/HotsiteEditor.tsx` — `'use client'`:
- Tab state: `'branding' | 'layout' | 'seo'` (client-side only, matches prototype's `showTab()`)
- Holds the full draft config in local state; M127-S08/S09 extend this same component with the Layout/SEO tab bodies and the Preview/Publish actions
- "Publicar alterações" button always visible regardless of active tab — calls `updateHotsiteConfig()` then `POST /tenants/hotsite/publish` (full publish flow wired in M127-S09; this story stubs the button disabled until S09 lands, or implements just the `PATCH` half — confirm sequencing at discovery)

`apps/web/components/dashboard/hotsite/BrandingTab.tsx` — grouped into 4 sub-sections (Cores, Logo, Tipografia, Forma e estilo), per the prototype:

| Sub-section | Fields |
|---|---|
| Cores | `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor` (hex inputs + swatch), `buttonBackgroundColor`, `buttonTextColor` (optional) |
| Logo | upload area → `requestImageUploadUrl()` + direct PUT to signed URL; on failure, falls back to a plain URL text input (UC-027 A2) |
| Tipografia | `headingFontFamily`, `bodyFontFamily` (select) |
| Forma e estilo | `borderRadius` (sharp/rounded/pill), `buttonStyle` (filled/outline/ghost), `spacing` (compact/comfortable/spacious), `shadowStyle` (none/subtle/strong) — pill-button selects |

- Hex color fields validate client-side (`/^#[0-9A-Fa-f]{6}$/`) before allowing save; invalid → inline error "Cor inválida. Use o formato hexadecimal, ex: #2563eb." (matches `01b-color-error.html`)

**Acceptance criteria:**
- [ ] Editor loads with 3 tabs; Branding active by default; switching tabs doesn't trigger a network request
- [ ] All 13 branding fields render, grouped into the 4 sub-sections above
- [ ] Invalid hex color shows inline error and blocks save
- [ ] Logo upload failure shows the URL fallback input (simulate by forcing the upload call to reject)
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M125-S01, M127-S04 (shared middleware extension for manager-only routes — or land independently if S04 hasn't merged yet; confirm at discovery to avoid a circular dependency)

---

### M127-S08 — Hotsite: Layout tab (module toggle/reorder + Hero config)

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-027 Section B, `plan/journey/manager/prototypes/hotsite/01-hotsite-editor.html` (Layout tab), `01d-module-config-hero.html`

**Description:**
Extends `HotsiteEditor` (M127-S07) with the Layout tab — the 7-module toggle/reorder list, plus a per-module config drill-down. **Only the HERO module's config panel is in scope here**; the other 6 (`SERVICE_LIST`, `GALLERY`, `BOOKING_CTA`, `TESTIMONIALS`, `ABOUT`, `CONTACT`) are explicitly deferred — see "Future discovery" below.

> 🔍 **Discover before starting:** Decide how "Configurar" should present the per-module panel — modal, slide-over, or a full route. The prototype doesn't mandate one; pick whichever the rest of the dashboard already establishes a precedent for (check if M125 introduced a `Sheet`/`Dialog` pattern) and reuse it rather than inventing a new interaction.

**What to create:**

`apps/web/components/dashboard/hotsite/LayoutTab.tsx`:
- Renders the 7 modules in `layout` array order, each row: drag handle, module name (pt-BR label), "Configurar" link, enabled/disabled toggle
- Drag-to-reorder updates the local `layout` array order (no network call until "Publicar alterações")
- "Configurar" is only wired for HERO in this story; for the other 6 modules render the link disabled with a tooltip "Em breve" rather than a broken link

`apps/web/components/dashboard/hotsite/modules/HeroConfigPanel.tsx`:
- Fields: `title` (required), `subtitle` (optional), layout (`centered`/`left-aligned`), CTA target (`booking`/`service-list`), optional background image (reuses the same signed-URL upload pattern as the Logo field in M127-S07)
- "Aplicar" commits the draft back into `HotsiteEditor`'s local state (no network call — persisted only on "Publicar alterações")

**Acceptance criteria:**
- [ ] Layout tab renders all 7 modules in their current order with working enabled/disabled toggles
- [ ] Drag-to-reorder changes the local order (verify via a subsequent publish round-trip, not just visually)
- [ ] "Configurar" on Hero opens `HeroConfigPanel` pre-filled with current values
- [ ] "Configurar" on the other 6 modules is visibly disabled, not a dead link
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S07

---

### M127-S09 — Hotsite: SEO tab + Preview + Publish/Unpublish

**Agent:** `frontend-ts`
**Complexity:** M
**Docs to load:** `docs/04-USE_CASES.md` § UC-027 Section C, `plan/journey/manager/prototypes/hotsite/02-preview.html`, `03-publish-success.html`

**Description:**
Closes out the Hotsite editor: the SEO tab, the Preview action, and the Publish/Unpublish actions. Preview has an unresolved engineering question (see dev-notes.md) — this story picks the pragmatic v1 answer (client-side render of the draft state) rather than building the more involved BFF preview-token approach; revisit if stakeholders need a pixel-exact production-path preview.

> 🔍 **Discover before starting:** Confirm whether the hotsite's public-facing render components (`HeroModule`, `ServiceListModule`, etc. from M12) can be imported directly into the dashboard bundle to render the draft preview, or whether they have server-only dependencies that block client-side reuse. If they can't be reused directly, scope down to a simplified mock preview for v1 and flag the gap rather than building a parallel render path.

**What to create:**

`apps/web/components/dashboard/hotsite/SeoTab.tsx`:
- `title` (text, maxlength 70, optional) — hint: "Deixe em branco para usar o título gerado automaticamente"
- `description` (textarea, maxlength 160, optional) — same fallback hint

`apps/web/components/dashboard/hotsite/HotsitePreview.tsx`:
- Renders the draft config using the M12 hotsite module components directly (if reusable per discovery) with a sticky banner: "Visualizando alterações não publicadas" + "Voltar a editar" / "Publicar agora" actions
- Opened from the editor's "Preview" button — overlay or new route, confirm at discovery

**`HotsiteEditor` (M127-S07) additions:**
- "Publicar alterações": `updateHotsiteConfig(draft)` → `200` → `POST /tenants/hotsite/publish` → `200` → toast "Hotsite atualizado e no ar." (matches `03-publish-success.html`)
- Danger-zone "Despublicar hotsite": `POST /tenants/hotsite/unpublish` → `200` → toast confirming the hotsite is offline (no dedicated prototype screen — reuse the same toast pattern, different copy)

**Acceptance criteria:**
- [ ] SEO fields enforce their max lengths and show a live character counter
- [ ] "Preview" renders the draft state (not the last-published state) without requiring a save first
- [ ] "Publicar alterações" persists the draft, publishes, and shows the success toast
- [ ] "Despublicar hotsite" is visually separated in a danger-zone section and requires no extra confirmation step beyond the click itself (matches prototype — no confirmation dialog was prototyped for this action; flag if product wants one added)
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M127-S07, M127-S08

---

## Future discovery — stories NOT yet scoped

| Item | Why it's deferred |
|---|---|
| Extra tenant-settings fields (`auto_approve_enabled`, `max_booking_advance_days`, `min_booking_advance_hours`, `slot_granularity_minutes`, `localization` currency/language, `notification.from_email`, `business_info.social_links`) | Backend already supports these (discovered 2026-06-16 code inspection), but neither UC-026 nor the `configuracoes` prototype mention them. Needs an explicit scope decision before a story is written — don't add silently. |
| Per-module config panels for `SERVICE_LIST`, `GALLERY`, `BOOKING_CTA`, `TESTIMONIALS`, `ABOUT`, `CONTACT` | Only HERO was prototyped as a representative example (`01d-module-config-hero.html`). Each of the other 6 needs its own UX pass — `GALLERY` in particular has a `feature-booking-photo` BFF endpoint already wired that none of the above stories use yet. |
| BFF-token-based hotsite preview (pixel-exact production-path render) | M127-S09 ships a pragmatic client-side render instead. Revisit only if the simplified preview proves insufficient in practice. |
| Staff-side loyalty lookup (UC-016 admin/staff variant) | Identified as `_TBD_` in `staff/use-cases.md` during an earlier audit — unrelated to this milestone, tracked separately. |

---

## Open questions (resolve before stories start)

- [ ] M127-S04: does `GET /staff` already expose `googleOAuthId` or `deactivatedBy`? If not, which one should be added to the BFF response?
- [ ] M127-S07/S08: per-module "Configurar" UX — modal, slide-over, or full route? Pick the dashboard's existing precedent if one exists by the time this starts.
- [ ] M127-S09: can M12's hotsite module render components be safely imported into the dashboard bundle for the live preview, or is a simplified mock required for v1?
- [ ] M127-S03 vs. M127-S04/S07: confirm whether `/dashboard/settings`, `/dashboard/team`, and `/dashboard/hotsite` route-guarding is added to M125-S01's middleware as one shared change, or independently per story (avoid three separate, possibly conflicting, middleware edits).
