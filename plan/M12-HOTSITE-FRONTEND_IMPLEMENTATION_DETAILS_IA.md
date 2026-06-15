# M12 — Hotsite Frontend: Implementation Details (AI Agent Reference)

> Token-efficient reference. No prose. Load only when working on M13+ tasks that touch the public hotsite (`apps/web/app/[slug]/**`), hotsite module components, the `HotsiteConfig` aggregate, branding/design tokens, or the booking form.

---

## Artifacts Table

### Backend — Platform context (`apps/backend/src/contexts/platform/`)

| Artifact | Path |
|---|---|
| `HotsiteConfig` aggregate | `domain/hotsite-config.aggregate.ts` |
| `Tenant` aggregate | `domain/tenant.aggregate.ts` |
| `TenantSettings` VO (incl. `BusinessInfo`, `BusinessInfoAddress`, `SocialLinks`) | `domain/value-objects/tenant-settings.vo.ts` |
| `HotsiteImagePathsService` | `domain/services/hotsite-image-paths.service.ts` |
| `HotsiteImageUrlResolverService` | `domain/services/hotsite-image-url-resolver.service.ts` |
| `PlatformDomainError` (incl. removed `HotsiteNotPublishedError`) | `domain/errors/platform-domain.error.ts` |
| `GetHotsiteManifestUseCase` | `application/use-cases/get-hotsite-manifest.use-case.ts` |
| `GetHotsiteContentUseCase` | `application/use-cases/get-hotsite-content.use-case.ts` |
| `UpdateHotsiteContentUseCase` | `application/use-cases/update-hotsite-content.use-case.ts` |
| `PublishHotsiteUseCase` / `UnpublishHotsiteUseCase` | `application/use-cases/{publish,unpublish}-hotsite.use-case.ts` |
| `GenerateHotsiteImageSignedUrlUseCase` | `application/use-cases/generate-hotsite-image-signed-url.use-case.ts` |
| `FeatureBookingPhotoUseCase` | `application/use-cases/feature-booking-photo.use-case.ts` |
| `ListPublishedHotsitesUseCase` | `application/use-cases/list-published-hotsites.use-case.ts` |
| `GetTenantBySlugUseCase` / `GetTenantByIdUseCase` | `application/use-cases/get-tenant-by-{slug,id}.use-case.ts` |
| `UpdateTenantSettingsUseCase` | `application/use-cases/update-tenant-settings.use-case.ts` |
| `IHotsiteConfigRepository` port | `application/ports/hotsite-config-repository.port.ts` |
| `ITenantRepository` port | `application/ports/tenant-repository.port.ts` |
| `IFrontendRevalidationPort` | `application/ports/frontend-revalidation.port.ts` |
| `IBookingLookupPort` (cross-context) | `application/ports/platform-booking.port.ts` |
| `FrontendRevalidationAdapter` | `infrastructure/adapters/frontend-revalidation.adapter.ts` |
| `BookingLookupAdapter` (cross-context, injects `BookingQueryService`) | `infrastructure/cross-context/platform-booking.adapter.ts` |
| `HotsiteController` (public manifest) | `infrastructure/controllers/hotsite.controller.ts` |
| `HotsiteAdminController` | `infrastructure/controllers/hotsite-admin.controller.ts` |
| `InternalTenantController` / `InternalTenantReadController` | `infrastructure/controllers/internal-tenant{,-read}.controller.ts` |
| `TenantSettingsController` | `infrastructure/controllers/tenant-settings.controller.ts` |
| `TypeormHotsiteConfigRepository` | `infrastructure/repositories/typeorm-hotsite-config.repository.ts` |
| `TypeormTenantRepository` | `infrastructure/repositories/typeorm-tenant.repository.ts` |

### BFF (`apps/bff/src/platform/`)

| Artifact | Path |
|---|---|
| `PlatformModule` | `platform.module.ts` |
| `HotsiteAdminController` (authenticated, role-guarded) | `hotsite-admin.controller.ts` |
| `PlatformPublicController` (`@Public()` — hotsite manifest, tenant, services, published-hotsites) | `platform.public.controller.ts` |

### Frontend (`apps/web/`)

| Artifact | Path |
|---|---|
| `[slug]/layout.tsx` — fetches manifest, calls `applyBranding()`, injects font variables | `app/[slug]/layout.tsx` |
| `[slug]/page.tsx` — module list renderer, `generateMetadata`, `<Unavailable />` branch, JSON-LD | `app/[slug]/page.tsx` |
| `[slug]/booking/page.tsx` — fetches services, renders `BookingForm` | `app/[slug]/booking/page.tsx` |
| Root 404 | `app/not-found.tsx` |
| `app/sitemap.ts` / `app/robots.ts` | `app/sitemap.ts`, `app/robots.ts` |
| On-demand ISR revalidation route | `app/api/revalidate/route.ts` |
| `HeroModule`, `ServiceListModule`, `GalleryModule`+`GalleryGrid`+`GalleryItem`, `TestimonialsModule`+`TestimonialsCarousel`+`TestimonialCard`, `AboutModule`, `ContactModule`, `BookingCtaModule`, `Unavailable`, `Footer` | `components/hotsite/*.tsx` (each with `*.spec.tsx`) |
| `BookingForm`, `ServiceSelectionStep`, `AvailabilityCarousel`, `SlotPicker`, `PersonalInfoStep`, `AddressFields`, `PhotoUpload`, `ConfirmationStep` | `components/booking/*.tsx` (each with `*.spec.tsx`) |
| `applyBranding()`, `BTN_STYLES`/`deriveButtonTokens`, `deriveHeroTextColor` | `lib/hotsite/apply-branding.ts` |
| `FONT_MAP` / `FONT_VARIABLES` (8-font allow-list) | `lib/hotsite/font-config.ts` |
| `MODULE_MAP`, `MODULE_DATA_SCHEMAS`, `isValidModuleData()` | `lib/hotsite/module-schemas.ts`, module-list renderer in `[slug]/page.tsx` |
| `HOTSITE_REVALIDATE_SECONDS = 300` | `lib/hotsite/revalidate.ts` |
| `buildHotsiteMetadata`, `buildLocalBusinessJsonLd`, `toJsonLdScript`, `SITE_URL` | `lib/hotsite/seo.ts` |
| `format-money.ts`, `format-duration.ts`, `module-styles.ts` | `lib/hotsite/*.ts` |
| `date-range.ts`, `format-time.ts`, `personal-info.ts` (booking helpers) | `lib/booking/*.ts` |
| `AddressLookup` port, `viaCepAddressLookup` adapter, `InMemoryAddressLookup` test double | `lib/address/*.ts` |
| `fetchManifest`/`fetchServices`/`fetchAvailability*`/`createBooking`/`createAttachmentSignedUrl`/`fetchPublishedHotsiteSlugs` | `lib/api/{platform,services,schedule,bookings}.ts` |

### `@beloauto/types` (`packages/types/src/`)

| Artifact | Path | Notes |
|---|---|---|
| `HotsiteManifestResponse`, `Hotsite*ModuleData`, `HotsiteBrandingResponse`, `GalleryImage`, `HotsiteBusinessInfoResponse`, `HotsiteSitemapEntryListResponse` | `hotsite.ts` | Single source of truth for module data shapes |
| `CreateBookingRequest`, `BookingResponse`, `BookingLineResponse`, `AttachmentSignedUrlRequest/Response` | `booking.dto.ts` | Fully replaced in M12-S07 — old dashboard-side shapes dropped |
| `AvailableSlot`, `AvailabilityResponse`, `DaySummary`, `AvailabilitySummaryResponse` | `schedule.dto.ts` | Fully replaced in M12-S07 |
| `MoneyAmount` | `money.ts` | Added in M12-S07 |
| `HotsiteServiceResponse`, `HotsiteServiceListResponse` | `service.dto.ts` | Promoted from BFF-local types in M12-S05 |

---

## Migrations (in order)

| Timestamp | File | What |
|---|---|---|
| `1716500000002` | `CreatePlatformHotsiteConfigs` | `platform.hotsite_configs` — `tenant_id`, `branding jsonb`, `layout jsonb`, `is_published boolean` |
| `1748400000001` | `AddSeoToHotsiteConfigs` | Adds `seo jsonb NOT NULL DEFAULT '{"title": null, "description": null}'::jsonb` |

---

## Module System: `MODULE_MAP` + Validation Gate

`HotsiteModuleType = 'HERO' | 'SERVICE_LIST' | 'GALLERY' | 'TESTIMONIALS' | 'BOOKING_CTA' | 'ABOUT' | 'CONTACT'`

- `MODULE_DATA_SCHEMAS: Partial<Record<HotsiteModuleType, z.ZodType>>` in `lib/hotsite/module-schemas.ts` — one Zod schema per module type, each declared `satisfies z.ZodType<XxxModuleData>`.
- `isValidModuleData(type, data)` — `[slug]/page.tsx` calls this per layout entry; invalid/missing schema → module silently skipped (rest of page renders).
- **New module type checklist:** add `XxxModuleData` to `packages/types/src/hotsite.ts` → add `XxxModuleDataSchema` to `MODULE_DATA_SCHEMAS` → add component to `MODULE_MAP` → write `*.spec.tsx`.
- Component cast pattern: `MODULE_MAP: Record<HotsiteModuleType, ModuleComponent>` where `ModuleComponent = (props: { data: unknown; business: HotsiteBusinessInfoResponse }) => JSX.Element` — each module component casts `data` to its own type internally after the Zod gate has already validated it.

---

## Branding / CSS Variable System (`lib/hotsite/apply-branding.ts`)

`applyBranding(branding: HotsiteBrandingResponse): React.CSSProperties & Record<\`--ba-${string}\`, string>` — applied via inline `style` on `[slug]/layout.tsx`'s root element; all module components consume `var(--ba-*)`.

| Token | Source |
|---|---|
| `--ba-primary` / `--ba-secondary` / `--ba-background` / `--ba-text` | `branding.{primary,secondary,background,text}Color` directly |
| `--ba-heading-font` / `--ba-body-font` | `FONT_MAP[branding.{heading,body}FontFamily]`, fallback `FONT_MAP['Inter']` |
| `--ba-radius` | `BORDER_RADIUS[branding.borderRadius]` — `sharp:0px / rounded:8px / pill:9999px` |
| `--ba-section-py` | `SECTION_PY[branding.spacing]` — `compact:3rem / comfortable:5rem / spacious:8rem` |
| `--ba-shadow` | `SHADOW[branding.shadowStyle]` — `none / subtle / strong` |
| `--ba-btn-variant` | `branding.buttonStyle` (`filled\|outline\|ghost`) |
| `--ba-btn-bg` / `--ba-btn-text` / `--ba-btn-border` / `--ba-btn-hover-bg` | `deriveButtonTokens()` — see below |
| `--ba-hero-text` | `deriveHeroTextColor()` — WCAG contrast pick between `backgroundColor`/`textColor` against `primaryColor` |

**`deriveButtonTokens()` (M12-S11 additions — `buttonBackgroundColor?`, `buttonTextColor?`, both optional hex, unset = byte-identical to pre-S11 output):**

| `buttonStyle` | `buttonBackgroundColor` set | `buttonTextColor` set |
|---|---|---|
| `filled` | overrides `--ba-btn-bg` **and** `--ba-btn-border` (permanent fill) | overrides `--ba-btn-text` |
| `outline` | sets `--ba-btn-hover-bg` only (resting `bg` stays `transparent`) | overrides `--ba-btn-text` **and** `--ba-btn-border` |
| `ghost` | sets `--ba-btn-hover-bg` only | overrides `--ba-btn-text` (`--ba-btn-border` stays `transparent`) |

Unset → `--ba-btn-hover-bg` defaults to `--ba-btn-bg` for `filled` (no-op hover) and `transparent` for `outline`/`ghost` (today's `hover:opacity-90` behavior).

`HotsiteBranding` is **not** added to `DEFAULT_HOTSITE_BRANDING` for the two new optional fields — purely additive, no migration.

---

## Font System (`lib/hotsite/font-config.ts`)

8-font allow-list loaded at build time via `next/font/google`: `Inter, Poppins, Playfair Display, Montserrat, Raleway, Oswald, Lato, Roboto`. `FONT_VARIABLES` (CSS variable class names) applied on `<html>` in root `layout.tsx`; `FONT_MAP` (display names → `var(--font-*)`) consumed by `applyBranding()`. Admin picks by display name string; invalid/unrecognized name falls back to `Inter`.

---

## ISR / Caching / On-Demand Revalidation

- `fetchManifest(slug)` and other server-fetched data use `next: { revalidate: HOTSITE_REVALIDATE_SECONDS }` (`= 300`, `lib/hotsite/revalidate.ts`).
- `export const revalidate = 300` in `[slug]/layout.tsx` / `page.tsx` / `booking/page.tsx` — **must be a literal**, not a reference to the constant (Next.js 16 build-time constraint); the constant still documents/centralizes the value for the `fetch()` calls.
- `app/api/revalidate/route.ts` (`GET`) — header `x-revalidate-secret` must equal `HOTSITE_REVALIDATE_SECRET`; `?slug=` required; calls `revalidatePath('/${slug}', 'page')`.
- `IFrontendRevalidationPort` → `FrontendRevalidationAdapter` — called by `PublishHotsiteUseCase`/`UnpublishHotsiteUseCase` after persisting. Builds `${FRONTEND_URL}/api/revalidate?slug=<slug>` with the secret header, 5s timeout via `AbortSignal.timeout`. **Catches and logs all failures** (network error, non-2xx) — publish/unpublish always succeed regardless.
- Client-side fetchers (`schedule.ts`, `bookings.ts`) — **no** `next: { revalidate }` (availability/booking data must always be fresh).

---

## Storage: Public vs Private Buckets (M12-S10)

| | Hotsite images (branding logo, module backgrounds/avatars, gallery) | Booking attachment photos |
|---|---|---|
| Bucket | Public (`GCS_PUBLIC_BUCKET_NAME`, `allUsers: roles/storage.objectViewer`) | Private |
| URL | Permanent — `getPublicUrl(path) = \`${GCS_PUBLIC_BASE_URL}/${GCS_PUBLIC_BUCKET_NAME}/${path}\`` | Signed, regenerated at display time, ~15 min expiry |
| Resolution | `GetHotsiteManifestUseCase`/`GetHotsiteContentUseCase` resolve every `filePath` (`branding.logoUrl`, module `*Url`, `GalleryImage.url`) → public URL before returning — one code path for public manifest and admin endpoint | Unchanged from M12-S02 |

- `IStorageService` (shared port) gains `getPublicUrl(storagePath)` (pure template, no API call) and `copy(sourcePath, destinationPath)` (server-side `file.copy()`, private → public bucket).
- `GenerateHotsiteImageSignedUrlUseCase` issues upload URLs **against the public bucket** — the single point deciding "hotsite images live in the public bucket."
- `FeatureBookingPhotoUseCase` (`POST /v1/tenants/hotsite/gallery/feature-booking-photo`, `MANAGER` only) — loads booking via `IBookingLookupPort` (`{ id, customerId, beforeServicePhotoUrls, afterServicePhotoUrls } | null`), derives `photoType` **server-side** by checking which list contains `photoUrl` (not in either → `400`), copies to `tenants/<tenantId>/hotsite/gallery/<uuid>/<fileName>` in the public bucket, returns `{ filePath, url, photoType }`.
- `GalleryImage` gains `source: 'booking' | 'upload'`, `bookingId?`, `photoType?: 'before' | 'after'` (JSONB `data` field — no migration). `UpdateHotsiteContentUseCase.exists()` validates all gallery images against the public bucket uniformly regardless of `source`.

---

## Booking Form Architecture (M12-S07)

`app/[slug]/booking/page.tsx` (server, `fetchServices(slug)`) → `BookingForm` (`'use client'`, owns all state):

```typescript
type Step = 1 | 2 | 3 | 4;
// state: step, selectedServiceIds[], selectedDate, selectedSlot, personalInfo, status, errorMessage, step2Error
```

| Step | Component | Behavior |
|---|---|---|
| 1 | `ServiceSelectionStep` | Checkbox cards, running total; computes `requiresPickupAddress` from selected services |
| 2 | `AvailabilityCarousel` (phase 1) → `SlotPicker` (phase 2) | `fetchAvailabilitySummary(slug, today, today+13d, serviceIds)` → 14-day carousel; selecting a day → `fetchAvailability(slug, date, serviceIds)` → time-slot buttons |
| 3 | `PersonalInfoStep` (composes `AddressFields` ×2, `PhotoUpload`) | `contactAddress` optional/collapsible; `pickupAddress` required only if `requiresPickupAddress` |
| 4 | `ConfirmationStep` | `createBooking()`; `409` → `CreateBookingError` → back to step 2 with `step2Error = 'Horário indisponível, escolha outro'` |

**Address lookup adapter** (`lib/address/`):
```typescript
interface AddressLookup { lookup(cep: string): Promise<AddressLookupResult | null>; }
export const viaCepAddressLookup: AddressLookup = { /* GET viacep.com.br, null on error/erro/not-8-digits */ };
```
`AddressFields` takes `addressLookup: AddressLookup = viaCepAddressLookup` — tests inject `InMemoryAddressLookup`. CEP 8 digits → autofill street/neighborhood/city/state (editable); `number`/`complement` always manual; lookup failure leaves fields editable, no blocking error.

**Photo upload** (`PhotoUpload`, optional): per file — (1) `createAttachmentSignedUrl(slug, file.name, file.type)` → `{signedUrl, filePath}`, (2) `PUT` to `signedUrl`, (3) collect `filePath` into `beforeServicePhotoUrls`.

---

## SEO (M12-S09)

- `SITE_URL = stripTrailingSlashes(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')` (`lib/hotsite/seo.ts`) — single source for all absolute URLs.
- `buildHotsiteMetadata({ manifest, slug, path? })` — title/description default to `"<Tenant> — Agendamento Online [em <City>, <State>]"` (location appended only if `manifest.business.address` present), **overridden by `manifest.seo.title`/`manifest.seo.description`** when set (tenant-configurable, M12-S09 `seo jsonb` column); `openGraph.locale` from `manifest.localization.language.replaceAll('-', '_')`; `og:image` from `branding.logoUrl` when present; `robots` = `index/follow` iff `isPublished`; `alternates.canonical = ${SITE_URL}/${slug}${path}`.
- `[slug]/page.tsx` `generateMetadata` → `buildHotsiteMetadata({ manifest, slug })`; also renders `<script type="application/ld+json">${toJsonLdScript(buildLocalBusinessJsonLd({manifest, slug}))}</script>` (home page only).
- `[slug]/booking/page.tsx` `generateMetadata` → `buildHotsiteMetadata({ manifest, slug, path: '/booking' })` with `robots: {index:false, follow:false}` **always**, and `title` overridden to `'Agendar serviço'` / `'Em breve — BeloAuto'`.
- `toJsonLdScript(data)` — `JSON.stringify(data).replaceAll('<', '\\u003c')` — prevents `</script>` breakout.
- `ListPublishedHotsitesUseCase` (`GET /internal/tenants/published-hotsites`, `InternalApiGuard`) — `platform.tenants ⋈ platform.hotsite_configs` where `tenants.is_active = true AND hotsite_configs.is_published = true` → `{ items: [{ slug, updatedAt }] }`. BFF: `GET /platform/published-hotsites` (`@Public()`) → `HotsiteSitemapEntryListResponse`. Frontend: `fetchPublishedHotsiteSlugs()` (`lib/api/platform.ts`) → `app/sitemap.ts` maps to `{ url: \`${SITE_URL}/${slug}\`, lastModified: updatedAt }`.
- `app/robots.ts` — `allow: '/'`, `disallow: ['/dashboard', '/auth']`, `sitemap: ${SITE_URL}/sitemap.xml`.

---

## 404 vs "Unpublished" (M12-S08)

| Case | Trigger | Result |
|---|---|---|
| Unknown slug | `TenantNotFoundError`/`HotsiteNotFoundError` | `fetchManifest()` → `notFound()` in `[slug]/layout.tsx` → **root** `app/not-found.tsx` (`"Lavacar não encontrada"`, `<title>Não encontrado — BeloAuto</title>`) |
| `isPublished: false` | `GetHotsiteManifestUseCase` early-return stub: `{ branding: config.branding, layout: [], isPublished: false, business: <all-null> }` (skips image resolution + tenant/business lookup) | `200`; `[slug]/page.tsx` renders `<Unavailable />` ("Em breve") instead of module list; `<title>Em breve — BeloAuto</title>` |

`app/not-found.tsx` **must be root-level** — `[slug]/not-found.tsx` cannot catch a `notFound()` thrown by `[slug]/layout.tsx` itself (only an ancestor segment's `not-found.tsx` can). `HotsiteNotPublishedError` and its mapper branch were **removed** — unpublished is a `200` + stub, not a `404`.

---

## Environment Variables Added in M12

| Var | Where | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` | `apps/web` | `http://localhost:4443/beloauto-local-public` | S03 |
| `HOTSITE_REVALIDATE_SECRET` | `apps/web` + `apps/backend` | — (≥32 chars) | S03 (route) + S10 (caller); same value both sides |
| `NEXT_PUBLIC_SITE_URL` | `apps/web` | `http://localhost:3000` | S09 — all absolute URLs derive from this |
| `GCS_PUBLIC_BUCKET_NAME` | `apps/backend` | `beloauto-local-public` | S10 |
| `GCS_PUBLIC_BASE_URL` | `apps/backend` | `https://storage.googleapis.com` (`http://localhost:4443` local) | S10 — `getPublicUrl()` template base |

---

## Test Infrastructure

- **Vitest + jsdom + `@testing-library/react`** for `components/hotsite/**` and `components/booking/**` — each spec starts with `// @vitest-environment jsdom`. `lib/**` stays `node` (no annotation).
- **Global aliases** (`vitest.config.ts` → `resolve.alias`): `next/font/google` → `__mocks__/next-font-google.ts`, `next/image` → `__mocks__/next-image.ts` (module-eval side effects, can't `vi.mock()` per-file).
- **`InMemoryAddressLookup`** (`lib/address/in-memory-address-lookup.ts`) — `Record<cep, AddressLookupResult | null>` test double, injected into `AddressFields`.
- `BookingForm`/step components mock `fetch` via `vi.spyOn(globalThis, 'fetch')`.
- Playwright E2E for the full booking happy-path is **deferred to M16-S06** — not part of M12.

---

## Gotchas

1. **`app/not-found.tsx` must be root-level**, not `app/[slug]/not-found.tsx` — a segment's own `layout.tsx` calling `notFound()` cannot be caught by that same segment's `not-found.tsx`; only an ancestor's.
2. **Unpublished hotsites are `200` + stub, not `404`** — `HotsiteNotPublishedError` was removed in M12-S08. Don't reintroduce it; check `manifest.isPublished` in the page component instead.
3. **`export const revalidate` must be a literal** (`= 300`), not `HOTSITE_REVALIDATE_SECONDS` — Next.js 16 rejects non-literal values for this export. The constant in `lib/hotsite/revalidate.ts` is for `fetch()`'s `next: { revalidate }` option only.
4. **`buttonBackgroundColor`/`buttonTextColor` must be added to BOTH** the backend `HotsiteBrandingSchema` (`update-hotsite-content.dto.ts`) **and** the BFF's separate `HotsiteBrandingBodySchema` (`hotsite-admin.controller.ts`) — the BFF schema is `.partial()` with default Zod "strip" mode; omitting a field there silently drops it from `PATCH /v1/tenants/hotsite` even though backend and frontend tests pass independently.
5. **`GalleryImage.photoType` is derived server-side**, never trust a client-supplied label — `FeatureBookingPhotoUseCase` checks which of `beforeServicePhotoUrls`/`afterServicePhotoUrls` contains `photoUrl`; absent from both → `400`.
6. **Hotsite images are permanent public URLs** (`getPublicUrl()`, no expiry) — booking attachment photos remain on the private bucket with signed, regenerated, ~15-min-expiry URLs. Don't conflate the two paths.
7. **`FrontendRevalidationAdapter` always swallows errors** — publish/unpublish must succeed even if `/api/revalidate` 404s or times out (5s `AbortSignal.timeout`). ISR's 5-minute fallback is the safety net.
8. **JSON-LD must go through `toJsonLdScript()`** — raw `JSON.stringify` allows a `</script>` sequence inside string data to break out of the `<script type="application/ld+json">` tag (XSS). The helper escapes `<` → `<`.
9. **`SITE_URL` is the only source for absolute URLs** — never hardcode `https://beloauto.com` in canonical/OG/JSON-LD/sitemap code; `stripTrailingSlashes()` guards against a trailing-`/` env value producing `//slug`.
10. **`booking.dto.ts`/`schedule.dto.ts` were fully replaced in M12-S07** — `CompleteBookingRequest`/`RescheduleBookingRequest`/`RequestMoreInfoRequest`/`SubmitInfoRequest` were dropped as unused; they'll be re-added (mirroring the BFF's actual shapes) when the dashboard booking-management story is built (M13+).
11. **`eslint-plugin-react-hooks`/`eslint-plugin-jsx-a11y` are scoped to `apps/web/eslint.config.js`** only (M12-S12) — `packages/config/eslint-base.js` is shared with backend/BFF, which have no JSX/hooks.
12. **Client-side booking fetchers never use `next: { revalidate }`** — `schedule.ts`/`bookings.ts` must return live data; only server-rendered manifest/service fetches are ISR-cached.
