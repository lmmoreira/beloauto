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

### M12-S03 — Next.js [slug] routing + manifest fetching + CSS branding

**Agent:** `frontend-ts`  
**Complexity:** M  
**Docs to load:** `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` § routing + manifest caching + CSS variables

**Description:**  
Implement the Next.js App Router foundation for the hotsite: the `[slug]/layout.tsx` fetches the manifest (with ISR 5-minute revalidation), applies the full branding token set via CSS custom properties using `applyBranding()`, and provides the manifest to all child pages via React context.

**What to create/update in `apps/web/app/[slug]/`:**
- `layout.tsx`:
  - Server component — fetches `GET /v1/tenants/slug/[slug]` at render time
  - `next/cache` `revalidate: 300` (5-minute ISR)
  - `notFound()` if manifest returns 404
  - Calls `applyBranding(manifest.branding)` and injects all CSS variables via `style` prop on `<body>`
  - Passes manifest to `ManifestProvider` context
- `page.tsx`:
  - Reads manifest from context
  - Filters `layout[]` to `enabled: true` only, then maps each type to its React component
  - Renders `<Footer />` after all modules
- `ManifestContext.tsx` — React context providing manifest to all hotsite components

**`applyBranding()` helper** (`apps/web/lib/hotsite/apply-branding.ts`):

```typescript
const BORDER_RADIUS = { sharp: '0px', rounded: '8px', pill: '9999px' };
const SECTION_PY    = { compact: '3rem', comfortable: '5rem', spacious: '8rem' };
const SHADOW        = {
  none:   'none',
  subtle: '0 1px 3px rgba(0,0,0,0.10)',
  strong: '0 4px 16px rgba(0,0,0,0.20)',
};

export function applyBranding(branding: HotsiteBranding): React.CSSProperties {
  return {
    '--ba-primary':       branding.primaryColor,
    '--ba-secondary':     branding.secondaryColor,
    '--ba-background':    branding.backgroundColor,
    '--ba-text':          branding.textColor,
    '--ba-heading-font':  branding.headingFontFamily,
    '--ba-body-font':     branding.bodyFontFamily,
    '--ba-radius':        BORDER_RADIUS[branding.borderRadius],
    '--ba-section-py':    SECTION_PY[branding.spacing],
    '--ba-shadow':        SHADOW[branding.shadowStyle],
    '--ba-btn-variant':   branding.buttonStyle,
  } as React.CSSProperties;
}
```

**Rule for all module components:** use only `var(--ba-*)` for colors, fonts, radius, spacing, and shadows. Never hardcode visual values.

**Acceptance criteria:**
- [ ] `GET /lavacar-beloauto` renders the hotsite with all 10 branding tokens applied as CSS variables
- [ ] All `--ba-*` variables are present on `<body>` with correct values
- [ ] `borderRadius: 'pill'` → `--ba-radius: 9999px`; `spacing: 'compact'` → `--ba-section-py: 3rem`
- [ ] Only modules with `enabled: true` are rendered — `enabled: false` modules are skipped silently
- [ ] `GET /nonexistent-slug` returns Next.js 404 page
- [ ] Second request within 5 minutes served from Next.js cache (no BFF call)
- [ ] TypeScript compiles with zero errors

**Dependencies:** M12-S01, M00-S05

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

**Acceptance criteria:**
- [ ] `variant: 'centered'` renders title and CTA centered
- [ ] `variant: 'left-aligned'` renders content left-aligned with image right on desktop
- [ ] Both variants are mobile-responsive (stack to single column on `< sm`)
- [ ] Primary color button uses `var(--ba-primary)` (not hardcoded)
- [ ] If `backgroundImageUrl` is null, renders with solid `var(--ba-primary)` background
- [ ] CTA scrolls to `#booking-form` or `#service-list` depending on `ctaTarget`
- [ ] Vitest component test: renders both variants, title, subtitle, and CTA button correctly

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
- [ ] `GalleryModule` lazy-loads images
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

**Dependencies:** M12-S03
