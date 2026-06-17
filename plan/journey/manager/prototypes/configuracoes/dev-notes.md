# Configurações — Dev Notes

**Journey:** MANAGER — Configurações (Tenant Settings)
**UCs:** UC-026
**Prototype:** `manager/prototypes/configuracoes/`

---

## Overview

🔴 **Blocking precondition — read this before scoping any story.** Backend `PATCH /tenants/settings` is fully implemented, `MANAGER`-guarded, and `.http`-covered (`apps/backend/src/contexts/platform/infrastructure/controllers/tenant-settings.controller.ts`). **No BFF controller exposes it** (confirmed via `/uc-audit UC-026,UC-027,UC-028,UC-029`, 2026-06-16). Unlike Equipe and Hotsite, this journey needs a **new BFF story** — a proxy route in the `platform` BFF module — before any frontend story can be scoped.

---

## Routes

| Prototype file | Production route | Page component |
|---|---|---|
| `01-settings-form.html` | `/{slug}/dashboard/settings` | `TenantSettingsForm` |

---

## BFF calls

| Action | Method + Path | Role guard | Status |
|---|---|---|---|
| Get settings | `GET /tenants/settings` (new) | MANAGER | ❌ Does not exist — needed for initial form load |
| Update settings | `PATCH /tenants/settings` (new) | MANAGER | ❌ Does not exist — proxy to backend |

Backend reference (already built, proxy target for the new BFF routes):

```typescript
// apps/backend/src/contexts/platform/infrastructure/controllers/tenant-settings.controller.ts
GET   /tenants/settings    // -> current tenants.name + tenants.settings JSONB
PATCH /tenants/settings    // -> validates + updates tenants.settings + tenants.name
```

---

## Two data sources, one form

`Nome do estabelecimento` and `Slug` are `tenants` table columns, not part of the `settings` JSONB — everything else (cancellation window, buffer, loyalty expiry, business hours, business_info) lives in `settings`. UC-026 step 5 confirms the save updates both `tenants.settings` *and* `tenants.name` in one request. The form should hide this split from the admin; the BFF/backend already accept a combined payload.

```typescript
interface UpdateTenantSettingsDto {
  name?: string;                         // tenants.name (not in settings JSONB)
  settings: {
    loyalty?: { expiryDays?: number };
    booking?: { cancellationWindowHours?: number; serviceBufferMinutes?: number };
    businessHours?: {
      timezone: string;
      monday?: { open: string; close: string } | null;   // null = closed
      tuesday?: { open: string; close: string } | null;
      // ... wednesday .. sunday
    };
    businessInfo?: {
      phone?: string | null;
      email?: string | null;
      address?: {
        street: string; number: string; complement?: string;
        neighborhood: string; city: string; state: string; zipCode: string;
      } | null;
    };
  };
}
```

Verify exact key casing (`businessHours` vs `business_hours`) against the actual DTO/Zod schema — `docs/21-TENANTS_SETTINGS_SCHEMA.md` uses snake_case for the JSONB keys but the BFF layer typically exposes camelCase to the frontend; don't assume, check the schema file directly when the BFF story lands.

---

## Field defaults & limits (from `docs/21-TENANTS_SETTINGS_SCHEMA.md` and `TenantSettings` VO)

| Field | Default | Range |
|---|---|---|
| `cancellation_window_hours` | 48 | 0–720 |
| `service_buffer_minutes` | 60 | 0–120 |
| `loyalty.expiry_days` | 180 | 1–3650 |
| `business_hours.timezone` | `America/Sao_Paulo` | valid IANA identifier |

`business_hours.<day>` is `{ open, close }` or `null` (closed) per day — Sunday defaults to closed in this prototype as an example, not a hardcoded rule.

---

## Validation (UC-026 A1)

| Field | Rule | Error message |
|---|---|---|
| name | min 1 | "Informe o nome do estabelecimento." |
| cancellationWindowHours | 0–720 | "O valor máximo é 720 horas (30 dias)." |
| serviceBufferMinutes | 0–120 | "O valor máximo é 120 minutos." |
| loyaltyExpiryDays | 1–3650 | "Informe um valor entre 1 e 3650 dias." |
| timezone | valid IANA id | "Selecione um fuso horário válido." |
| businessInfo.phone | 10–11 digits, optional | "Telefone inválido." |
| businessInfo.email | `z.email()`, optional | "E-mail inválido." |

Slug is never submitted — input stays `readonly`; UC-026 A2 says the system silently ignores any manipulation attempt, so there's no need for a slug-specific error state.

---

## Out of scope (confirmed, don't build)

- **Audit log view** — UC-026 step 6 mentions logging who changed what, but CLAUDE.md §6 lists "audit log view" as an explicitly undocumented/missing UC. No "Histórico de alterações" screen in this prototype.
