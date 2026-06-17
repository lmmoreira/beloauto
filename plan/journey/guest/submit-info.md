# GUEST — Responder à Solicitação de Informação

**Actor(s):** GUEST (main path — unauthenticated, email link); CUSTOMER (alt path — authenticated, via minha-conta)
**Goal:** Submit the additional information requested by the admin so the booking returns to PENDING and can be approved.
**UCs covered:** UC-005 A2
**Status:** Draft

## Flow

```mermaid
flowchart TD
    Email(["📧 Email: 'Precisamos de mais informações'"])
    Email --> TokenDecode{"Token válido\ne não expirado?"}

    TokenDecode -->|"Inválido / expirado\n/ já utilizado"| InvalidLink["❓ GAP: Tela de link inválido\n/bookings/[id]/submit-info"]
    TokenDecode -->|"Válido"| Form["❓ GAP: Formulário de resposta\n/bookings/[id]/submit-info"]

    Form --> FillText(("Preenche resposta\n(texto obrigatório)"))
    FillText --> PhotoOpt{"Upload de fotos\n(opcional)?"}
    PhotoOpt -->|"Sem fotos"| Submit
    PhotoOpt -->|"Com fotos"| Upload(("Upload via\npresigned URL S3"))
    Upload --> Submit(("Clica 'Enviar resposta'"))

    Submit --> API["PATCH /v1/bookings/:id/submit-info/guest\n?token=…"]
    API -->|"Erro de rede\nou servidor"| ErrRetry["❓ GAP: Tela de erro\n(retry disponível)"]
    ErrRetry --> Submit
    API -->|"Sucesso 200"| Success["❓ GAP: Confirmação\n/bookings/[id]/submit-info"]

    AuthCustomer(["Cliente autenticado\nrecebe mesmo email"])
    AuthCustomer -->|"Link → /dashboard/bookings/:id"| DashDetail["EXISTENTE (stub): Detalhe do agendamento\n/dashboard/bookings/[id]"]
    DashDetail -->|"Clica 'Responder'"| CustomerForm["❌ GAP: Formulário embutido\n(Minha Conta journey)"]

    classDef gap stroke:#f00,stroke-dasharray: 5 5,fill:#fee
    classDef existing fill:#e6ffe6,stroke:#3a3
    class InvalidLink,Form,ErrRetry,Success,CustomerForm gap
    class DashDetail existing
```

## Pages referenced

| Page / Route | Component | Story | Status |
|---|---|---|---|
| `apps/web/app/bookings/[id]/submit-info/page.tsx` | `SubmitInfoPage` | TBD | ❌ GAP |

**Note on routing:** `bookings/` is a static Next.js segment and takes priority over the `[slug]/` dynamic segment — no conflict. The page lives outside both the hotsite (`[slug]/`) and the dashboard (`dashboard/`).

**Note on authenticated path:** The customer's email links to `/dashboard/bookings/:id` (existing stub). The submission form for authenticated customers will be embedded in `BookingDetailPage` (Minha Conta journey — tracked separately as IA gap #2).

## Implementation prerequisites

Before building this page, update `buildRespondLink()` in:
```
apps/backend/src/contexts/notification/application/use-cases/
  send-booking-info-requested-notification/
    send-booking-info-requested-notification.use-case.ts
```
Change line ~84:
```ts
// Before:
return `${frontendUrl}/bookings/${dto.bookingId}/responder?token=${token}`;
// After:
return `${frontendUrl}/bookings/${dto.bookingId}/submit-info?token=${token}`;
```
Also update the companion `.spec.ts` to expect the new path. This is a backend code change — belongs in the same story that creates the frontend page.

## Open questions / gaps

- [ ] Should the page show the tenant's branding (colors, logo)? If yes: token contains `tenantId` only — page must call `GET /v1/public/tenants/:tenantId/config` (or similar) to fetch branding. Or: include `tenantSlug` in the token so branding can be fetched via slug.
- [ ] Photo upload: presigned URL endpoint needed for unauthenticated context — does `POST /v1/bookings/:id/presigned-url/guest?token=` exist, or does the guest just submit text and a staff member uploads photos later?
- [ ] What should the page say if the booking has already been approved/rejected before the guest submits info (booking status is no longer `INFO_REQUESTED`)?
