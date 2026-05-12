# Hotsite Dynamic Architecture - BeloAuto

## Overview

BeloAuto provides each car wash (tenant) with a professional, high-conversion hotsite. To support unique visual identities and varied content needs (galleries, testimonials, simplified booking) while maintaining a single codebase, we use a **Server-Driven Hotsite Manifest** strategy.

---

## 1. The Hotsite Manifest Pattern

Instead of creating separate frontend projects or hardcoded pages for each tenant, the React frontend is a **Rendering Engine**. It fetches a "Manifest" from the BFF that describes *what* to show and *how* it should look.

### **The Manifest Schema (Conceptual)**
```json
{
  "tenant": {
    "name": "AutoWash Pro",
    "slug": "autowash-pro"
  },
  "branding": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#f8fafc",
    "fontFamily": "Inter, sans-serif",
    "logoUrl": "https://storage.../logo.png"
  },
  "layout": [
    { "type": "HERO", "data": { "title": "Premium Car Care", "image": "..." } },
    { "type": "SERVICE_LIST", "data": { "showPrices": true, "showPoints": true } },
    { "type": "GALLERY", "data": { "title": "Our Best Work", "limit": 6 } },
    { "type": "TESTIMONIALS", "data": { "items": [...] } },
    { "type": "BOOKING_FORM", "data": { "simplified": false } }
  ]
}
```

---

## 2. Visual Identity Implementation

To ensure professional results without custom CSS for every tenant, we use **CSS Custom Properties (Variables)**.

1. **Injection:** When the React app loads a tenant's hotsite, it injects the `branding` colors into the root element:
   ```javascript
   document.documentElement.style.setProperty('--primary-color', manifest.branding.primaryColor);
   ```
2. **Theming:** All modules (buttons, borders, icons) use `var(--primary-color)`. This ensures a cohesive "Visual Identity" across the entire site instantly.

---

## 3. Modular Frontend Architecture

The React app contains a library of **Core Modules**. Each module is a professional, responsive component:

| Module | Purpose | Content Source |
|--------|---------|----------------|
| **Hero** | First impression, CTA | Hotsite Manifest |
| **ServiceList**| Showcase services | Booking Context (Real-time) |
| **Gallery** | Before/after photos | Booking Context (Completed washes) |
| **Testimonials**| Social proof | Hotsite Manifest |
| **BookingForm**| The core action | Booking Context (Availability) |
| **Footer** | Contact, social links | Tenant Settings |

---

## 4. Next.js Routing & SSR Strategy

The hotsite lives inside the same `apps/web/` Next.js app as the dashboard, separated by route prefix.

**Route:** `app/[slug]/` (Next.js App Router dynamic segment)

```
https://beloauto.com/autowash-pro          → app/[slug]/page.tsx
https://beloauto.com/autowash-pro/booking  → app/[slug]/booking/page.tsx
https://beloauto.com/dashboard             → app/dashboard/ (requires auth)
```

**`app/[slug]/layout.tsx`** — fetches manifest and applies branding:

```typescript
// app/[slug]/layout.tsx
import { fetchManifest } from '@/lib/api/tenant';

export default async function HotsiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const manifest = await fetchManifest(params.slug); // cached — see §Manifest Caching below

  return (
    <html lang="pt-BR">
      <body
        style={{
          '--primary-color':    manifest.branding.primaryColor,
          '--secondary-color':  manifest.branding.secondaryColor,
          '--font-family':      manifest.branding.fontFamily,
        } as React.CSSProperties}
      >
        {children}
      </body>
    </html>
  );
}
```

**`app/[slug]/page.tsx`** — renders modules in order:

```typescript
// app/[slug]/page.tsx
import { HeroModule, ServiceListModule, GalleryModule, TestimonialsModule, BookingCtaModule } from '@/components/hotsite';

const MODULE_MAP = {
  HERO:         HeroModule,
  SERVICE_LIST: ServiceListModule,
  GALLERY:      GalleryModule,
  TESTIMONIALS: TestimonialsModule,
  BOOKING_CTA:  BookingCtaModule,
};

export default async function HotsitePage({ params }: { params: { slug: string } }) {
  const manifest = await fetchManifest(params.slug);

  return (
    <main>
      {manifest.layout.map((module) => {
        const Component = MODULE_MAP[module.type];
        return Component ? <Component key={module.type} data={module.data} slug={params.slug} /> : null;
      })}
    </main>
  );
}
```

---

## 5. Manifest Caching

The manifest is fetched server-side on every request but cached by Next.js's built-in data cache.

```typescript
// lib/api/tenant.ts
export async function fetchManifest(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BFF_URL}/tenants/slug/${slug}`,
    {
      headers: { 'X-Tenant-Slug': slug },
      next: { revalidate: 300 },  // ISR-style: revalidate every 5 minutes
    },
  );

  if (res.status === 404) notFound(); // Next.js renders 404 page
  if (!res.ok) throw new Error('Failed to fetch manifest');

  return res.json();
}
```

**Cache behaviour:**
- First request: fetches from BFF → cached in Next.js server memory for 300 seconds
- Subsequent requests within 5 minutes: served from cache (no BFF call)
- After 5 minutes: Next.js revalidates in the background, serving stale while fresh data loads
- When admin publishes hotsite changes (UC-027): takes up to 5 minutes to propagate — acceptable for MVP

**Why 5 minutes:** Short enough that admin changes feel near-instant; long enough to absorb traffic spikes without hammering the BFF on every page view.

---

## 6. Local Development Workflow

```bash
# Start all services
pnpm infra:up && pnpm dev
```

Visit `http://localhost:3000/<tenant-slug>` to see a tenant's hotsite. The slug is extracted from the URL by Next.js's `[slug]` dynamic route.

**Testing different tenants:**
1. Provision two tenants via the CLI (UC-024): `pnpm --filter backend tenant:create --slug autowash-pro ...`
2. Visit `http://localhost:3000/autowash-pro` and `http://localhost:3000/superclean` to see each hotsite
3. To test branding: update `hotsite_configs` directly in the local DB or use the dashboard at `http://localhost:3000/dashboard`

---

## 7. Deployment

**Runtime:** GCP Cloud Run — the same `beloauto-web` Cloud Run service that serves the dashboard also serves the hotsite. A single container handles all tenant slugs.

- `https://beloauto.com/autowash-pro` → Cloud Run `beloauto-web` → `app/[slug]/page.tsx`
- `https://beloauto.com/dashboard` → Cloud Run `beloauto-web` → `app/dashboard/layout.tsx`

The custom domain `beloauto.com` points to the `beloauto-web` Cloud Run service via Cloud Run domain mapping (see `docs/23-INFRASTRUCTURE_SETUP.md` — `domainmapping.tf`). TLS is handled automatically.

**Custom domains for tenants (future, post-MVP):**
Cloud Run domain mapping supports additional domains. To map `autowashpro.com.br` to the hotsite:
```bash
gcloud run domain-mappings create \
  --service beloauto-web \
  --domain autowashpro.com.br \
  --region us-central1 \
  --project beloauto-prod
```
The Next.js middleware reads the `Host` header and treats it as the slug lookup key. No code changes needed — just a domain mapping and a new manifest entry. This is a post-MVP feature.

**CI/CD:** Hotsite is part of the `apps/web/` package. Same pipeline as the dashboard — see `docs/09-CI_CD_PIPELINE.md` (`ci-frontend.yml` + `deploy-frontend.yml`). No separate pipeline needed.

---

## 6. Benefits for Non-Frontend Specialists

- **Consistency:** All hotsites follow professional design standards.
- **Maintenance:** A bug fix in the `BookingForm` module automatically repairs all 100+ tenant hotsites.
- **Speed:** New tenants go live instantly by just filling out a JSON form in the Admin Dashboard (no code, no build).
- **Flexibility:** Tenants can "drag and drop" modules (in the future Admin UI) to reorganize their site.

---

**Status:** Phase 2 - Technical Architecture  
**Validated:** Matches Multi-Tenancy Strategy & Business Context.
