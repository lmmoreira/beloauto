# Hotsite — Dev Notes

**Journey:** MANAGER — Hotsite (Branding & Content)
**UCs:** UC-027
**Prototype:** `manager/prototypes/hotsite/`

---

## Overview

Backend and BFF are both fully implemented and `MANAGER`-guarded (confirmed via `/uc-audit UC-026,UC-027,UC-028,UC-029`, 2026-06-16). This is a **frontend-only** gap. Branding scope was expanded beyond the original UC text — see "Branding field set" below — per explicit user decision during the audit (2026-06-16): cover every field the aggregate already supports, not just the original 4.

---

## Routes

| Prototype file | Production route | Page component |
|---|---|---|
| `01-hotsite-editor.html` | `/{slug}/dashboard/hotsite` | `HotsiteEditorPage` (tabbed: Branding / Layout / SEO) |
| `01d-module-config-hero.html` | drill-down within editor (no separate route, modal/sheet likely) | `ModuleConfigPanel` (HERO variant) |
| `02-preview.html` | `/{slug}/dashboard/hotsite/preview` or iframe overlay | `HotsitePreview` |

---

## BFF calls

| Action | Method + Path | Role guard |
|---|---|---|
| Get config | `GET /tenants/hotsite` | MANAGER |
| Update branding/layout/SEO | `PATCH /tenants/hotsite` | MANAGER |
| Publish | `POST /tenants/hotsite/publish` | MANAGER |
| Unpublish | `POST /tenants/hotsite/unpublish` | MANAGER |

All four exist in `apps/bff/src/platform/hotsite-admin.controller.ts`, proxying `apps/backend/src/contexts/platform/infrastructure/controllers/hotsite-admin.controller.ts`. `.http` coverage confirmed on both sides.

---

## Branding field set (from `hotsite-config.aggregate.ts` — `HotsiteBranding`)

```typescript
interface HotsiteBranding {
  primaryColor: string;       // hex, required
  secondaryColor: string;     // hex, required
  backgroundColor: string;    // hex, required
  textColor: string;          // hex, required
  headingFontFamily: string;
  bodyFontFamily: string;
  logoUrl: string;
  borderRadius: 'sharp' | 'rounded' | 'pill';
  buttonStyle: 'filled' | 'outline' | 'ghost';
  spacing: 'compact' | 'comfortable' | 'spacious';
  shadowStyle: 'none' | 'subtle' | 'strong';
  buttonBackgroundColor?: string;  // optional hex — overrides primaryColor on buttons
  buttonTextColor?: string;        // optional hex
}
```

`docs/04-USE_CASES.md` UC-027 Section A was updated (2026-06-16) to list all 13 fields. The prototype groups them into 4 sub-sections (Cores, Logo, Tipografia, Forma e estilo) to keep the form scannable — confirm this grouping with the user before implementing, it's a UX judgment call not dictated by the UC.

---

## Module types (`hotsite-config.aggregate.ts` layout)

`HERO | SERVICE_LIST | GALLERY | BOOKING_CTA | TESTIMONIALS | ABOUT | CONTACT` — order in the JSONB array determines render order on the public hotsite. Each module has `enabled: boolean` plus its own config shape (see `HeroModuleData`, etc. in the aggregate file).

**Per-module config — only HERO is prototyped** (`01d-module-config-hero.html`) as a representative example: title, subtitle, layout (centered/left), CTA target, optional background image. The other 6 modules need their own config panel before implementation:
- `SERVICE_LIST`: none beyond enabled (shows full catalog) — verify against `ServiceListModule` props
- `GALLERY`: image limit (default 6), source filter
- `BOOKING_CTA`: CTA copy/target
- `TESTIMONIALS`: layout (grid/carousel)
- `ABOUT`: markdown body, image + position
- `CONTACT`: 4 independent toggles (address/phone/email/map)

Don't build these 6 panels without reconfirming scope — flagged as an open question in `index.html`.

---

## Engineering question — preview semantics (not resolved, needs a decision before implementing)

`is_published` gates what the public hotsite route serves, so "Preview" must show the *draft* (unsaved) state — something the public route never serves once published. Two options:

1. **Client-side live preview** — render the hotsite component tree directly in the dashboard with the in-memory draft state (no extra BFF call). Fastest, no backend changes, but means duplicating hotsite render logic into the dashboard bundle.
2. **Preview-mode BFF parameter/token** — `GET /tenants/hotsite?preview=true` (MANAGER-only) returns draft config even when `isPublished` would normally hide it; the public hotsite page accepts a signed preview token to render draft data server-side. More faithful (exact same render path as production) but needs new backend work.

`02-preview.html` only mocks the visual outcome — this decision is unresolved and should be made explicitly before scoping the implementation story.

---

## Error handling

| Scenario | UI response |
|---|---|
| Invalid color (not hex) — UC-027 A1 | Field: red border + "Cor inválida. Use o formato hexadecimal, ex: #2563eb." — `01b-color-error.html` |
| Image upload fails — UC-027 A2 | Falls back to a URL text input — `01c-image-upload-fallback.html` |

## Unpublish (new — not in original UC text)

`POST /tenants/hotsite/unpublish` exists in the backend/BFF but UC-027's text never describes a take-down flow. The prototype places it in a "Zona de risco" panel inside the editor (`01-hotsite-editor.html`, bottom of page) as a secondary, visually de-emphasized action. Confirm placement before implementing — could equally live in `manager/configuracoes.md` instead.
