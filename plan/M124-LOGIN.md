# M124 — Login (Customer + Staff)

**Phase:** Local Development  
**Goal:** Complete the end-to-end login experience for both actors — staff land on the booking dashboard, customers land on the hotsite in logged-in state. Backend and BFF are already implemented (M03/M04); this milestone delivers the three missing frontend pages, closes two BFF cookie gaps, and fixes the customer post-login redirect.  
**Depends on:** M03 (BFF auth controller, JWT, OAuth strategy), M04 (staff activation use case), M12 (hotsite frontend — customer redirect target after login)  
**Blocks:** M125 (staff dashboard shell middleware redirects unauthenticated `/dashboard/**` to `/dashboard/login`)  
**Journey prototypes:** `plan/journey/customer/prototypes/login/` · `plan/journey/staff/prototypes/login/` — reviewed; UC audit done 2026-06-16

> **Discovery note (applies to all stories):** The BFF auth controller (`apps/bff/src/auth/auth.controller.ts`) is fully implemented but has two silent gaps: `POST /auth/token` and `POST /auth/switch-tenant` both return `{ accessToken, expiresIn }` as JSON without setting an `httpOnly` cookie, making authenticated subsequent requests impossible from a browser. Additionally both `handleTenantLogin` and `handleMultiTenantLogin` redirect customers to `/dashboard` (the staff area) instead of the hotsite. S01 fixes these before the frontend stories start. The rest of the backend is solid — do not touch auth strategy, JWT issuer, cookie options, or the Google callback routing logic.

---

## Stories

---

### M124-S01 — BFF: fix auth cookie on `POST /auth/token` + `POST /auth/switch-tenant`; fix customer redirect

**Agent:** `bff-ts`  
**Complexity:** S  
**Docs to load:** `docs/24-BFF_ARCHITECTURE.md`, `docs/04-USE_CASES.md` § UC-021 UC-023, `plan/M03-AUTHENTICATION_IMPLEMENTATION_DETAILS_IA.md`

**Description:**  
Three targeted fixes to `apps/bff/src/auth/auth.controller.ts`. No new endpoints, no schema changes — only behavioural corrections to existing methods. The BFF already has `JWT_COOKIE_OPTIONS` and `res.cookie(...)` usage in other handlers; replicate the same pattern.

> 🔍 **Discover before starting:** Read `apps/bff/src/auth/auth.controller.ts` in full. Confirm the exact signature of `issueToken` and `switchTenant` (no `@Res()` param yet — must add `@Res({ passthrough: true })`). Read `apps/bff/src/auth/cookie-options.ts` to confirm the constant name. Check whether `@beloauto/types` currently exports a type for the `POST /auth/token` response — if yes, that type must be updated here. Run `grep -r "IssueToken\|issueToken" packages/types/` to check.

**Fix 1 — `POST /auth/token` (multi-tenant selection):**

Current:
```ts
async issueToken(@Body() dto: IssueTokenDto): Promise<{ accessToken: string; expiresIn: string }>
```

After fix — set cookie, return tenant slug for frontend redirect:
```ts
async issueToken(
  @Body() dto: IssueTokenDto,
  @Res({ passthrough: true }) res: Response,
): Promise<{ tenantSlug: string; expiresIn: string }> {
  // ... existing match + tenantInfo lookup (unchanged) ...
  const accessToken = this.jwtIssuer.issueToken({ sub: match.customerId, tenantId, tenantSlug, role: 'CUSTOMER' });
  res.cookie('access_token', accessToken, JWT_COOKIE_OPTIONS);
  return { tenantSlug: tenantInfo.slug, expiresIn: this.config.getOrThrow<string>('JWT_EXPIRES_IN') };
}
```

**Fix 2 — `POST /auth/switch-tenant`:**

Same pattern: add `@Res({ passthrough: true }) res: Response`, set cookie, return `{ tenantSlug: string; expiresIn: string }` instead of `{ accessToken, expiresIn }`.

**Fix 3 — customer post-login redirect:**

In `handleTenantLogin` and in the 1-tenant branch of `handleMultiTenantLogin`, change:
```ts
res.redirect(`${frontendUrl}/dashboard`);
```
to:
```ts
res.redirect(`${frontendUrl}/${tenantInfo.slug}`);
```

**`@beloauto/types` changes:**

Add or update `packages/types/src/auth.dto.ts` (create if absent):
```typescript
export interface IssueTokenResponse {
  readonly tenantSlug: string;
  readonly expiresIn: string;
}

export interface SwitchTenantResponse {
  readonly tenantSlug: string;
  readonly expiresIn: string;
}

export interface TenantOption {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly loyaltyPoints: number;   // current_points from loyalty_balances
}
```

`TenantOption` is consumed by the `/select-tenant` page (M124-S03). `IssueTokenResponse` and `SwitchTenantResponse` replace the old `{ accessToken, expiresIn }` shape — since neither endpoint has a frontend consumer yet (those pages are built in S02/S03), this is a safe breaking change.

**Tests to update:**

- `apps/bff/src/auth/auth.controller.spec.ts` — update assertions for `issueToken` and `switchTenant`: verify `res.cookie` is called with `'access_token'`, verify returned shape is `{ tenantSlug, expiresIn }`, verify `accessToken` is no longer in the response
- `apps/bff/src/auth/auth.controller.component.spec.ts` — update the `POST /auth/token` and `POST /auth/switch-tenant` integration assertions; add assertions that `Set-Cookie` header is present; add assertion that `handleTenantLogin` redirects to `/${tenantSlug}` not `/dashboard`

**Acceptance criteria:**
- [ ] `POST /auth/token` response body: `{ tenantSlug: string; expiresIn: string }` — no `accessToken` field
- [ ] `POST /auth/token` sets `access_token` httpOnly cookie (same options as other handlers)
- [ ] `POST /auth/switch-tenant` response body: `{ tenantSlug: string; expiresIn: string }` — no `accessToken` field
- [ ] `POST /auth/switch-tenant` sets `access_token` httpOnly cookie
- [ ] `GET /auth/google/callback` for a tenant-scoped customer login redirects to `${frontendUrl}/${tenantSlug}`, not `/dashboard`
- [ ] `GET /auth/google/callback` for multi-tenant customer (auto-selected 1 tenant) redirects to `${frontendUrl}/${tenantSlug}`
- [ ] Staff login redirect unchanged: still redirects to `${frontendUrl}/dashboard`
- [ ] `IssueTokenResponse`, `SwitchTenantResponse`, `TenantOption` exported from `@beloauto/types`
- [ ] `.http` block in `apps/bff/http/auth/auth.http` reflects updated response shape
- [ ] All existing auth controller tests pass; no new TypeScript errors

**Dependencies:** none (first story)

---

### M124-S02 — Staff login frontend: `/dashboard/login`, `/auth/first-login`, `/auth/error`

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `docs/04-USE_CASES.md` § UC-022 UC-025, `plan/journey/staff/prototypes/login/dev-notes.md`

**Description:**  
Three static server-component pages covering the complete staff authentication surface (UC-022 and UC-025). All BFF redirects for staff already land in the right places; this story just creates the pages those redirects point to.

> 🔍 **Discover before starting:** Check `apps/web/app/dashboard/` — a `page.tsx` stub may exist; read it. Check `apps/web/app/auth/login/page.tsx` — a 3-line stub exists at the wrong route; delete it in this story (nothing links to `/auth/login`). Verify `apps/web/middleware.ts` does NOT exist yet (it is created in M125-S01). If it does exist, read it before touching any route.

**Prototype references:**
- `plan/journey/staff/prototypes/login/00-staff-login.html` → `plan/journey/shared/staff-login.html` (staff login screen)
- `plan/journey/staff/prototypes/login/01-first-login.html` (invite not accepted)
- `plan/journey/staff/prototypes/login/01b-error.html` and `plan/journey/customer/prototypes/login/01b-error.html` (shared error page)

**What to create / delete:**

`apps/web/app/dashboard/login/page.tsx` — server component:

```typescript
// Reads optional ?error= from searchParams; renders the staff login screen.
// No data fetching — static.
```

Renders (per `shared/staff-login.html`):
- BeloAuto logomark (SVG or `<img>`)
- Heading: `"Área da Equipe"`
- Subtext: `"Acesso exclusivo para funcionários e gerentes"`
- If `searchParams.error === 'not-a-staff-member'`: inline red alert box above the button — `"Sua conta Google não está cadastrada como funcionário neste estabelecimento."` + retry button
- Google Sign-In button: `<a href="/api/auth/google?state=__staff__">` — full page navigation (not `fetch`)
- Footer note: `"Primeiro acesso? Use o link enviado no e-mail de convite."`

> Note: the Google Sign-In button is a plain `<a>` tag (full redirect), not a form submit or client-side fetch, because OAuth requires a browser navigation to set the state cookie correctly.

`apps/web/app/auth/first-login/page.tsx` — server component:

Renders (per `01-first-login.html`):
- Envelope icon in blue circle (use an SVG icon or emoji placeholder; do not install a new icon library)
- Heading: `"Acesso ainda não ativado"`
- Explanation paragraph: staff must use the invite link from their email
- 3-step instruction list (match prototype text exactly — pt-BR)
- Note: `"Não recebeu o e-mail? Peça ao gerente que reenvie o convite."`
- `"Voltar ao login"` link → `/dashboard/login`

`apps/web/app/auth/error/page.tsx` — server component (shared by staff + customer):

`searchParams.reason` drives content:

| `reason` | Heading | Message | CTA label | CTA href |
|---|---|---|---|---|
| `not-a-staff-member` | `"Acesso não autorizado"` | `"Sua conta Google não está cadastrada como funcionário neste estabelecimento."` | `"Voltar ao login"` | `/dashboard/login` |
| `email-mismatch` | `"Acesso não autorizado"` | `"Por favor, use o e-mail para o qual você foi convidado(a)."` | `"Voltar ao login"` | `/dashboard/login` |
| `invite-not-found` | `"Convite não encontrado"` | `"Nenhum convite pendente foi encontrado para este estabelecimento."` | `"Voltar ao login"` | `/dashboard/login` |
| `tenant-not-found` | `"Estabelecimento não encontrado"` | `"O link de convite é inválido ou o estabelecimento foi removido."` | `"Voltar ao site"` | `/` |
| `tenant-deactivated` | `"Estabelecimento desativado"` | `"Este estabelecimento está temporariamente desativado."` | `"Voltar ao site"` | `/` |
| `no-tenant` | `"Não foi possível entrar"` | `"Nenhum estabelecimento encontrado para sua conta Google."` | `"Voltar ao site"` | `/` |
| _(unknown / missing)_ | `"Erro de autenticação"` | `"Ocorreu um erro inesperado. Tente novamente."` | `"Voltar"` | `"javascript:history.back()"` |

Show `reason` code at bottom in small grey text for support reference (e.g. `"Código: not-a-staff-member"`).

**Delete:**

`apps/web/app/auth/login/page.tsx` — the existing 3-line stub at `/auth/login`. This route is not referenced anywhere and conflicts with the convention. Remove the file and the `login/` directory under `auth/`.

**Testing:**

These are `app/**/page.tsx` server components — do not write Vitest unit tests. Acceptance is verified by the AC below; full E2E coverage belongs to a future Playwright suite.

**Acceptance criteria:**
- [ ] `GET /dashboard/login` renders the staff login screen; Google button href = `/api/auth/google?state=__staff__` (confirm exact BFF route prefix)
- [ ] `GET /dashboard/login?error=not-a-staff-member` renders inline red alert; page does not redirect
- [ ] `GET /auth/first-login` renders the invite-not-accepted screen with "Voltar ao login" link
- [ ] `GET /auth/error?reason=not-a-staff-member` renders correct heading + message + CTA
- [ ] `GET /auth/error?reason=no-tenant` renders correct heading + message + CTA pointing to `/`
- [ ] `GET /auth/error` (no reason) renders fallback error message without throwing
- [ ] `apps/web/app/auth/login/page.tsx` deleted
- [ ] `tsc --noEmit` passes; `pnpm lint` zero warnings

**Dependencies:** M124-S01 not strictly required (staff redirects already correct), but run S01 first to keep story order clean. Can be developed in parallel with S01.

---

### M124-S03 — Customer login frontend: `/{slug}/login`, `/select-tenant`, phone completion

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md`, `docs/04-USE_CASES.md` § UC-021 UC-023, `plan/journey/customer/prototypes/login/dev-notes.md`, `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md`

**Description:**  
Three customer-facing auth pages: the tenant-branded login screen, the multi-tenant selection screen (UC-021 Case B), and an inline phone completion prompt (UC-021 A3). All BFF endpoints already exist after S01 is applied.

> 🔍 **Discover before starting:**
> - Confirm S01 is merged (cookie fix + customer redirect to `/{slug}`)
> - Read `apps/web/app/[slug]/layout.tsx` — phone prompt goes here
> - Read `apps/web/lib/api/` to understand existing fetcher conventions before adding new ones
> - Verify the BFF route prefix for auth: is it `/api/auth/...` or `/v1/auth/...`? Check `apps/web/` next.config or API route proxying to confirm
> - Confirm `TenantOption` is in `@beloauto/types` (added in S01)

**Prototype references:**
- `plan/journey/shared/login.html` (customer login screen)
- `plan/journey/customer/prototypes/login/01-select-tenant.html` (tenant selection)
- `plan/journey/customer/prototypes/login/02-phone-completion.html` (phone prompt — rendered inline, not as a page)

**What to create:**

---

#### `apps/web/app/[slug]/login/page.tsx` — server component

Fetches hotsite config to get tenant branding; renders the customer login screen.

```typescript
// Params: { slug: string }
// Fetches: GET /v1/hotsite/{slug}/config → { name, branding: { logoUrl, primaryColor } }
// If tenant not found → notFound()
```

Renders (per `shared/login.html`):
- Tenant logo: if `branding.logoUrl` → `<img src={logoUrl} alt={tenantName}>`, else name-initial avatar with `--ba-primary` background
- Heading: `"Entrar na {tenantName}"`
- Subtext: `"Entre com sua conta Google para agendar"`
- If `searchParams.error` present → inline red alert with a generic `"Erro ao entrar. Tente novamente."` message (BFF error detail not shown to customers)
- Google Sign-In button: `<a href="/api/auth/google?tenantSlug={slug}">` (full page navigation)
- Terms notice (pt-BR)

`generateMetadata`: `title: \`Entrar — {tenantName}\``

---

#### `apps/web/app/select-tenant/page.tsx` — `'use client'`

Shown when the customer belongs to 2+ tenants (UC-021 Case B). BFF has already issued a selection token and redirected here with `?token=<selectionToken>`.

```typescript
// Reads ?token= from searchParams (passed as prop from server wrapper)
// On mount: decodes or fetches the tenant list
// On tenant click: POST /api/auth/token { selectionToken, tenantId }
//   → { tenantSlug } → router.push(`/${tenantSlug}`)
```

> 🔍 **Discover:** Does the `selectionToken` contain the tenant list encoded (JWT-like, decodable without a server call), or does the frontend need to call `GET /api/auth/tenants?token=...` first? Check `apps/bff/src/auth/selection-token.service.ts` — if `issueSelectionToken` only encodes `{ googleOAuthId }` (not the tenant list), the frontend must call a separate endpoint to get the list. If no such endpoint exists, add it to this story's scope or decode via `POST /auth/token` with a dry-run approach. **Resolve this before writing any component code.**

Renders (per `01-select-tenant.html`):
- Heading: `"Selecionar Estabelecimento"`
- Subtext: `"Você tem acesso a mais de um estabelecimento."`
- List of `TenantOption` cards, each showing:
  - Name-initial avatar (use `--ba-primary` placeholder until per-tenant color is available)
  - Tenant name (bold)
  - `"{loyaltyPoints} pontos ativos"` (or `"0 pontos"`)
  - Chevron right
  - Tappable → calls `POST /auth/token`
- Loading state: 2–3 skeleton cards while data loads
- Error state: token invalid/expired → `"Sessão expirada. Tente entrar novamente."` with link back to `/auth/login` (the generic entry)

On `POST /api/auth/token` success: `{ tenantSlug }` → `router.push(`/${tenantSlug}`)`.

`@beloauto/types` addition (if not already in S01): `TenantOption` must include `primaryColor?: string` if the BFF selection token carries it — verify and add the field if present.

---

#### `apps/web/components/customer/PhoneCompletionPrompt.tsx` — `'use client'`

An inline bottom-sheet prompt shown to customers who have no `phone` set (UC-021 A3). Mounts inside `apps/web/app/[slug]/layout.tsx`.

```typescript
// On mount: GET /api/customers/me → { phone: string | null }
// If phone != null OR user is not authenticated (no cookie / 401) → render nothing
// If phone == null → show bottom sheet
```

Sheet content (per `02-phone-completion.html`):
- Heading: `"Completar seu perfil"`
- Subtext: `"Informe seu telefone para receber confirmações de agendamento."`
- Phone input: `<input type="tel" placeholder="(11) 99999-9999">`
  - Client-side mask: strip non-digits; display as `(XX) XXXXX-XXXX` or `(XX) XXXX-XXXX`
  - Validation: stripped digits must be 10 or 11 characters
- `"Salvar"` button — disabled until valid
- `"Agora não"` dismiss link (dismisses for the session, does not persist)

On submit:
```
PATCH /api/customers/me { phone: "<stripped-digits>" }
→ 200: close sheet
→ 422 { type: 'invalid-phone' }: "Digite um número de telefone válido (10 ou 11 dígitos)."
→ other error: "Erro ao salvar. Tente novamente."
```

Add `PhoneCompletionPrompt` to `apps/web/app/[slug]/layout.tsx`:
```tsx
// Server layout renders children; PhoneCompletionPrompt is a client component
// that mounts and self-checks; it renders nothing until it confirms phone == null.
<PhoneCompletionPrompt />
{children}
```

**Testing:**

All three pages are `app/**/page.tsx` — do not unit-test. `PhoneCompletionPrompt` is a complex stateful client component — Playwright E2E. No Vitest coverage required for this story; SonarCloud `sonar.coverage.exclusions` already covers `apps/web/app/**/page.tsx`.

**`apps/web/lib/api/` additions:**

```typescript
// apps/web/lib/api/auth.ts
fetchTenantOptions(token: string): Promise<TenantOption[]>
issueToken(selectionToken: string, tenantId: string): Promise<IssueTokenResponse>
// (cookie set server-side by BFF; response body gives tenantSlug for redirect)

// apps/web/lib/api/customers.ts (or extend existing)
getCustomerProfile(): Promise<CustomerProfileResponse>
updateCustomerProfile(body: { phone: string }): Promise<CustomerProfileResponse>
```

Follow the naming and error-handling pattern of existing fetchers in `apps/web/lib/api/`.

**Acceptance criteria:**

*Customer login page:*
- [ ] `GET /{slug}/login` renders tenant name + logo (or initial fallback)
- [ ] `generateMetadata` returns `title: "Entrar — {tenantName}"`
- [ ] Google button href routes to BFF OAuth with correct `tenantSlug` param
- [ ] `GET /{slug}/login?error=anything` shows inline red alert
- [ ] Unknown slug → `notFound()` (404 page)

*Select-tenant page:*
- [ ] `GET /select-tenant?token=<valid>` renders list of tenant cards with name + loyalty points
- [ ] Clicking a card calls `POST /api/auth/token`; on success redirects to `/{tenantSlug}`
- [ ] Expired / invalid token → error banner with link back to login
- [ ] Loading skeleton visible before data resolves

*Phone completion prompt:*
- [ ] Prompt does NOT appear when `GET /api/customers/me` returns `phone != null`
- [ ] Prompt does NOT appear when request is unauthenticated (guest, no cookie)
- [ ] Prompt appears as bottom sheet when `phone == null`
- [ ] Submit disabled while phone input < 10 digits
- [ ] Valid submit → `PATCH /api/customers/me` → sheet closes
- [ ] `422` → inline error message in pt-BR; sheet stays open
- [ ] "Agora não" dismisses for session; prompt does not reappear on route change within the session

*General:*
- [ ] `tsc --noEmit` passes across monorepo
- [ ] `pnpm lint` zero warnings
- [ ] No new `any` types introduced

**Dependencies:** M124-S01 (cookie fix must be deployed; customer redirect must land on `/{slug}`)

---

## Open questions (resolve before each story starts)

- [ ] **BFF API route prefix in `apps/web`:** is auth called via `/api/auth/...` (Next.js API route proxy) or directly as `/v1/auth/...` (direct BFF call)? Verify before S02 and S03. Check `next.config.js` rewrites or `apps/web/app/api/` route handlers.
- [ ] **Selection token decode strategy:** does `issueSelectionToken` encode the tenant list (decode on frontend) or only `{ googleOAuthId }` (requires a separate BFF `GET /auth/tenants?token=...` endpoint)? If endpoint is missing, add to S01 scope. Resolve before S03.
- [ ] **`TenantOption.primaryColor`:** does the BFF selection token carry the tenant's `primaryColor`? If yes, include the field in `TenantOption` and use it for the initial avatar background in `/select-tenant`. If no, use a neutral placeholder.
- [ ] **Post-login redirect from customer area:** after the customer lands on `/{slug}` (the hotsite), the hotsite reads the JWT cookie server-side and shows a logged-in nav bar. Confirm M12 hotsite already reads the `access_token` cookie — or plan a follow-up story to add the logged-in state to the hotsite layout.
- [ ] **Staff login Google button href prefix:** `/api/auth/google` (Next.js proxy) or `/v1/auth/google` (direct BFF)? Must match what the BFF OAuth callback `redirectUri` expects. Resolve before S02 AC sign-off.

---

## Future discovery — stories NOT in this milestone

| Item | Notes |
|---|---|
| UC-023 full flow (switch-tenant UI) | The BFF endpoint is fixed in S01 (cookie set) and `GET /v1/customers/tenants` is added in M126-S08. The UI trigger (avatar dropdown → "Trocar empresa") and `/switch-tenant` page are implemented in **M126-S08**. |
| Customer area / `/minha-conta` | Where the customer manages bookings (UC-006). Current post-login destination `/{slug}` is a temporary landing; full customer dashboard is a future milestone |
| Staff logout | No logout endpoint designed yet. JWT expiry → redirect to `/dashboard/login`. Explicit logout button is post-MVP |
| "Bem-vindo(a)!" first-login banner (UC-025 step 8) | BFF would need to append `?welcome=1` to the `/dashboard` redirect; dashboard renders a one-time dismissible banner. Scope to M125 or a follow-up patch |
| Playwright E2E suite | Login flows need full E2E coverage. Scope after M124 is live in a staging environment |
