# CUSTOMER — Minha Conta (UC-006 + UC-007 + UC-016 summary)

**Actor(s):** CUSTOMER  
**Goal:** Logged-in customer views their booking history, checks loyalty balance, and cancels eligible bookings — all scoped to the current tenant  
**UCs covered:** UC-006, UC-007, UC-016 (balance summary + full breakdown), UC-023 (trigger), UC-005 A2 (authenticated customer path)  
**Status:** Draft

## Flow

```mermaid
flowchart TD
    classDef existing fill:#e6ffe6,stroke:#3a3
    classDef gap stroke:#f00,stroke-dasharray: 5 5,fill:#fee

    Hotsite["/{slug}<br/>Hotsite (logged in)"] -->|"Clica 'Minha Conta' no nav"| MinhaConta
    BookingConfirm["/{slug}/booking<br/>Confirmação (UC-002 step 10)"] -->|"'Ver meus agendamentos'"| MinhaConta
    InfoEmail["E-mail de info solicitada<br/>(UC-005 main flow)"] -->|"Link direto → detalhe"| Detail

    MinhaConta["❓ GAP: /{slug}/minha-conta<br/>Minha Conta"] --> LoyaltySummary["Cartão: pontos ativos + próxima expiração<br/>GET /v1/loyalty/balance"]
    LoyaltySummary -->|"Toca cartão"| LoyaltyFull["❓ GAP: /{slug}/minha-conta/fidelidade<br/>Minha Fidelidade (UC-016)"]
    MinhaConta --> AvatarMenu(("Avatar dropdown"))
    AvatarMenu -->|"'Trocar empresa'<br/>(2+ tenants apenas)"| SwitchTenant["❓ GAP: modal Trocar Empresa<br/>POST /v1/auth/switch-tenant"]
    SwitchTenant -->|"Sucesso"| NewTenant["Hotsite nova empresa"]
    MinhaConta --> BookingList["Seções de agendamentos<br/>GET /v1/bookings"]

    BookingList --> Upcoming["Próximos<br/>APPROVED · data ≥ hoje"]
    BookingList --> Pending["Pendentes<br/>PENDING · INFO_REQUESTED"]
    BookingList --> Past["Histórico<br/>COMPLETED · CANCELLED · REJECTED"]

    Upcoming -->|"Clica card"| Detail
    Pending -->|"Clica card"| Detail
    Past -->|"Clica card (read-only)"| Detail

    Upcoming -->|"Clica 'Cancelar' (dentro da janela)"| CancelSheet["Sheet: Confirmar cancelamento"]
    Pending -->|"Clica 'Cancelar solicitação'"| CancelSheet

    Detail["❓ GAP: /{slug}/minha-conta/agendamentos/[id]<br/>Detalhe do Agendamento<br/>GET /v1/bookings/:id"] -->|"APPROVED · PENDING · INFO_REQUESTED<br/>→ botão Cancelar"| CancelSheet

    Detail -->|"INFO_REQUESTED<br/>→ mostra mensagem do admin + form UC-005 A2"| InfoSubmit(("PATCH /v1/bookings/:id/submit-info"))
    InfoSubmit -->|"200 → status volta a PENDING"| Detail

    CancelSheet -->|"Confirma"| CancelCall(("PATCH /v1/bookings/:id/cancel"))
    CancelCall -->|"200 → status CANCELLED"| MinhaConta
    CancelCall -->|"422 fora da janela (APPROVED)"| CancelError["Erro inline:<br/>'Cancelamento fora do prazo'"]

    class Hotsite,BookingConfirm existing
    class MinhaConta,Detail,CancelSheet,LoyaltyFull,SwitchTenant,NewTenant gap
```

## Pages referenced

| Page / Route | Component | Story | Status |
|---|---|---|---|
| `/{slug}` (hotsite, logged-in nav) | `HotsiteLayout` logged-in state | M12 | ✅ Existente |
| `/{slug}/booking` (post-booking CTA) | `BookingForm` / confirmation | M12-S07 | ✅ Existente |
| `/{slug}/minha-conta` | `MinhaContaPage` | M126-S01 | ❌ GAP |
| `/{slug}/minha-conta/agendamentos/[id]` | `AgendamentoDetailPage` | M126-S02 | ❌ GAP |
| Cancel sheet | inline `CancelSheet` component on both pages | M126-S02 | ❌ GAP |
| Info submit form (UC-005 A2) | inline section on detail page (customer auth path) | M126-S02 | ❌ GAP |
| `/{slug}/minha-conta/fidelidade` | `MinhaFidelidadePage` | M126-S03 | ❌ GAP |
| Tenant switch modal/page (UC-023) | `TrocarEmpresaPage` — avatar dropdown trigger | M124-S02 | ❌ GAP |

## BFF calls in this flow

| Call | When | Roles |
|---|---|---|
| `GET /v1/bookings` | Minha-conta page load — full booking list | CUSTOMER (filtered to own bookings) |
| `GET /v1/loyalty/balance` | Minha-conta page load — points card | CUSTOMER |
| `GET /v1/loyalty/entries` | Fidelidade page — earning history (paginated) | CUSTOMER |
| `GET /v1/loyalty/redemptions` | Fidelidade page — redemption history (paginated) | CUSTOMER |
| `POST /v1/auth/switch-tenant { targetTenantId }` | UC-023 — customer selects new tenant | CUSTOMER |
| `GET /v1/bookings/:id` | Detail page load | CUSTOMER (ownership enforced) |
| `PATCH /v1/bookings/:id/cancel` | Customer confirms cancel — BFF routes to `/cancel-customer` | CUSTOMER |
| `PATCH /v1/bookings/:id/submit-info` | Customer submits info on INFO_REQUESTED booking (UC-005 A2) | CUSTOMER |

## Section logic (UC-006 step 1)

| Section | Statuses shown | Date filter | Action |
|---|---|---|---|
| **Próximos** | APPROVED | `scheduledAt ≥ today` | Cancel button (if within window) |
| **Pendentes** | PENDING, INFO_REQUESTED | any | "Cancelar solicitação" always shown |
| **Histórico** | COMPLETED, CANCELLED, REJECTED | any | Read-only; no action |

Cancel button visibility for **Próximos** (APPROVED): hidden with note when `scheduledAt − now() < tenants.settings.booking.cancellation_window_hours` (UC-006 A2).

## Open questions / gaps

- [ ] **"Total washes completed" + "Most recently completed service" (UC-006 step 6):** `GET /v1/loyalty/balance` returns only `{ currentPoints, nextExpiryDate, nextExpiryPoints }`. Neither "total washes" nor "last service" is available from this endpoint. Options: (a) add fields to balance endpoint, (b) derive from `GET /v1/loyalty/entries` pagination `total` + first entry's `serviceName`, (c) drop from MVP minha-conta. Decide before M12X-S01 starts.
- [ ] **`CustomerBookingListResponse` DTO missing from `packages/types/src/`:** only a backend-internal `BookingListItem` exists. Add to `packages/types/` in M12X-S01.
- [ ] **UC-005 A2 scope:** should the info submission form live in this journey's detail page or a separate journey? Recommendation: include it inline in M12X-S02 (detail page) since the customer reaches it from "My Bookings" — it's not a separate navigation destination.
- [ ] **Post-cancel destination:** after successful cancel from the detail page, navigate back to `/{slug}/minha-conta` list (recommended) or show inline CANCELLED state on the detail page and let the customer navigate back manually?
- [ ] **Empty state CTA (UC-006 A1):** when customer has no bookings, what does the CTA say? "Fazer um agendamento" → `/{slug}/booking`?
- [ ] **`GET /v1/bookings` query params for customer:** the existing endpoint accepts `status` filter. Should the frontend call it once (all statuses) and split client-side, or call it three times (one per section)? Single call + client split is simpler.
- [ ] **Pagination:** UC-006 doesn't specify pagination behaviour. The backend supports `limit`/`offset`. For MVP: load all bookings in one call (with a reasonable cap, e.g. `limit=50`) and display all; no infinite scroll.

## Prototype

Folder: `customer/prototypes/minha-conta/`

| File | Screen | UC | Story | Status |
|---|---|---|---|---|
| `index.html` | Navigation hub | — | — | ✅ Criado |
| `00-hotsite-logged-in.html` | Hotsite logged-in state (entry point) | — | — | ✅ Criado |
| `01-minha-conta.html` | Minha Conta — booking list + loyalty strip (clickable) | UC-006 | M126-S01 | ✅ Criado |
| `01-minha-conta-empty.html` | Minha Conta — estado vazio (nenhum agendamento) | UC-006 A1 | M126-S01 | ✅ Criado |
| `02-agendamento-detail.html` | Detalhe do Agendamento (APPROVED/PENDING) | UC-006 step 5 | M126-S02 | ✅ Criado |
| `02b-agendamento-info-requested.html` | Detalhe — INFO_REQUESTED + form de resposta | UC-005 A2 | M126-S02 | ✅ Criado |
| `02b-info-sent.html` | Detalhe — após envio de resposta (booking volta a PENDING) | UC-005 A2 | M126-S02 | ✅ Criado |
| `02c-agendamento-historico.html` | Detalhe — COMPLETED (read-only, sem ações) | UC-006 step 5 | M126-S02 | ✅ Criado |
| `03-cancel-confirm.html` | Sheet de confirmação de cancelamento | UC-007 | M126-S02 | ✅ Criado |
| `03b-cancel-error.html` | Erro — cancelamento fora da janela de prazo | UC-007 A1 | M126-S02 | ✅ Criado |
| `04-fidelidade.html` | Minha Fidelidade — saldo + tabs ganhos/resgates | UC-016 | M126-S03 | ✅ Criado |
| `04b-fidelidade-empty.html` | Fidelidade — estado vazio (0 pontos) | UC-016 | M126-S03 | ✅ Criado |
| `05-trocar-empresa.html` | Trocar empresa — seleção de tenant (UC-023 trigger) | UC-023 | M124-S02 | ✅ Criado |
| `dev-notes.md` | Implementation handoff | — | M126 | ✅ Criado |
