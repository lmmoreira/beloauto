# BeloAuto — Frontend Learning Journal

> **Who this is for:** A backend specialist (NestJS, TypeORM, PostgreSQL) building a production Next.js frontend for the first time.
> **Format:** Concepts explained via backend analogies, followed by the real decision made in this codebase and why.
> **Updated:** Each milestone adds a new section. Start at the top and read forward.

---

## Table of Contents

- [M12-S03 — Foundation: Next.js, React, CSS Variables, Fonts](#m12-s03)
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

*Next update: M12-S04 — React component anatomy, props, Tailwind responsive layout, `next/image` in practice.*
