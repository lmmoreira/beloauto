# BeloAuto — Frontend Learning Journal

> **Who this is for:** A backend specialist (NestJS, TypeORM, PostgreSQL) building a production Next.js frontend for the first time.
> **Format:** Concepts explained via backend analogies, followed by the real decision made in this codebase and why.
> **Updated:** Each milestone adds a new section. Start at the top and read forward.

---

## Table of Contents

- [M12-S03 — Foundation: Next.js, React, CSS Variables, Fonts](#m12-s03)
- [M12-S03 (cont.) — Testing: Vitest, Mocking, Coverage, SonarCloud](#m12-s03-testing)
- *(more sections added as we build)*

---

<a name="m12-s03"></a>
## M12-S03 — Foundation: Routing, Rendering, Branding

---

### 1. What is React?

React is a library for building UIs out of **components** — functions that return HTML-like markup (called JSX).

```tsx
// A React component is just a function that returns markup
function Greeting({ name }: { name: string }) {
  return <p>Olá, {name}!</p>;
}
```

**Backend analogy:** A component is like a function that returns a serialized response — except instead of JSON, it returns HTML structure. Props are like function arguments.

The key idea: **you describe what the UI should look like given some data, and React figures out how to render it**. You don't manipulate the DOM directly (no `document.getElementById`). You just return markup and React handles the rest.

---

### 2. What is Next.js?

Next.js is a framework built on top of React that adds:
- **Routing** — file-system based (a file at `app/[slug]/page.tsx` becomes the route `/:slug`)
- **Server-side rendering** — components can run on the server, not just in the browser
- **Caching and ISR** — built-in HTTP cache with revalidation strategies
- **Image optimisation, font loading, bundle splitting** — production concerns handled for you

**Backend analogy:** React is like Express's `res.send()`. Next.js is like NestJS — it adds routing, middleware, lifecycle hooks, and production tooling on top.

---

### 3. The App Router — Files ARE Routes

In Next.js App Router, the folder structure under `apps/web/app/` defines your routes:

```
app/
├── layout.tsx          → wraps every page (root layout)
├── page.tsx            → GET /
├── [slug]/
│   ├── layout.tsx      → wraps all /<slug>/* pages
│   └── page.tsx        → GET /:slug
├── dashboard/
│   └── page.tsx        → GET /dashboard
└── api/
    └── revalidate/
        └── route.ts    → GET /api/revalidate  (API endpoint, not a page)
```

**Backend analogy:** This is like NestJS controllers, but the file path IS the route. No `@Controller()` decorators needed.

**`layout.tsx` vs `page.tsx`:**
- `layout.tsx` — runs on every request to that route and its children. Used for shared structure (nav, branding injection). Like NestJS middleware or interceptors.
- `page.tsx` — the actual content for that specific route.

Layouts **wrap** pages. So for `GET /lavacar-beloauto`:
1. `app/layout.tsx` runs first (root layout — sets `<html>`, `<body>`)
2. `app/[slug]/layout.tsx` runs next (fetches manifest, injects branding)
3. `app/[slug]/page.tsx` runs last (renders the modules)

**Why we have two layouts:** The root layout is minimal — it owns `<html>` and `<body>`. The slug layout injects the tenant's branding. Only one element can own `<html>`/`<body>` in Next.js — that's why the slug layout uses a `<div id="hotsite-root">` wrapper instead of replacing `<html>`.

---

### 4. Server Components vs Client Components

This is the most important concept in modern Next.js.

**Server Component** (default): Runs on the server. Can `await` database calls, fetch APIs, read env vars. Returns HTML. **No interactivity** — no `onClick`, no `useState`.

**Client Component** (opt-in, add `'use client'` at top of file): Runs in the browser. Can have state, event handlers, browser APIs. **Cannot** directly `await` data fetches at render time.

```tsx
// Server Component (no directive needed — default)
export default async function HotsitePage({ params }) {
  const manifest = await fetchManifest(params.slug); // runs on server
  return <main>{/* render manifest */}</main>;
}

// Client Component
'use client';
export function BookingForm() {
  const [step, setStep] = useState(1); // useState only works in client components
  return <button onClick={() => setStep(2)}>Próximo</button>;
}
```

**Backend analogy:** Server components are like your NestJS controllers — they run on the server, fetch data, and produce output. Client components are like frontend JavaScript that runs after the page loads (like jQuery, but modern).

**Rule of thumb:** Start everything as a server component (the default). Only add `'use client'` when you need interactivity (buttons, forms, state). This gives you the best performance — less JavaScript sent to the browser.

**In BeloAuto:**
- `[slug]/layout.tsx` — server component (fetches manifest)
- `[slug]/page.tsx` — server component (renders module list)
- Future `BookingForm` — client component (multi-step form with state)
- Future `ServiceCard` with a "select" toggle — client component

---

### 5. ISR — Incremental Static Regeneration (The Cache)

When `fetchManifest()` calls the BFF with `next: { revalidate: 300 }`, Next.js caches the result for 300 seconds (5 minutes).

```
First request  → fetch from BFF, cache result, return to user
Requests 2–N   → return from cache (no BFF call, instant)
After 5 min    → return stale cache, trigger background refresh
Admin publishes → POST /api/revalidate → cache cleared immediately
```

**Backend analogy:** This is exactly like a Redis cache with TTL, but built into Next.js's `fetch`. The `revalidate: 300` is the TTL. The `/api/revalidate` endpoint is the cache invalidation hook.

**Why this matters for BeloAuto:** The hotsite manifest doesn't change unless the admin edits it. Caching it for 5 minutes means 99% of visitor requests never hit the BFF at all. When the admin publishes a change, the backend calls our `/api/revalidate` endpoint (M12-S10 already wires this), which clears the cache immediately.

**Why we can cache it safely (and why M12-S10 was important):** The manifest contains image URLs. If those were expiring signed URLs (like S3 pre-signed URLs), they'd expire inside the cache window and serve broken images to visitors. M12-S10 changed hotsite images to permanent public bucket URLs — no expiry, safe to cache forever. Booking photos are still signed URLs (they're private), just never cached in the manifest.

---

### 6. CSS — The Basics for a Backend Developer

CSS (Cascading Style Sheets) tells the browser how to visually render HTML. Three concepts matter most here:

**6a. The Cascade:** Styles apply from parent to child. If you set `color: red` on a `<div>`, all text inside that div and its children is red — unless a child overrides it. "Cascading" = inheritance down the tree.

**6b. CSS Custom Properties (Variables):** Variables you define and reuse across your styles.

```css
/* Define on an element — available to that element and all its children */
#hotsite-root {
  --ba-primary: #f97316;
  --ba-radius: 8px;
}

/* Use anywhere inside #hotsite-root */
button {
  background-color: var(--ba-primary);  /* resolves to #f97316 */
  border-radius: var(--ba-radius);       /* resolves to 8px */
}
```

**Backend analogy:** CSS variables are like environment variables — define them once, reference them everywhere. Change the value in one place and everything that uses it updates.

**Why we use them for branding:** Every tenant has different colors. Instead of generating per-tenant CSS files, we inject each tenant's values as CSS variables on `#hotsite-root` at render time. Every module component just uses `var(--ba-primary)` — it automatically gets the right tenant's color with no extra work per module.

**6c. The Box Model:** Every HTML element is a rectangle. CSS controls its `width`, `height`, `padding` (space inside), `margin` (space outside), and `border`. Most layout problems come down to understanding these.

---

### 7. Tailwind CSS — Utility Classes

Tailwind replaces writing CSS files with applying pre-defined classes directly in your HTML/JSX.

```tsx
// Without Tailwind — you'd write a CSS class somewhere
<div className="card">...</div>
// .card { display: flex; padding: 1rem; background: white; border-radius: 8px; }

// With Tailwind — classes ARE the styles
<div className="flex p-4 bg-white rounded-lg">...</div>
```

**Backend analogy:** Tailwind is like a standard library of pre-named values. Instead of defining your own variable names, you use the library's names (`p-4` = `padding: 1rem`, `flex` = `display: flex`).

**Responsive breakpoints:** Tailwind uses prefixes for screen sizes:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

**BeloAuto rule:** Use Tailwind for layout and spacing. Use `var(--ba-*)` for anything brandable (colors, fonts, radius, shadows). Never hardcode colors like `bg-orange-500` — that would ignore the tenant's branding.

```tsx
// ✓ correct
<button
  className="px-6 py-3 font-semibold"
  style={{ backgroundColor: 'var(--ba-primary)', borderRadius: 'var(--ba-radius)' }}
>
  Agendar
</button>

// ✗ wrong — hardcoded color ignores tenant branding
<button className="px-6 py-3 bg-orange-500 rounded-lg">
  Agendar
</button>
```

**Tailwind v4 note:** This project uses Tailwind v4, which drops the `tailwind.config.js` file. Configuration is now done in CSS via `@import "tailwindcss"`. You just use classes — no config file to touch.

---

### 8. `next/font/google` — Why We Load Fonts at Build Time

Fonts loaded from Google Fonts normally work like this:
1. Browser loads your page
2. Browser makes a request to `fonts.googleapis.com` (Google's servers in the USA)
3. Google serves the font file
4. Browser renders text with the font

**Problems with this approach:**
- **Performance:** Extra network round-trip to Google before text renders (causes "flash of unstyled text")
- **LGPD (Brazil's GDPR):** Google's CDN logs visitor IPs. Serving fonts from Google means sharing your users' data with a third party — a compliance concern

`next/font/google` solves both by downloading the font files at build time and hosting them yourself:
1. During `pnpm build`, Next.js downloads the font from Google
2. Font is bundled with your app and served from your own domain
3. No runtime Google CDN request — no LGPD exposure, no extra round-trip

```tsx
// font-config.ts — runs at BUILD TIME, not in the browser
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',  // creates a CSS variable
});
```

The `variable` option makes Next.js output a CSS class that defines the font as a CSS variable. We apply those classes to `#hotsite-root`, making the fonts available as `var(--font-playfair-display)` to all children.

**FONT_MAP** then bridges manifest keys to CSS variables:
```
manifest: { headingFontFamily: "Playfair Display" }
    ↓
FONT_MAP["Playfair Display"] = "var(--font-playfair-display)"
    ↓
--ba-heading-font: var(--font-playfair-display)
    ↓
h1 { font-family: var(--ba-heading-font); }  → renders in Playfair Display
```

---

### 9. `next/image` — Why Not Just `<img>`?

The built-in `<img>` tag sends the original image at its original size. A 4MB logo gets sent to every visitor regardless of their screen size.

`next/image` (`import Image from 'next/image'`) automatically:
- **Resizes** the image to the exact size needed for the visitor's screen
- **Converts** to modern formats (WebP, AVIF) for smaller file sizes
- **Lazy loads** images below the fold (doesn't download until scrolling near them)
- **Reserves space** to prevent layout shift as images load

```tsx
import Image from 'next/image';

// ✓ use this — optimised, lazy by default
<Image src={backgroundUrl} alt="Hero background" fill />

// For LCP (Largest Contentful Paint — the hero image is typically the biggest element)
// add priority to disable lazy loading for it
<Image src={heroBackground} alt="" fill priority />
```

**`next.config.mjs` `remotePatterns`:** `next/image` optimises remote images by proxying them through Next.js. For security, it only proxies images from explicitly whitelisted hostnames. That's why we added `images.remotePatterns` reading from `NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL` — without it, any `next/image` pointing to our GCS bucket would throw an error.

---

### 10. The `[slug]` Dynamic Segment

`app/[slug]/page.tsx` — the square brackets mean this is a dynamic route. The folder name becomes a parameter.

```
GET /lavacar-beloauto  →  params.slug = "lavacar-beloauto"
GET /autowash-pro      →  params.slug = "autowash-pro"
GET /any-string        →  params.slug = "any-string"
```

**Next.js 16 change — async params:** In Next.js 16, `params` is now a `Promise`. You must `await` it before accessing properties. This is a breaking change from Next.js 14:

```tsx
// Next.js 14 (old)
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params; // sync — worked fine in v14
}

// Next.js 16 (current)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // must await — v16 requirement
}
```

**Why the change?** Next.js 16 can now stream params to the component earlier in the request lifecycle, which requires them to be asynchronous. It's a performance improvement that required a breaking API change.

---

### 11. `fetch()` Deduplication — Why Calling fetchManifest Twice is Fine

Both `[slug]/layout.tsx` and `[slug]/page.tsx` call `fetchManifest(slug)`. You might expect this to make two BFF calls per page load — it doesn't.

Next.js automatically deduplicates `fetch()` calls with the same URL and options within a single render. The second call is served from a per-request memory cache — zero extra network calls.

**Backend analogy:** This is like a DataLoader / request-scoped cache pattern. Within one HTTP request to the server, identical sub-requests are batched or cached.

**Why both layouts need to call it:** `layout.tsx` needs the branding to inject CSS variables. `page.tsx` needs the layout array to render modules. They're both server components — there's no way to pass data between them except by calling the same function. The deduplication makes this free.

---

### 12. How This All Fits Together (Request Flow)

When a visitor opens `http://localhost:3000/lavacar-beloauto`:

```
Browser → Next.js server
  → app/layout.tsx          renders <html lang="pt-BR"><body ...>
  → app/[slug]/layout.tsx   fetches manifest from BFF (or cache)
                             injects --ba-* CSS variables on #hotsite-root
                             loads 8 fonts via next/font/google CSS variables
  → app/[slug]/page.tsx     fetches manifest (deduplicated — no BFF call)
                             filters layout[] to enabled: true
                             for each module, looks up MODULE_MAP[type]
                             currently: MODULE_MAP is empty → renders nothing
                             renders <Footer />
  → HTML sent to browser     browser applies CSS variables, renders text
```

After M12-S04 lands, `MODULE_MAP.HERO = HeroModule`. The HERO module renders with the tenant's branding automatically via `var(--ba-*)`.

---

---

<a name="m12-s03-testing"></a>
## M12-S03 (cont.) — Testing: Vitest, Mocking, Coverage, SonarCloud

---

### 13. Why Vitest Instead of Jest

The backend and BFF use Jest — so why does the web app use Vitest?

**Root cause: ESM vs CommonJS.**

JavaScript historically used CommonJS (`require()`, `module.exports`). Modern tooling — including Next.js 16 and `next/server`, `next/font/google`, etc. — uses ESM (`import`/`export`). Jest was designed for CommonJS. Making Jest handle ESM packages requires a Babel or `ts-jest` transform layer that recompiles imports at test time. This transform is fragile: some Next.js internals resist it and crash.

Vitest is ESM-native. It runs TypeScript/ESM directly without a recompile step, so Next.js packages import cleanly.

**Backend analogy:** It's like choosing between a tool that natively speaks your protocol vs one that needs an adapter. The adapter usually works, but breaks on edge cases.

**API is nearly identical to Jest:**

| Jest | Vitest |
|---|---|
| `jest.fn()` | `vi.fn()` |
| `jest.mock('module', ...)` | `vi.mock('module', ...)` |
| `jest.spyOn(obj, 'method')` | `vi.spyOn(obj, 'method')` |
| `jest.mocked(fn)` | `vi.mocked(fn)` |
| `describe`, `it`, `expect` | same |

If you know Jest, you know Vitest. The main difference is the `vi.*` namespace instead of `jest.*`.

---

### 14. What We Test (and What We Don't)

#### What we test — three categories

**1. Pure utility functions** (`apply-branding.ts`, `font-config.ts`)

These are functions with no side effects: input goes in, CSS tokens or a record comes out. No browser, no network, no framework. Identical to testing a NestJS service method that transforms data.

```ts
// apply-branding.spec.ts
it('maps border-radius variants correctly', () => {
  const result = applyBranding(makeBranding({ borderRadius: 'sharp' })) as CSSTokens;
  expect(result['--ba-radius']).toBe('0px');
});
```

**2. API route handlers** (`app/api/revalidate/route.ts`)

A Next.js route handler is just a function: it receives a `Request` and returns a `Response`. Mock the Next.js-specific side effects (`revalidatePath`), then test the auth and branching logic directly.

```ts
// route.spec.ts
it('returns 401 when the revalidate secret header is missing', async () => {
  const response = await GET(makeRequest('tenant-a')); // no secret header
  expect(response.status).toBe(401);
});
```

**3. Async data fetchers** (`lib/api/tenant.ts`)

Functions that call `fetch()` and handle errors. Mock global `fetch`, test what happens on 200, 404, and 500 responses.

```ts
// tenant.spec.ts
it('calls notFound() when the BFF returns 404', async () => {
  fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(fetchManifest('unknown-slug')).rejects.toThrow('NEXT_NOT_FOUND');
});
```

#### What we don't test (and why)

**React Server Components (layouts, pages):** `[slug]/layout.tsx` and `[slug]/page.tsx` are server components that call `await params`, `await fetchManifest()`, and return JSX. Testing them in Vitest would require mocking the entire Next.js server runtime. The result would be tests that verify the mocks work, not that the code works. These are validated by **Playwright E2E tests** (planned for M16) which run a real Next.js server.

**Client components with DOM interaction:** Buttons, forms, modals — these need a browser environment. Playwright covers them at the integration level.

**Rule of thumb:** Unit-test what's pure and logic-heavy. E2E-test what's visual and interactive.

---

### 15. The Mocking Problem with `next/font/google`

This is the trickiest part of the frontend test setup, worth understanding in depth.

`font-config.ts` calls `Inter(...)`, `Poppins(...)` etc. **at module load time** (top level, outside any function):

```ts
// font-config.ts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

The real `Inter(...)` from Next.js writes font metadata and CSS to the filesystem as part of the build pipeline. Outside of a Next.js build context, it crashes.

**Problem:** When any test file imports `apply-branding.ts`, which imports `./font-config`, which imports `next/font/google`, Node tries to execute `Inter(...)` immediately — before your test even runs. This is called a **module-level side effect**.

**Backend analogy:** Imagine a NestJS service whose constructor connects to the database immediately (`new DatabaseService()` → instant connection attempt). If you import it in a test without a mock, it tries to connect to a real database before you can intercept it.

**Solution — module alias in `vitest.config.ts`:**

```ts
// vitest.config.ts
resolve: {
  alias: {
    'next/font/google': path.resolve(__dirname, '__mocks__/next-font-google.ts'),
  },
}
```

This replaces `next/font/google` globally for the entire test suite — not just in one test file. Whenever anything imports `next/font/google`, Vitest silently swaps it for our mock:

```ts
// __mocks__/next-font-google.ts
const font = (id: string) => (): { variable: string; className: string } => ({
  variable: `--font-${id}`,
  className: `font-${id}`,
});

export const Inter = font('inter');    // Inter('latin') returns { variable: '--font-inter', className: 'font-inter' }
export const Poppins = font('poppins');
// ...
```

The mock returns the same shape as the real thing (`variable`, `className`), so all code that uses it still works — but no filesystem writes happen.

---

### 16. Per-Test Mocking with `vi.mock()`

For things that don't need a global alias — like `next/cache` and `next/navigation` — we mock per test file with `vi.mock()`:

```ts
// route.spec.ts
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// After this, any import of 'next/cache' in this file (and in the code under test)
// gets the mock version.
import { revalidatePath } from 'next/cache';
```

**Key rule: `vi.mock()` is hoisted.** Even though it's written after the `import` statements in your file, Vitest moves it to the very top before any imports execute. This is the same behaviour as Jest's `jest.mock()` — it's a deliberate design decision so the mock is in place before the module under test loads.

**Checking mock calls:**

```ts
const mockRevalidatePath = vi.mocked(revalidatePath);

it('calls revalidatePath with the correct path', async () => {
  await GET(makeRequest('tenant-a', VALID_SECRET));
  expect(mockRevalidatePath).toHaveBeenCalledWith('/tenant-a', 'page');
});
```

`vi.mocked()` is a type helper — it takes a value you know is a mock and types it as `MockInstance<...>`, giving you `.toHaveBeenCalledWith()` etc. on the `expect()` matcher.

---

### 17. Coverage and SonarCloud

**How coverage works:**

When you run `pnpm test:cov`, Vitest instruments every line of your source files and tracks which lines execute during tests. At the end it generates `coverage/lcov.info` — a standard format that SonarCloud, Codecov, and most CI tools understand.

```
pnpm --filter @beloauto/web test:cov
→ apps/web/coverage/lcov.info  (222 lines, records which lines were hit)
```

**How SonarCloud picks it up:**

`sonar-project.properties` tells SonarCloud where to find the coverage report:
```properties
sonar.javascript.lcov.reportPaths=apps/backend/coverage/lcov.info,apps/bff/coverage/lcov.info,apps/web/coverage/lcov.info
```

In CI (`pr-quality.yml`), the SonarCloud job runs all three `test:cov` commands before scanning:
```yaml
- name: Generate coverage reports
  run: |
    pnpm --filter @beloauto/backend test:cov
    pnpm --filter @beloauto/bff test:cov
    pnpm --filter @beloauto/web test:cov   # added
```

**Why the quality gate was failing before this PR:**

`apps/web` was already listed in `sonar.sources` (SonarCloud could see the files), but there was no coverage report for it. SonarCloud treats files with no coverage data as 0% covered. New code with 0% coverage → Quality Gate fails.

**Differential coverage — why you don't need 80% everywhere today:**

`sonar.newCode.referenceBranch=main` tells SonarCloud to only enforce the ≥80% gate on code that changed since the last main commit. Legacy files with no tests don't block the PR. Only the lines YOU changed in this PR need to be covered.

This is the same principle as the backend: you don't need to test the whole codebase before shipping a feature — you need to test the code you're adding.

**What's not covered and why that's OK:**

`[slug]/layout.tsx` and `[slug]/page.tsx` are not covered by unit tests. SonarCloud sees them as uncovered lines. But:
1. They're server components — Playwright covers them at E2E level
2. The differential gate only cares about coverage on **new** lines, and the definition of "new" is relative to main
3. Once M16 Playwright tests land, these paths get covered at integration level

---

*Next update: M12-S04 — React component anatomy, props, Tailwind responsive layout, `next/image` in practice.*
