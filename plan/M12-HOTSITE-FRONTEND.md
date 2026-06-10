# M12 — Hotsite Public Frontend

**Phase:** Local Development  
**Goal:** Every tenant has a public-facing website at `http://localhost:3000/[slug]` with their branding, a list of services, and a complete booking form flow. The frontend is driven by a server-side manifest so layout changes don't require code deployments.  
**Depends on:** M07-S04 (guest booking endpoint), M05-S05 (public services list), M06-S04 (availability endpoint), M02 (hotsite manifest API), M115-S01 (GCS signed-URL upload — required for admin image uploads in M12-S02)  
**Blocks:** M13 (dashboard includes hotsite manager), M16 (E2E tests include hotsite flow)

---

## Stories

---

### M12-S01 — HotsiteConfig domain update + manifest API ✅ Done

**Agent:** `backend-ts` + `bff-ts`  
**Complexity:** M  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md`, `docs/14-API_CONTRACTS.md` § tenants/slug endpoint

**Description:**  
Implement the hotsite manifest API that powers the frontend rendering engine. The manifest bundles the full branding token set and ordered layout configuration into a single JSON response. Also complete the `HotsiteConfig` domain layer fully (M02-S01 created a stub) with the module types and branding tokens from the architecture doc.

**Module types (from `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md`):**
`HERO | SERVICE_LIST | GALLERY | TESTIMONIALS | BOOKING_CTA | ABOUT | CONTACT`

Each module has `type`, `enabled` flag, and a `data` object specific to the type. The `enabled` flag allows hiding a module without removing it from the layout array.

**Full branding token set (from `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` §2):**

```typescript
interface HotsiteBranding {
  // Direct values
  primaryColor: string;       // hex
  secondaryColor: string;     // hex
  backgroundColor: string;    // hex, default #ffffff
  textColor: string;          // hex, default #111827
  headingFontFamily: string;  // e.g. "Playfair Display, serif"
  bodyFontFamily: string;     // e.g. "Inter, sans-serif"
  logoUrl: string;            // GCS URL

  // Semantic choices
  borderRadius: 'sharp' | 'rounded' | 'pill';
  buttonStyle:  'filled' | 'outline' | 'ghost';
  spacing:      'compact' | 'comfortable' | 'spacious';
  shadowStyle:  'none' | 'subtle' | 'strong';
}
```

**Backend endpoint (new — Platform context):**
- `GET /hotsite` — reached via BFF `getForPublic` (like `services`/`schedule`); resolves `tenantId` from `TenantContext` (populated from `X-Tenant-ID` set by the BFF)
- Returns `{ branding: HotsiteBranding, layout: HotsiteModule[], isPublished: boolean }`
- Throws `HotsiteNotPublishedError` when `isPublished === false` → mapped to `404` (kept separate from M12-S02's admin `GET /v1/tenants/hotsite`, which always returns full state regardless of publish status)
- Throws `HotsiteNotFoundError` if no `hotsite_configs` row exists for the tenant → `404`

**BFF orchestration (`GET /v1/tenants/slug/:slug`):**
1. `GET /internal/tenants/by-slug/:slug` → `{ id, name, slug }` (404 if tenant not found)
2. `getForPublic('/hotsite', tenant.id)` → `{ branding, layout, isPublished }` (404 if not published)
3. Composes `{ tenant, branding, layout, isPublished }`, sets `Cache-Control: public, max-age=300`

**Default branding (set by `HotsiteConfig.create()` on tenant provisioning):**
```typescript
{
  primaryColor: '#2563eb',
  secondaryColor: '#eff6ff',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  headingFontFamily: 'Inter, sans-serif',
  bodyFontFamily: 'Inter, sans-serif',
  logoUrl: '',
  borderRadius: 'rounded',
  buttonStyle: 'filled',
  spacing: 'comfortable',
  shadowStyle: 'subtle',
}
```

**BFF endpoint:** `GET /v1/tenants/slug/:slug`
- **Public** — no auth required
- Returns full manifest:
```json
{
  "tenant": { "id": "uuid", "name": "Lavacar BeloAuto", "slug": "lavacar-beloauto" },
  "branding": {
    "primaryColor": "#f97316",
    "secondaryColor": "#fff7ed",
    "backgroundColor": "#ffffff",
    "textColor": "#111827",
    "headingFontFamily": "Inter, sans-serif",
    "bodyFontFamily": "Inter, sans-serif",
    "logoUrl": "https://storage.../logo.png",
    "borderRadius": "rounded",
    "buttonStyle": "filled",
    "spacing": "comfortable",
    "shadowStyle": "subtle"
  },
  "layout": [
    { "type": "HERO", "enabled": true, "data": { "variant": "centered", "title": "Bem-vindo à Lavacar", "ctaLabel": "Agendar agora", "ctaTarget": "booking" } },
    { "type": "SERVICE_LIST", "enabled": true, "data": { "showPrices": true, "showPoints": true, "layout": "grid" } },
    { "type": "GALLERY", "enabled": false, "data": { "images": [], "layout": "grid", "maxVisible": 6 } }
  ],
  "isPublished": true
}
```
- If tenant not found → `404`
- If hotsite not published → `404` (public cannot see unpublished hotsites)

**Acceptance criteria:**
- [ ] `GET /v1/tenants/slug/lavacar-beloauto` returns full manifest JSON with all 10 branding tokens
- [ ] Each layout item includes `type`, `enabled`, and `data`
- [ ] Modules with `enabled: false` are included in the manifest response (the frontend decides to skip them)
- [ ] Unpublished hotsite returns `404`
- [ ] Non-existent slug returns `404`
- [ ] Response is cacheable: `Cache-Control: public, max-age=300` header set
- [ ] BFF adds `Cache-Control` header — Next.js ISR will respect it
- [ ] Tenant isolation: `GET /v1/tenants/slug/slug-b` does not return tenant A's hotsite data

**Dependencies:** M02-S03, M03-S05

---

### M12-S02 — UC-027: Admin manages hotsite ✅ Done

**Agent:** `backend-ts` + `bff-ts` — spans both the `platform` context (hotsite content/publish/upload) and the `booking` context (photo-existence retrofit, see cross-cutting addition below)  
**Complexity:** L  
**Docs to load:** `docs/04-USE_CASES.md` § UC-027, `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md`

**Description:**  
Implement the admin endpoint for updating hotsite content (full branding token set + layout modules) and toggling publish status, plus the signed-URL flow that lets admins upload hotsite images (logo, hero/CTA backgrounds, gallery, about photos). The backend stores and returns GCS **paths** only — `filePath`, never signed URLs — fresh read-signed URLs are generated at display time. M115-S01 built the `IStorageService`/`GcsSignedUrlAdapter` and a booking-specific signed-URL endpoint; M12-S02 reuses that same port/adapter behind a hotsite-specific endpoint and path convention (M115-S01's note explicitly defers "the BFF endpoint for [hotsite uploads]" to "a separate story in M12" — this is that story).

**Backend use cases:**
- `UpdateHotsiteContentUseCase` — loads `HotsiteConfig` by `tenantId`, calls `config.updateContent(branding, layout)`, persists
- `PublishHotsiteUseCase` — calls `config.publish()`, persists
- `UnpublishHotsiteUseCase` — calls `config.unpublish()`, persists
- `GenerateHotsiteImageSignedUrlUseCase` — generates a GCS signed upload URL for hotsite images via `IStorageService` (same adapter as M115-S01, no new storage code); returns `{ signedUrl, filePath, expiresAt }`. `filePath = tenants/<tenantId>/hotsite/<purpose>/<uuid>/<fileName>`, where `purpose` is one of `branding | hero | gallery | about | booking-cta` — keeps uploaded assets organized by what they're for, mirroring how booking attachments are grouped by `bookingId`

**BFF endpoints:**
- `PATCH /v1/tenants/hotsite` — requires JWT + `MANAGER` role; body: `{ branding?, layout? }`; returns `200`
- `POST /v1/tenants/hotsite/publish` — requires JWT + `MANAGER` role; returns `200 { isPublished: true }`
- `POST /v1/tenants/hotsite/unpublish` — requires JWT + `MANAGER` role; returns `200 { isPublished: false }`
- `GET /v1/tenants/hotsite` — requires JWT + `MANAGER` role; returns full hotsite config including unpublished state
- `POST /v1/tenants/hotsite/images/signed-url` — requires JWT + `MANAGER` role; body: `{ fileName, contentType, purpose }`; returns `201 { signedUrl, filePath, expiresAt }`

**Branding validation rules:**
- `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor` — valid hex strings (`#rrggbb`)
- `borderRadius` — one of `sharp | rounded | pill`
- `buttonStyle` — one of `filled | outline | ghost`
- `spacing` — one of `compact | comfortable | spacious`
- `shadowStyle` — one of `none | subtle | strong`
- `logoUrl`, image URLs in module `data` — must be valid GCS paths (`tenants/<uuid>/...`) obtained from the signed-URL endpoint above

**Cross-cutting addition — verify uploaded images exist before persisting (booking + hotsite):**

> **Why:** Pre-signed URLs let the frontend upload directly to GCS, bypassing the backend entirely. Today, nothing confirms that a `filePath`/`photoUrl` the client submits actually corresponds to a file that was uploaded — the backend only validates the *string format* (regex/URL shape — see `complete-booking.dto.ts:13`). A user could close the tab mid-upload, hit a network failure, or (in the worst case) hand-craft a request, and the booking/hotsite would persist a permanently broken image reference. Since images are core to both the booking experience (before/after photos drive trust and dispute resolution) and the hotsite (branding, galleries, hero banners — literally the product's visual identity for each tenant), this deserves a real check rather than trusting client-provided strings.
>
> **What:**
> 1. Extend `IStorageService` (shared port, `storage.service.port.ts`) with `exists(storagePath: string): Promise<boolean>` — `GcsSignedUrlAdapter` implements it via a single GCS metadata lookup (`bucket.file(path).exists()`); `InMemoryStorageService` gets a trackable `existingPaths` set + `markAsUploaded()` helper so specs can simulate both "uploaded" and "missing" scenarios
> 2. **Hotsite** (core to this story): `UpdateHotsiteContentUseCase` calls `exists()` for every non-empty image path in the submitted `branding`/`layout` (`logoUrl`, module `backgroundImageUrl`/`imageUrl`/`avatarUrl`, gallery `images[].url` where `source: 'upload'`) before calling `config.updateContent()`; throws `HotsiteImageNotUploadedError extends PlatformDomainError` → `400 hotsite-image-not-uploaded` if any path doesn't resolve
> 3. **Booking retrofit** (bundled in as the "attachment" part of this story — same gap, same fix, same place, no separate story): `RequestBookingUseCase`, `RequestAuthenticatedBookingUseCase`, `SubmitBookingInfoUseCase`/`SubmitGuestBookingInfoUseCase`, and `CompleteBookingUseCase` each gain the same `exists()` check on every submitted photo path; throws a new `BookingPhotoNotUploadedError extends BookingDomainError` → `400 photo-not-uploaded`
>
> Acceptance criteria for this addition are folded into the list below (the three `image`/`photo`-existence checkboxes).

**Acceptance criteria:**
- [ ] PATCH updates branding and/or layout; unspecified fields unchanged (partial update)
- [ ] All 10 branding tokens accepted and persisted correctly
- [ ] `primaryColor` with invalid hex (e.g., `"notacolor"`) returns `400`
- [ ] `borderRadius` with invalid value returns `400`
- [ ] Layout with unknown module type returns `400`
- [ ] Module `enabled` flag persisted correctly — toggling `enabled: false` does not remove the module from DB
- [ ] Publishing a hotsite with no `enabled: true` modules returns `422`
- [ ] After publish → `GET /v1/tenants/slug/:slug` returns the manifest
- [ ] After unpublish → `GET /v1/tenants/slug/:slug` returns `404`
- [ ] Only `MANAGER` role can publish — `STAFF` returns `403`
- [ ] `POST /v1/tenants/hotsite/images/signed-url` returns `filePath` matching `tenants/<tenantId>/hotsite/<purpose>/<uuid>/<fileName>`
- [ ] `purpose` must be one of `branding | hero | gallery | about | booking-cta` — invalid value returns `400`
- [ ] Only `MANAGER` role can request a hotsite image signed URL — `STAFF` returns `403`
- [ ] Tenant isolation: a `MANAGER` JWT scoped to Tenant A cannot view, update, publish, unpublish, or request image-upload URLs for Tenant B's hotsite — every operation resolves `tenantId` from `TenantContext` (JWT claim, never a path param), so cross-tenant access is structurally impossible; integration test asserts Tenant B's `hotsite_configs` row is unaffected by Tenant A's calls
- [ ] `PATCH /v1/tenants/hotsite` with a `logoUrl`/module image path not present in GCS → `400 hotsite-image-not-uploaded` (cross-cutting addition — `IStorageService.exists()`)
- [ ] `POST /v1/bookings`, `POST /v1/bookings/authenticated`, `PATCH /bookings/:id/submit-info`, and `PATCH /bookings/:id/complete` each → `400 photo-not-uploaded` when a submitted photo path doesn't exist in GCS (cross-cutting addition — same `IStorageService.exists()` check retrofitted into `RequestBookingUseCase`, `RequestAuthenticatedBookingUseCase`, `SubmitBookingInfoUseCase`/`SubmitGuestBookingInfoUseCase`, `CompleteBookingUseCase`)
- [ ] Happy path proven end-to-end for both contexts: upload to the signed URL first (GCS emulator), then submit with the returned `filePath` → succeeds without an existence error

**Dependencies:** M12-S01, M03-S05, M115-S01

---

### M12-S03 — Next.js [slug] routing + manifest fetching + CSS branding ✅ Done

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § routing + manifest caching + CSS variables

**Description:**  
Implement the Next.js App Router foundation for the hotsite: the `[slug]/layout.tsx` fetches the manifest (with ISR 5-minute revalidation), applies the full branding token set via CSS custom properties using `applyBranding()`, and makes it available to child pages. Also includes the shared types migration and env var additions required before any module story starts.

> **Discovery decisions (2026-06-08):**
> - **No ManifestContext** — `layout.tsx` and `page.tsx` are both server components; React context is client-only. Both independently call `fetchManifest(slug)`; Next.js deduplicates the `fetch()` into a single BFF call per render. CSS variables (`var(--ba-*)`) injected on `<body>` are globally available to all client components — no JS data-passing needed for styling.
> - **ISR unchanged** — `next: { revalidate: 300 }` in `fetchManifest()` is the caching strategy. On-demand revalidation via `/api/revalidate` clears the cache immediately on publish/unpublish.
> - **Font allow-list** — `headingFontFamily`/`bodyFontFamily` resolved via `apps/web/lib/hotsite/font-config.ts` which pre-loads 8 fonts at build time using `next/font/google`. Manifest stores the font key (e.g. `"Playfair Display"`); `applyBranding()` maps it to `var(--font-<key>)`. No runtime CDN link, no LGPD exposure.
> - **Shared types migration** — `packages/types/src/hotsite.ts` created in this branch; `apps/bff/src/tenants/tenants.types.ts` deleted; 5 BFF files updated to import from `@beloauto/types`. Backend domain types (`HotsiteBranding`, `HotsiteModule` in `hotsite-config.aggregate.ts`) are NOT touched — they are domain-layer types, not API contract types.
> - **async params** — Next.js 16: `params: Promise<{ slug: string }>; const { slug } = await params` throughout.
> - **Env vars** — `HOTSITE_REVALIDATE_SECRET` and `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` added to `apps/web/.env.example` and `.env.local`. `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` defaults to `http://localhost:4443/beloauto-hotsite-public-dev` locally; set to CDN/bucket URL in prod via environment config.

**Font allow-list (`apps/web/lib/hotsite/font-config.ts`):**

| Manifest key | Font | Personality |
|---|---|---|
| `"Inter"` | Inter | Modern, neutral — default |
| `"Poppins"` | Poppins | Friendly, rounded — salons, clinics |
| `"Playfair Display"` | Playfair Display | Elegant, premium — luxury detailing |
| `"Montserrat"` | Montserrat | Bold, impactful — performance/sports |
| `"Raleway"` | Raleway | Light, refined — boutique/premium |
| `"Oswald"` | Oswald | Strong, condensed — garages, auto shops |
| `"Lato"` | Lato | Clean, trustworthy — clinics, corporate |
| `"Roboto"` | Roboto | Neutral, reliable — mechanics, services |

Each font is loaded once at build time with a CSS variable (`variable` option in `next/font/google`). `applyBranding()` resolves the manifest font key to the matching CSS variable; unknown keys fall back to `"Inter"`.

**Shared types migration (same branch — do first):**
1. Create `packages/types/src/hotsite.ts` — move `HotsiteManifestResponse`, `HotsiteBrandingResponse`, `HotsiteModuleResponse`, `HotsiteAdminContentResponse`, `PublishHotsiteResponse`, `UnpublishHotsiteResponse`, `GenerateHotsiteImageSignedUrlResponse`, `FeatureBookingPhotoResponse` from `apps/bff/src/tenants/tenants.types.ts`; **also define all 7 module data interfaces** (`HeroModuleData`, `ServiceListModuleData`, `GalleryModuleData`, `TestimonialsModuleData`, `BookingCtaModuleData`, `AboutModuleData`, `ContactModuleData`) from `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` §4 — so S04–S09 module components import from `@beloauto/types` rather than defining local interfaces that can drift from the BFF
2. Add `export * from './hotsite'` to `packages/types/src/index.ts`
3. Delete `apps/bff/src/tenants/tenants.types.ts`
4. Update 5 BFF files to import from `@beloauto/types`: `tenants.controller.ts`, `hotsite-admin.controller.ts`, `tenants.controller.spec.ts`, `tenants.controller.component.spec.ts`, `hotsite-admin.controller.spec.ts`

**What to create/update in `apps/web/`:**
- `apps/web/lib/hotsite/font-config.ts` — loads 8 fonts via `next/font/google`, exports `FONT_VARIABLES` array (for `<body className>`) and `FONT_MAP` (key → CSS variable string)
- `apps/web/lib/hotsite/apply-branding.ts` — `applyBranding(branding)` returns `React.CSSProperties` with all `--ba-*` variables; resolves font keys via `FONT_MAP`
- `apps/web/lib/api/tenant.ts` — `fetchManifest(slug)` calls `GET ${NEXT_PUBLIC_BFF_URL}/tenants/slug/${slug}` with `next: { revalidate: 300 }`; calls `notFound()` on 404
- `apps/web/app/[slug]/layout.tsx` — server component; `await params`; calls `fetchManifest(slug)`; injects `applyBranding()` result on `<body style>`; adds font CSS variables via `className` on `<body>`; wraps children in `<html lang="pt-BR">`
- `apps/web/app/[slug]/page.tsx` — server component; `await params`; calls `fetchManifest(slug)` (deduplicated); filters `layout[]` to `enabled: true`; maps each type to its component via `MODULE_MAP` (starts as `Partial<Record<HotsiteModuleType, ...>> = {}` — each module story S04–S06 registers its entry); renders `<Footer />`
- `apps/web/app/api/revalidate/route.ts` — `GET` handler; verifies `secret` query param against `HOTSITE_REVALIDATE_SECRET`; calls `revalidatePath('/[slug]', 'page')` on match; returns `401` on mismatch/missing
- `apps/web/next.config.mjs` — add `images.remotePatterns` reading hostname from `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL`

**`applyBranding()` signature** (`apps/web/lib/hotsite/apply-branding.ts`):

```typescript
const BORDER_RADIUS = { sharp: '0px', rounded: '8px', pill: '9999px' };
const SECTION_PY    = { compact: '3rem', comfortable: '5rem', spacious: '8rem' };
const SHADOW        = {
  none:   'none',
  subtle: '0 1px 3px rgba(0,0,0,0.10)',
  strong: '0 4px 16px rgba(0,0,0,0.20)',
};

export function applyBranding(branding: HotsiteBrandingResponse): React.CSSProperties {
  return {
    '--ba-primary':       branding.primaryColor,
    '--ba-secondary':     branding.secondaryColor,
    '--ba-background':    branding.backgroundColor,
    '--ba-text':          branding.textColor,
    '--ba-heading-font':  FONT_MAP[branding.headingFontFamily] ?? FONT_MAP['Inter'],
    '--ba-body-font':     FONT_MAP[branding.bodyFontFamily]    ?? FONT_MAP['Inter'],
    '--ba-radius':        BORDER_RADIUS[branding.borderRadius],
    '--ba-section-py':    SECTION_PY[branding.spacing],
    '--ba-shadow':        SHADOW[branding.shadowStyle],
    '--ba-btn-variant':   branding.buttonStyle,
  } as React.CSSProperties;
}
```

**Rule for all module components:** use only `var(--ba-*)` for colors, fonts, radius, spacing, and shadows. Never hardcode visual values.

**Acceptance criteria:**
- [ ] `GET /lavacar-beloauto` renders the hotsite with all 10 branding tokens applied as CSS variables on `<body>`
- [ ] All `--ba-*` variables are present with correct values
- [ ] `borderRadius: 'pill'` → `--ba-radius: 9999px`; `spacing: 'compact'` → `--ba-section-py: 3rem`
- [ ] Only modules with `enabled: true` are rendered — `enabled: false` modules are skipped silently
- [ ] `GET /nonexistent-slug` returns Next.js 404 page
- [ ] Second request within 5 minutes served from Next.js cache (no BFF call)
- [ ] `headingFontFamily: 'Playfair Display'` → `--ba-heading-font` resolves to the pre-loaded `next/font/google` CSS variable (not a runtime `<link>`)
- [ ] Unknown font key falls back to Inter — no crash
- [ ] `<body>` has both `style` (CSS var values) and `className` (font CSS variable names) applied correctly
- [ ] Secured `GET /api/revalidate?secret=&slug=` route implemented — `HOTSITE_REVALIDATE_SECRET` match → `revalidatePath`, mismatch/missing → `401`
- [ ] `next.config.mjs` `images.remotePatterns` hostname derived from `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` env var
- [ ] `HOTSITE_REVALIDATE_SECRET` and `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` present in `apps/web/.env.example` and `.env.local`
- [ ] Shared types migration complete: `packages/types/src/hotsite.ts` exists, `apps/bff/src/tenants/tenants.types.ts` deleted, BFF imports from `@beloauto/types`, `tsc --noEmit` passes in both `apps/bff` and `apps/web`
- [ ] TypeScript compiles with zero errors across the monorepo

**Dependencies:** M12-S01, M12-S10, M00-S05

---

### M12-S04 — HERO module component

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § HERO module

**Description:**  
Implement the HERO hotsite module. A full-width section with optional background image, headline, subtitle, and a call-to-action button. Supports two layout variants: `centered` (default) and `left-aligned`.

**Component:** `apps/web/components/hotsite/HeroModule.tsx`

```typescript
interface HeroModuleData {
  variant: 'centered' | 'left-aligned';  // default: 'centered'
  title: string;
  subtitle?: string;
  backgroundImageUrl?: string;           // GCS URL
  ctaLabel: string;
  ctaTarget: 'booking' | 'service-list';
}
```

- `variant: 'centered'` — title, subtitle, and button centered horizontally
- `variant: 'left-aligned'` — content left-aligned, image on the right (two-column on desktop, stacked on mobile)
- CTA scrolls to `#booking-form` (ctaTarget: 'booking') or `#service-list` (ctaTarget: 'service-list')
- If `backgroundImageUrl` is null: solid `var(--ba-primary)` background
- Button uses `var(--ba-btn-variant)` and `var(--ba-primary)` — never hardcoded colors
- Responsive: full-height on mobile, 60vh on desktop

**Component testing infrastructure (one-time setup — do first, benefits S04–S07):**

Module components (`components/hotsite/`) are synchronous prop-driven functions that return JSX with no Next.js runtime API calls. They are fully testable with `@testing-library/react` in jsdom. This story sets up the infrastructure so every subsequent module story (S05, S06, S07) can add its `*.spec.tsx` without further setup.

1. Install devDependencies in `apps/web`: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
2. Create `apps/web/__mocks__/next-image.ts` — renders `<img src alt ...rest>` (same global-alias pattern as `next-font-google.ts`; `next/image` has the same module-evaluation side-effect and must be globally swapped, not per-file mocked)
3. Update `apps/web/vitest.config.ts`:
   - Add `'next/image': path.resolve(__dirname, '__mocks__/next-image.ts')` to `resolve.alias`
   - Each component spec file declares `// @vitest-environment jsdom` at line 1 — `environmentMatchGlobs` is not available in Vitest v4's TypeScript types; per-file declaration is the correct mechanism. `lib/**` stays in `node` with no annotation.
4. Update `apps/web/vitest.setup.ts`: add `import '@testing-library/jest-dom'`
5. Update `sonar-project.properties` (or equivalent): remove `apps/web/components/**` from `sonar.coverage.exclusions` — module components now have Vitest tests and must contribute to coverage

**Component typing convention (established here for all module stories):**

`HeroModule` declares its own fully-typed props interface. The `ModuleComponent` registry type in `page.tsx` uses `data: Record<string, unknown>` for heterogeneity — the cast is isolated to the registration site only, never inside the component:

```ts
// HeroModule.tsx — fully typed, readable contract
interface HeroModuleProps {
  readonly data: HeroModuleData;
  readonly slug: string;
}

// page.tsx — single cast at the boundary
MODULE_MAP['HERO'] = HeroModule as ModuleComponent;
```

All subsequent module components (S05–S07) follow this same pattern.

**Acceptance criteria:**

*Component:*
- [ ] `variant: 'centered'` — title, optional subtitle, and CTA button rendered and horizontally centred
- [ ] `variant: 'left-aligned'` — content left-aligned; on desktop: two-column layout (content left, image right); on mobile: single-column stacked
- [ ] Both variants are responsive — stack to single column on `< sm` breakpoint
- [ ] CTA button uses `var(--ba-primary)` for colour — no hardcoded hex or Tailwind colour class
- [ ] CTA button style respects `var(--ba-btn-variant)` — `filled`, `outline`, `ghost` produce distinct visual styles without hardcoded values
- [ ] `backgroundImageUrl` absent → no `<img>` rendered; section background is solid `var(--ba-primary)`
- [ ] `backgroundImageUrl` present → rendered via `next/image` with `priority` prop set (LCP element — never `loading="lazy"`)
- [ ] `ctaTarget: 'booking'` → CTA `href="#booking-form"`
- [ ] `ctaTarget: 'service-list'` → CTA `href="#service-list"`
- [ ] `subtitle` present → subtitle text rendered; `subtitle` absent → no subtitle element in DOM
- [ ] Section height: full-height on mobile, `60vh` on desktop
- [ ] `HeroModule` registered as `MODULE_MAP['HERO']` in `apps/web/app/[slug]/page.tsx`; cast to `ModuleComponent` at the registration site only

*Infrastructure:*
- [ ] `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` present in `apps/web` devDependencies
- [ ] `apps/web/__mocks__/next-image.ts` created and wired into `vitest.config.ts` `resolve.alias`
- [ ] Each component spec file declares `// @vitest-environment jsdom` at line 1; existing `lib/**` tests continue to pass with `environment: 'node'` (no annotation needed)
- [ ] `vitest.setup.ts` imports `@testing-library/jest-dom`
- [ ] `sonar.coverage.exclusions` no longer includes `apps/web/components/**`

*`HeroModule.spec.tsx` (via `@testing-library/react` in jsdom):*
- [ ] `variant: 'centered'` — title text, CTA button with correct label rendered; centred layout class/structure applied
- [ ] `variant: 'left-aligned'` — title text rendered; left-aligned layout class/structure applied
- [ ] `ctaTarget: 'booking'` → CTA anchor `href` is `#booking-form`
- [ ] `ctaTarget: 'service-list'` → CTA anchor `href` is `#service-list`
- [ ] `backgroundImageUrl` absent → no `<img>` in DOM
- [ ] `backgroundImageUrl: 'https://example.com/hero.jpg'` → `<img>` rendered with `src` matching the URL
- [ ] `subtitle: 'Texto'` → subtitle text in DOM; no `subtitle` prop → subtitle element absent
- [ ] `tsc --noEmit` passes across monorepo after all changes

**Dependencies:** M12-S03

---

### M12-S05 — SERVICE_LIST module component

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § SERVICE_LIST module

**Description:**  
Implement the SERVICE_LIST hotsite module. Fetches active services from the BFF and renders them as cards with name, description, price, and duration.

**Component:** `apps/web/components/hotsite/ServiceListModule.tsx`

```typescript
interface ServiceListModuleData {
  title?: string;               // default "Nossos Serviços"
  showPrices: boolean;
  showPoints: boolean;          // loyalty points per service
  layout: 'grid' | 'list';     // default: 'grid'
}
```

- Fetches services server-side via `GET /v1/services` with `X-Tenant-Slug` header
- Price displayed as `R$ 150,00` (pt-BR format)
- Duration displayed as `"60 min"` or `"1h 30min"`
- `layout: 'grid'` → responsive grid (1 col mobile, 2 tablet, 3 desktop)
- `layout: 'list'` → single-column stacked cards
- Section anchor: `id="service-list"` (HERO CTA target)

**Acceptance criteria:**
- [ ] Services rendered from live API (not hardcoded)
- [ ] `showPrices: false` hides price badges
- [ ] `showPoints: false` hides loyalty point badges
- [ ] `layout: 'grid'` renders responsive grid; `layout: 'list'` renders single column
- [ ] Price format is `R$ 150,00` (comma decimal separator)
- [ ] Empty services → `"Nenhum serviço disponível no momento"`
- [ ] Section has `id="service-list"` anchor

**Dependencies:** M12-S03, M05-S05

---

### M12-S06 — GALLERY, TESTIMONIALS, ABOUT, CONTACT modules

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § module data contracts

**Description:**  
Implement the 4 remaining hotsite modules. All render data from the manifest `data` object. GALLERY is the most important — it displays admin-curated before/after images that come from two sources: completed booking after-photos and custom admin uploads.

**Components to create:**

**`GalleryModule.tsx`**
```typescript
interface GalleryImage {
  url: string;
  caption?: string;
  source: 'booking' | 'upload';
}

interface GalleryModuleData {
  title?: string;                    // default "Nossos Resultados"
  images: GalleryImage[];            // admin-curated ordered list
  layout: 'grid' | 'masonry';       // default: 'grid'
  maxVisible: number;                // default 6
}
```
- Renders up to `maxVisible` images; shows "Ver mais" button if `images.length > maxVisible`
- Lazy-loads images (`loading="lazy"`)
- If `images` is empty, renders nothing (entire section hidden)
- `layout: 'masonry'` uses CSS columns for a Pinterest-style layout

**`TestimonialsModule.tsx`**
```typescript
interface Testimonial {
  authorName: string;
  text: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  avatarUrl?: string;
}

interface TestimonialsModuleData {
  title?: string;                    // default "O que nossos clientes dizem"
  items: Testimonial[];
  layout: 'grid' | 'carousel';      // default: 'grid'
}
```
- Star rating rendered when `rating` is present
- `layout: 'carousel'` — horizontal scroll with navigation arrows

**`AboutModule.tsx`**
```typescript
interface AboutModuleData {
  title: string;                     // e.g. "Sobre nós" | "Conheça o Dr. Silva"
  body: string;                      // markdown — rendered as safe HTML
  imageUrl?: string;                 // GCS URL
  imagePosition: 'left' | 'right';  // default: 'right'
}
```
- `body` rendered as markdown (use `remark` or `marked`) — sanitised to prevent XSS
- Two-column layout on desktop (text + image); stacked on mobile

**`ContactModule.tsx`**
```typescript
interface ContactModuleData {
  title?: string;           // default "Fale conosco"
  showAddress: boolean;
  showPhone: boolean;
  showWhatsapp: boolean;
  showEmail: boolean;
  showMap: boolean;         // Google Maps embed using tenant settings address
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
  };
}
```
- Contact data (address, phone, email) pulled from tenant settings via manifest — not duplicated in module data
- WhatsApp link opens `https://wa.me/<number>` in a new tab
- `showMap: true` embeds a Google Maps iframe using the tenant's address

**Acceptance criteria:**
- [ ] All 4 components render correctly when their module type is present in `layout` with `enabled: true`
- [ ] `GalleryModule` with empty `images[]` renders nothing (section fully hidden)
- [ ] `GalleryModule` with 8 images and `maxVisible: 6` shows 6 images + "Ver mais" button
- [ ] `GalleryModule` renders images via `next/image` with breakpoint-matched `sizes`, `loading="lazy"` (below-the-fold)
- [ ] `GalleryModule` images with `photoType` present render a localized badge (`"Antes"` for `before`, `"Depois"` for `after`) — see `GalleryImage.photoType` (M12-S10)
- [ ] `AboutModule` with `imagePosition: 'left'` renders image on left, text on right on desktop
- [ ] `AboutModule` markdown body is sanitised (no raw `<script>` tags rendered)
- [ ] `ContactModule` `showMap: false` renders no iframe
- [ ] All text in example/default content is pt-BR

**Dependencies:** M12-S03

---

### M12-S07 — BOOKING_CTA module + booking form page

**Agent:** `frontend-ts`  
**Complexity:** L  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § BOOKING_CTA module, `docs/04-USE_CASES.md` § UC-001, UC-011

**Description:**  
Implement the BOOKING_CTA module and the full booking form page — the most interactive part of the hotsite. The form is a multi-step flow: (1) select services, (2) pick date/slot, (3) fill personal info, (4) submit. Calls UC-001 (guest booking) and UC-011 (availability).

**`BookingCtaModule.tsx`**
```typescript
interface BookingCtaModuleData {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  backgroundImageUrl?: string;   // GCS URL, optional
}
```
- CTA button links to `/<slug>/booking`
- Section anchor: `id="booking-form"`

**Booking form (`app/[slug]/booking/page.tsx`) — 4-step flow:**

**Step 1 — Service Selection:**
- Renders service cards with checkbox/toggle
- Shows running total: `"2 serviços — R$ 300,00 — 2h"`
- "Próximo" disabled until ≥1 service selected

**Step 2 — Date & Slot Picker:**
- Calendar date picker
- On date select → calls `GET /v1/schedule/availability?date=&serviceIds=` → available slots as buttons
- Loading state while fetching; `"Nenhum horário disponível"` if empty

**Step 3 — Personal Info:**
- Fields: name, email, phone, address (only if a selected service has `requiresPickupAddress: true`)
- All labels in pt-BR; client-side validation before submit

**Step 4 — Submit & Confirmation:**
- Calls `POST /v1/bookings` with contact data
- `201` → `"Solicitação enviada! Aguarde a confirmação por email."`
- `409` (slot taken) → back to Step 2 with `"Horário indisponível, escolha outro"`
- Other error → generic pt-BR message

**Acceptance criteria:**
- [ ] Full 4-step flow works end-to-end against local backend
- [ ] Slot picker shows real availability from the API (not mocked)
- [ ] `409` conflict returns to Step 2 with error message
- [ ] Address fields shown only when a selected service has `requiresPickupAddress: true`
- [ ] All labels, placeholders, error messages in pt-BR
- [ ] `BookingCtaModule` section has `id="booking-form"` anchor
- [ ] Component test: mock API responses and assert step transitions

**Dependencies:** M12-S03, M07-S04, M06-S04

---

### M12-S08 — Hotsite 404 and unpublished states

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md`

**Description:**  
Implement the hotsite edge cases: a 404 page for unknown slugs and a "coming soon" page for unpublished hotsites. These are BeloAuto-branded (no tenant manifest available).

**What to create:**
- `apps/web/app/[slug]/not-found.tsx` — BeloAuto-branded 404: `"Lavacar não encontrada"` + link to `beloauto.com`
- `apps/web/app/[slug]/unavailable.tsx` — `"Em breve"` page for unpublished hotsites (admin preview shown in M13)

**Acceptance criteria:**
- [ ] `GET /unknown-slug` renders the 404 page
- [ ] 404 page has human-readable pt-BR message
- [ ] `<title>Não encontrado — BeloAuto</title>`
- [ ] No JavaScript errors on 404 page

**Dependencies:** M12-S03

---

### M12-S09 — Hotsite SEO: meta tags, Open Graph, structured data

**Agent:** `frontend-ts`  
**Complexity:** S  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § manifest schema

**Description:**  
Implement per-tenant SEO metadata. Brazilian businesses depend on Google search and WhatsApp link previews. Without this, every tenant shows the same generic `<title>BeloAuto</title>` in search results.

**What to add to `apps/web/app/[slug]/layout.tsx`:**

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const manifest = await fetchManifest(params.slug);

  return {
    title: `${manifest.tenant.name} — Agendamento Online`,
    description: `Agende seu serviço na ${manifest.tenant.name}. Rápido, fácil e online.`,
    openGraph: {
      title: `${manifest.tenant.name} — Agendamento Online`,
      url: `https://beloauto.com/${params.slug}`,
      siteName: 'BeloAuto',
      images: manifest.branding.logoUrl
        ? [{ url: manifest.branding.logoUrl, width: 1200, height: 630 }]
        : [],
      locale: 'pt_BR',
      type: 'website',
    },
    robots: manifest.isPublished
      ? { index: true, follow: true }
      : { index: false, follow: false },
    alternates: { canonical: `https://beloauto.com/${params.slug}` },
  };
}
```

**Also add JSON-LD structured data** (`LocalBusiness` schema) in `page.tsx`:
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "[tenant.name]",
  "url": "https://beloauto.com/[slug]"
}
```

**Acceptance criteria:**
- [ ] `<title>` is `"[Tenant Name] — Agendamento Online"` — not generic `"BeloAuto"`
- [ ] `og:image` uses `manifest.branding.logoUrl` when available
- [ ] `og:locale` is `pt_BR`
- [ ] JSON-LD `<script type="application/ld+json">` present in `<head>`
- [ ] Unpublished hotsites have `<meta name="robots" content="noindex, nofollow">`
- [ ] `generateMetadata` reuses the ISR-cached manifest fetch — no extra network call
- [ ] `canonical` URL set to `https://beloauto.com/[slug]`
- [ ] `app/sitemap.ts` lists every **published** tenant slug with `lastmod` — needed for Google to discover hotsites that nobody has linked to yet
- [ ] `app/robots.ts` references the sitemap and disallows `/dashboard`, `/auth`

**Dependencies:** M12-S03

---

### M12-S10 — Hotsite public image storage: bucket separation + booking-photo featuring + publish revalidation ✅ Done

**Agent:** `backend-ts` + `bff-ts`  
**Complexity:** M  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § branding, § GALLERY, § manifest caching; `docs/14-API_CONTRACTS.md` § hotsite media

**Description:**  
Corrects a gap identified before M12-S03 starts consuming the manifest contract. M12-S01/S02 routed hotsite branding/layout images through the same "private bucket + freshly-regenerated read-signed URL at display time" pattern documented for booking attachments (`docs/14-API_CONTRACTS.md`). That pattern is correct for booking photos — they're genuinely private — but wrong for hotsite images, which are public marketing assets by definition. Worse, it actively conflicts with the manifest's caching strategy (`Cache-Control: public, max-age=300`, Next.js ISR, future CDN per `docs/15` §10): a cached manifest would embed signed URLs that can expire before the cache revalidates, serving broken images to visitors. (As of this story, `GetHotsiteManifestUseCase` doesn't yet resolve `filePath` → any URL at all — it returns the raw stored path — so this is a "settle the contract before the frontend builds on it" fix, not a behavioral regression.)

This story:
1. Gives hotsite images a separate **public** bucket with fixed, permanently-cacheable addresses (no signed-URL regeneration, no expiry) — booking photos keep the existing private/signed-read pattern untouched.
2. Implements the backend mechanism for `GalleryImage.source: 'booking'` (speced in `docs/15` §4 but never given an implementation path): admin selects a completed booking's before **or** after photo to feature, and the backend copies it into the public bucket at the moment of selection — not a live reference (which would reintroduce the same caching conflict and couple the gallery's lifecycle to the booking's).
3. Wires hotsite publish/unpublish to trigger on-demand Next.js revalidation, so changes go live immediately rather than waiting up to 5 minutes for ISR.

**Backend changes:**
- New public GCS bucket (e.g. `beloauto-hotsite-public-${var.environment}` / `GCS_PUBLIC_BUCKET_NAME`), `allUsers: roles/storage.objectViewer`, fronted by Cloud CDN per the existing scaling plan (`docs/22-TECH_STACK_DECISIONS.md`). New env var `GCS_PUBLIC_BASE_URL` (default `https://storage.googleapis.com`; local `.env` sets `http://localhost:4443` to match the `fake-gcs-server` `-external-url` in `docker/docker-compose.yml`) — see `getPublicUrl()` below
- `IStorageService` (shared port, `storage.service.port.ts`) gains:
  - `getPublicUrl(storagePath: string): string` — pure one-line template `${GCS_PUBLIC_BASE_URL}/${GCS_PUBLIC_BUCKET_NAME}/${storagePath}`; no GCS API round-trip, no expiry, **no environment branching**: the emulator's `-external-url` gives it the same `<base>/<bucket>/<path>` serving shape as real public GCS buckets, so only the configured base differs between dev and prod — exactly like `DB_HOST`/`FRONTEND_URL`/`GCS_BUCKET_NAME` already do
  - `copy(sourcePath: string, destinationPath: string): Promise<void>` — server-side object copy, private bucket → public bucket (`file.copy()`)
- `GenerateHotsiteImageSignedUrlUseCase` generates the upload signed URL **against the public bucket** — this is the single point where the image's destination is decided, since a signed URL is cryptographically bound to a specific bucket+path; everything downstream (storing `filePath`, resolving to a public URL) only needs the static fact "hotsite images live in the public bucket," not a per-request decision
- `GetHotsiteManifestUseCase` / `GetHotsiteContentUseCase` resolve every stored `filePath` (`branding.logoUrl`, module `backgroundImageUrl`/`imageUrl`/`avatarUrl`, `GalleryImage.url`) to a permanent public URL via `getPublicUrl()` before returning — both the public manifest and the admin endpoint use the same resolution, one code path regardless of `GalleryImage.source`
- New use case `FeatureBookingPhotoUseCase` + BFF endpoint `POST /v1/tenants/hotsite/gallery/feature-booking-photo` — `{ bookingId, photoUrl }`:
  - Loads the `Booking` by `(tenantId, bookingId)` via a new platform-side port `IBookingLookupPort` (`application/ports/booking-lookup.port.ts`), implemented by `BookingLookupAdapter` (`infrastructure/cross-context/`) — which injects a new `BookingQueryService` exported from `booking.module.ts`. This is the documented cross-context pattern (`docs/AGENT_PATTERNS.md` §8 — "`XxxQueryService` — export only when another context's adapter injects it"; canonical example `customer.module.ts` → `CustomerQueryService`/`CustomerInfoAdapter`), **not** the older direct-`DataSource` precedent in `ServiceCatalogAdapter`/`ServiceInfoAdapter`. The port returns a minimal summary `{ id, customerId, beforeServicePhotoUrls, afterServicePhotoUrls } | null` — works identically for guest-originated (`customerId: null`) and authenticated-customer bookings; `tenantId` is the only isolation boundary
  - Derives `photoType` **server-side** by checking whether `photoUrl` is present in `booking.beforeServicePhotoUrls` or `booking.afterServicePhotoUrls` — never trusts a client-supplied label. A `photoUrl` found in neither list → `400` (this doubles as the "does this photo actually belong to this booking" integrity check)
  - Copies the file to `tenants/<tenantId>/hotsite/gallery/<uuid>/<fileName>` in the public bucket via `IStorageService.copy()`
  - Returns `{ filePath, url, photoType }`
- `UpdateHotsiteContentUseCase`'s `exists()` check now validates every gallery image — `source: 'upload'` and `source: 'booking'` alike — against the public bucket uniformly (no branching by origin)
- `PublishHotsiteUseCase` / `UnpublishHotsiteUseCase` call a new internal port `IFrontendRevalidationPort` after persisting, hitting `${FRONTEND_URL}/api/revalidate?secret=${HOTSITE_REVALIDATE_SECRET}&slug=<tenant.slug>` for that tenant. New env var `HOTSITE_REVALIDATE_SECRET` (≥32 chars — same convention as `PLATFORM_ADMIN_KEY`/`INTERNAL_API_KEY`) is the shared secret verified by the route built in M12-S03 — **both stories must use this exact name**. The adapter **catches and logs** any failure (network error, 404, secret mismatch) — publish/unpublish always succeed regardless, both because ISR's 5-minute fallback already covers the gap and because M12-S10 ships *before* M12-S03's route exists (see `Blocks` below), so the call is expected to 404 until that story lands

**`GalleryImage` contract addition** (`packages/types/src/hotsite.ts`, `docs/15` §4 — JSONB `data` field, no migration required):
```typescript
interface GalleryImage {
  url: string;
  caption?: string;
  source: 'booking' | 'upload';
  bookingId?: string;                 // present when source === 'booking'
  photoType?: 'before' | 'after';     // present when source === 'booking' — derived server-side, lets the frontend label "Antes"/"Depois"
}
```

**Acceptance criteria:**
- [ ] `POST /v1/tenants/hotsite/images/signed-url` issues an upload URL targeting the public bucket; the resulting object resolves to a permanent public address (no expiry, no regeneration)
- [ ] `GET /v1/tenants/slug/:slug` (public manifest) returns `branding.logoUrl` / module `*Url` / `GalleryImage.url` as resolved public URLs — not raw `filePath` strings
- [ ] `GET /v1/tenants/hotsite` (admin) returns the same resolved public URLs — one resolution code path for both endpoints
- [ ] `POST /v1/tenants/hotsite/gallery/feature-booking-photo` copies the selected photo into the public bucket and returns `{ filePath, url, photoType }`; only `MANAGER` role — `STAFF` returns `403`
- [ ] `photoType` is correctly derived as `'before'` or `'after'` depending on which list (`beforeServicePhotoUrls` / `afterServicePhotoUrls`) the submitted `photoUrl` is found in
- [ ] A `photoUrl` not present in either list on the target booking → `400`
- [ ] Featuring works identically for a guest-originated booking (`customerId: null`) and an authenticated-customer booking — only `tenantId` gates access
- [ ] Tenant isolation: a `MANAGER` JWT scoped to Tenant A cannot feature a photo from Tenant B's booking — `404`/`400`, and Tenant B's data is unaffected
- [ ] A featured gallery image persists independently of the source booking — archiving/deleting the booking does not break the gallery entry
- [ ] `UpdateHotsiteContentUseCase` `exists()` validates all gallery images (both `source` values) against the public bucket uniformly
- [ ] Publishing or unpublishing a hotsite triggers revalidation of `/<slug>` — the change is visible immediately, without waiting for ISR's 5-minute window
- [ ] Booking-photo signed-URL flow (private bucket, regenerate-at-display, 15-minute expiry, `IStorageService.exists()` checks from M12-S02) is unchanged — this story touches hotsite-owned paths only

**Dependencies:** M12-S01, M12-S02, M115-S01  
**Blocks:** M12-S03 — changes the manifest's `*Url` field contract (resolved public URL vs. raw `filePath`); must land first

---

### M12-S11 — Hotsite branding: button color overrides

> **Implementation note:** folded into the current `feat/M12-S04-hero-module` branch (PR #98) — this story modifies `HeroModule.tsx`, which that branch introduces, so it ships as part of the same PR rather than a separate `feat/M12-S11-*` branch.

**Agent:** `backend-ts` + `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § Branding & Design Token System · `docs/14-API_CONTRACTS.md` § Tenant Hotsite Manifest / Hotsite Admin Management

**Description:**  
Add two optional hex tokens, `buttonBackgroundColor` and `buttonTextColor`, so a tenant's CTA button color can be set independently of `primaryColor`. Today every button color is derived from `primaryColor` + `buttonStyle` via `BTN_STYLES` in `apply-branding.ts`. When a section's background is also `var(--ba-primary)` (e.g. the `left-aligned` HERO variant, or `centered` without a background image), a `filled` button's fill and border become identical to the section behind it — the button is effectively invisible. These two fields are optional overrides: when unset, `applyBranding()` produces output identical to today (zero impact on existing tenants); when set, they take precedence. For `outline`/`ghost` styles — which have no permanent fill to recolor — `buttonBackgroundColor` instead drives a **hover-fill** effect via a new `--ba-btn-hover-bg` token.

**Field semantics:**
- `buttonBackgroundColor?: string` (hex):
  - `buttonStyle: 'filled'` — overrides `--ba-btn-bg` **and** `--ba-btn-border` (the button's permanent fill/border color)
  - `buttonStyle: 'outline' | 'ghost'` — sets the new `--ba-btn-hover-bg` token: the button's background fills with this color **on hover only**; the resting state stays `transparent` (unchanged)
  - Unset → `--ba-btn-hover-bg` defaults to `--ba-btn-bg` for `filled` (hover is a visual no-op, since the background doesn't change) and to `transparent` for `outline`/`ghost` (today's behavior — `hover:opacity-90` remains the only hover effect, byte-identical output)
- `buttonTextColor?: string` (hex) — overrides `--ba-btn-text` for all three styles, and additionally `--ba-btn-border` for `outline` (border mirrors text in the outline style, same as today's `var(--ba-primary)` derivation). Text color does **not** change on hover — same trust-the-palette assumption as `filled`'s white-on-`primaryColor` default; the admin picks a `buttonBackgroundColor` hover-fill that contrasts with their chosen `buttonTextColor`.

**New CSS token:** `--ba-btn-hover-bg`, consumed by `HeroModule.tsx`'s CTA via a Tailwind arbitrary-value hover class.

**Backend (`apps/backend/src/contexts/platform/`):**
- `HotsiteBranding` (`domain/hotsite-config.aggregate.ts`) — add `buttonBackgroundColor?: string; buttonTextColor?: string;`
- `validateBranding()` — if either field is present, validate via `HexColor.isValid` (same `PlatformDomainError` message pattern as the 4 existing hex fields: `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor`); absent values are not validated
- **Not** added to `DEFAULT_HOTSITE_BRANDING` — purely additive; existing tenant rows (jsonb without these keys) remain valid, no migration required
- `HotsiteBrandingSchema` (`application/dtos/update-hotsite-content.dto.ts`) — add both fields as `.optional()` hex-validated strings (schema is already `.partial()`)

**BFF (`apps/bff/src/tenants/hotsite-admin.controller.ts`):**
- `HotsiteBrandingBodySchema` is a separate `.partial()` Zod object (default "strip" mode) that re-validates the branding payload before forwarding it to the backend. Add `buttonBackgroundColor`/`buttonTextColor` as `z.string().regex(HEX_COLOR_REGEX)` here too — without this, `PATCH /v1/tenants/hotsite` silently drops both fields (Zod strips unrecognized keys by default), so the "persists and round-trips" AC would fail end-to-end despite backend/frontend tests passing.
- `hotsite-admin.controller.spec.ts` — add a `describe('UpdateHotsiteContentBodySchema', ...)` block asserting both fields round-trip through `.parse()` unstripped, and that invalid hex values fail `.safeParse()`.

**Shared types (`packages/types/src/hotsite.ts`):**
- `HotsiteBrandingResponse` — add `buttonBackgroundColor?: string; buttonTextColor?: string;`

**Frontend (`apps/web/lib/hotsite/apply-branding.ts`):**
- `--ba-btn-bg`, `--ba-btn-text`, `--ba-btn-border`, and the new `--ba-btn-hover-bg` derive from the override fields when present, falling back to the current `BTN_STYLES`-derived values / defaults otherwise (per the field semantics above)

**Frontend (`apps/web/components/hotsite/HeroModule.tsx`):**
- CTA `<a>` className gains `hover:bg-[var(--ba-btn-hover-bg)]` (Tailwind arbitrary value referencing the new token); `transition-opacity` becomes `transition-colors` (or is extended) so the hover background-color change animates smoothly
- `HeroModule.spec.tsx` — assert the CTA className includes `hover:bg-[var(--ba-btn-hover-bg)]`

**Docs:**
- Update `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` §2 — add the 2 new fields and `--ba-btn-hover-bg` to the `HotsiteBranding` token definition snippet and the `applyBranding()` CSS variable mapping snippet, with a one-line note on the filled-fill / outline-ghost-hover-fill semantics
- Update `docs/14-API_CONTRACTS.md` — add `buttonBackgroundColor`/`buttonTextColor` (both optional) to the canonical `branding` JSON example shared by the public manifest and `GET/PATCH /v1/tenants/hotsite`, with a one-line validation note

**Acceptance criteria:**
- [ ] `buttonBackgroundColor`/`buttonTextColor` both unset → `applyBranding()` output identical to current behavior for all 3 `buttonStyle` values, including `--ba-btn-hover-bg` (regression — existing `apply-branding.spec.ts` cases unchanged)
- [ ] `buttonStyle: 'filled'`, `buttonBackgroundColor: '#fbbf24'` → `--ba-btn-bg` = `--ba-btn-border` = `--ba-btn-hover-bg` = `#fbbf24`
- [ ] `buttonStyle: 'filled'`, `buttonTextColor: '#0f172a'` → `--ba-btn-text` = `#0f172a`
- [ ] `buttonStyle: 'outline'`, `buttonTextColor: '#0f172a'` → `--ba-btn-text` = `--ba-btn-border` = `#0f172a`
- [ ] `buttonStyle: 'outline'`, `buttonBackgroundColor: '#fbbf24'` → `--ba-btn-bg` remains `transparent`; `--ba-btn-hover-bg` = `#fbbf24`
- [ ] `buttonStyle: 'outline'`, `buttonBackgroundColor` unset → `--ba-btn-hover-bg` = `transparent` (current hover behavior preserved)
- [ ] `buttonStyle: 'ghost'`, `buttonTextColor: '#0f172a'` → `--ba-btn-text` = `#0f172a`; `--ba-btn-border` remains `transparent`
- [ ] `buttonStyle: 'ghost'`, `buttonBackgroundColor: '#fbbf24'` → `--ba-btn-hover-bg` = `#fbbf24`
- [ ] `PATCH /v1/tenants/hotsite` with `branding: { buttonBackgroundColor: "#fbbf24" }` persists and round-trips via `GET /v1/tenants/hotsite` and the public manifest
- [ ] `buttonBackgroundColor: "notacolor"` → `400` (invalid hex)
- [ ] Existing tenant rows (no `buttonBackgroundColor`/`buttonTextColor` in stored jsonb) — a PATCH that doesn't touch these fields continues to succeed (no `validateBranding()` regression for missing optional fields)
- [ ] `HeroModule.spec.tsx` — CTA `<a>` className includes `hover:bg-[var(--ba-btn-hover-bg)]`
- [ ] `tsc --noEmit` passes across the monorepo (`apps/backend`, `packages/types`, `apps/web`)

**Dependencies:** M12-S02, M12-S03, M12-S04
