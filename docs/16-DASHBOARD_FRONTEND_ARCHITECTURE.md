# Dashboard Frontend Architecture (Backoffice) - BeloAuto

## Overview

The Dashboard is the authenticated area of BeloAuto where **Customers** manage their bookings/loyalty and **Staff** manage the business operations. It is a single React application that dynamically adapts its layout and capabilities based on the user's **Role** and **Tenant Context**.

---

## 1. Role-Based Rendering (RBR)

The application uses a "Shell" pattern. Once a user authenticates via Google OAuth, the `AppShell` determines which "Mode" to load:

### **Customer Mode (UC-006, UC-007, UC-016, UC-023)**
- **Focus:** Personal history and loyalty.
- **Key Modules:**
  - `BookingTimeline`: Unified view of upcoming and past washes.
  - `LoyaltyCard`: Per-service point progress.
  - `TenantSwitcher`: Interface to jump between different car wash companies.

### **Staff Mode (UC-003, UC-004, UC-005, UC-008, UC-009, UC-010, UC-012, UC-013)**
- **Focus:** Efficiency and task management.
- **Key Modules:**
  - `CommandCenter`: Real-time queue of pending bookings.
  - `ServiceEditor`: CRUD interface for tenant services.
  - `ScheduleCalendar`: Drag-and-drop availability management.

---

## 2. Shared Component Library — shadcn/ui

We use **shadcn/ui** as the component foundation. Components are copied into the repository (no runtime dependency), built on Radix UI primitives (accessible by default) and styled with Tailwind CSS.

- **Why shadcn/ui:** Components are owned by the project — no vendor lock-in, full customisation control, Radix UI accessibility primitives, Tailwind theming aligns with the CSS variable branding strategy from doc 15.
- **Atomic Components:** Buttons, Inputs, Dialogs, Toasts, Dropdowns, Cards — themed via CSS variables (`--primary`, `--secondary`, etc.).
- **Business Modules:** `BookingForm` and `ServiceCard` are shared between the Hotsite (public) and Dashboard (staff editing).
- **Quality Rule:** Every UI component must be accessible (WCAG 2.1 AA) and responsive.

---

## 3. Engineering Standards & Quality Gates

Since we are following **Trunk-Based Development**, the frontend must have a "Bulletproof" CI pipeline:

### **Static Analysis**
- **TypeScript:** Strict mode enabled. No `any`.
- **Linting:** ESLint with `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`.
- **Formatting:** Prettier (mandatory pre-commit hook).

### **The Testing Pyramid (Frontend)**
1. **Unit Tests (Vitest):** Logic testing for hooks, utilities, and state reducers.
2. **Component Tests (React Testing Library):** Testing user interactions (e.g., "Clicking 'Cancel' opens confirmation modal").
3. **E2E Tests (Playwright):** Critical paths only (e.g., "Staff logs in and approves a booking").
4. **Visual Regression (Optional):** Ensure branding changes don't break layouts.

---

## 4. Frontend-BFF Communication

- **State Management:** **TanStack Query (React Query)**.
  - Handles caching, background syncing, and loading states.
  - **Multi-Tenancy:** The `tenant_id` is automatically injected into every query key to prevent cross-tenant data leaks in the local cache.
- **API Client:** Specialized Axios wrapper that automatically attaches the `Authorization: Bearer <JWT>` and `X-Tenant-Slug` headers.

---

## 5. Folder Structure (`apps/web/`)

Next.js 14 App Router. The same Next.js app serves both the public hotsite (`/[slug]`) and the authenticated dashboard (`/dashboard`). Middleware separates them at the routing layer.

```
apps/web/
├── app/
│   ├── [slug]/                     ← public hotsite — one route per tenant slug
│   │   ├── layout.tsx              ← fetches manifest, applies CSS branding variables
│   │   ├── page.tsx                ← renders modules array from manifest (HERO, SERVICE_LIST, etc.)
│   │   └── booking/
│   │       └── page.tsx            ← booking form (UC-001, UC-002)
│   ├── dashboard/                  ← authenticated area (requires valid JWT)
│   │   ├── layout.tsx              ← AppShell: reads JWT role, renders Customer or Staff sidebar
│   │   ├── bookings/
│   │   │   ├── page.tsx            ← booking list (Staff: all bookings / Customer: own bookings)
│   │   │   └── [id]/page.tsx       ← booking detail
│   │   ├── services/
│   │   │   └── page.tsx            ← service management (Staff/Manager only — UC-012, UC-013)
│   │   ├── schedule/
│   │   │   └── page.tsx            ← schedule closures calendar (UC-010)
│   │   ├── loyalty/
│   │   │   └── page.tsx            ← loyalty metrics (UC-016)
│   │   ├── customers/
│   │   │   └── page.tsx            ← customer list (Staff/Manager only)
│   │   ├── staff/
│   │   │   └── page.tsx            ← staff management (Manager only — UC-028, UC-029)
│   │   └── settings/
│   │       └── page.tsx            ← tenant settings (Manager only — UC-026, UC-027)
│   ├── auth/
│   │   ├── login/page.tsx          ← "Login with Google" button → /auth/google on BFF
│   │   └── callback/page.tsx       ← handles post-OAuth redirect, stores JWT
│   ├── select-tenant/
│   │   └── page.tsx                ← UC-021 tenant selection screen (customers with multiple tenants)
│   ├── layout.tsx                  ← root layout: TanStack Query provider, TenantContext
│   └── page.tsx                    ← root redirect: → /dashboard if authenticated, else → /auth/login
│
├── components/
│   ├── hotsite/                    ← public hotsite modules
│   │   ├── HeroModule.tsx
│   │   ├── ServiceListModule.tsx
│   │   ├── GalleryModule.tsx
│   │   ├── TestimonialsModule.tsx
│   │   └── BookingCtaModule.tsx
│   ├── dashboard/                  ← authenticated dashboard modules
│   │   ├── CommandCenter.tsx       ← pending bookings queue (Staff)
│   │   ├── BookingTimeline.tsx     ← upcoming/past bookings (Customer)
│   │   ├── LoyaltyCard.tsx         ← per-service points breakdown
│   │   ├── ServiceEditor.tsx       ← service CRUD form
│   │   └── TenantSwitcher.tsx      ← UC-023 tenant switch UI
│   └── shared/                     ← shadcn/ui base components + shared business components
│       ├── ui/                     ← Button, Input, Dialog, Toast, Card, etc. (shadcn/ui copied in)
│       ├── BookingForm.tsx         ← booking form used in both hotsite and dashboard
│       └── ServiceCard.tsx         ← service display used in both hotsite service list and admin
│
├── lib/
│   ├── api/                        ← typed BFF API client functions (one file per domain)
│   │   ├── bookings.ts             ← getBooking(), createBooking(), updateBookingStatus(), etc.
│   │   ├── services.ts
│   │   ├── loyalty.ts
│   │   ├── schedule.ts
│   │   └── tenant.ts               ← getTenantManifest() (used by hotsite layout)
│   ├── auth/
│   │   ├── session.ts              ← JWT storage (httpOnly cookie via BFF) + getSession()
│   │   └── permissions.ts          ← canAccess(role, action) helper
│   └── hooks/                      ← TanStack Query hooks wrapping lib/api functions
│       ├── useBookings.ts
│       ├── useLoyaltyBalance.ts
│       └── useServices.ts
│
├── middleware.ts                    ← Next.js edge middleware: redirects /dashboard → /auth/login if no JWT
├── next.config.js                   ← rewrites, env vars, image domains
└── public/
    └── fonts/                       ← self-hosted fonts (no external font requests)
```

---

## 6. Deployment

**Runtime:** GCP Cloud Run — Next.js runs as an SSR Node.js server, not a static export. SSR is required for dynamic `[slug]` routing and server-side session handling.

**Container:** Multi-stage Docker build in `docker/web/Dockerfile`.

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/ packages/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/web/ apps/web/
RUN pnpm --filter web build    # next build

# Stage 2: runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
```

**Environment variables at runtime:**

| Variable | Value (prod) | Notes |
|---|---|---|
| `NEXT_PUBLIC_BFF_URL` | `https://bff.beloauto.com` | Injected at build time via Cloud Run `--set-env-vars` |
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Cloud Run sets this automatically |

**`next.config.js`** — rewrites local `/api` prefix to BFF (local dev only):
```javascript
/** @type {import('next').NextConfig} */
module.exports = {
  env: {
    NEXT_PUBLIC_BFF_URL: process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002',
  },
  images: {
    domains: ['storage.googleapis.com'],  // for tenant photo URLs
  },
};
```

**CI/CD:** Full pipeline in `docs/09-CI_CD_PIPELINE.md` (`ci-frontend.yml` + `deploy-frontend.yml`). Summary:
- PR gate: ESLint, `tsc --noEmit`, Vitest, Playwright, Gitleaks
- Merge to `main`: build → GAR, deploy Cloud Run staging (auto), production (1 reviewer required)
- Smoke test: `curl` against Cloud Run URL after deploy

---

## 7. Local Development

```bash
# Start infrastructure (PostgreSQL, Pub/Sub emulator, MailHog)
pnpm infra:up

# Start all services in watch mode (backend :3001, BFF :3002, web :3000)
pnpm dev
```

**Next.js dev server** (`next dev`) provides:
- Hot Module Replacement (HMR) out of the box
- Server-side rendering on every request (no build step needed locally)

**API calls in local dev:** The Next.js app calls `NEXT_PUBLIC_BFF_URL` which defaults to `http://localhost:3002`. No proxy configuration needed — direct HTTP call to the local BFF process.

**MSW (Mock Service Worker):** Optional. Use to develop UI before BFF endpoints exist:
```typescript
// app/layout.tsx (dev only)
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_MSW === 'true') {
  const { worker } = await import('../mocks/browser');
  await worker.start();
}
```

**Hotsite local testing:** Visit `http://localhost:3000/<tenant-slug>` (e.g. `http://localhost:3000/autowash-pro`). The `[slug]` route fetches the manifest from the local BFF which calls the local backend.

---

**Status:** Phase 2 - Technical Architecture  
**Validated:** Covers all authenticated use cases (UC-003 to UC-023).
