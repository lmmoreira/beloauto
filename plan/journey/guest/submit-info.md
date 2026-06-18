# GUEST — Responder à Solicitação de Informação

**Actor(s):** GUEST (main path — unauthenticated, email link); CUSTOMER (alt path — authenticated, via minha-conta)
**Goal:** Submit the additional information requested by the admin so the booking returns to PENDING and can be approved.
**UCs covered:** UC-005 A2
**Status:** Reviewed — fully specced as `M13-S38`/`M13-S39`/`M13-S40` in `plan/M13-DASHBOARD-FRONTEND.md` (implementable, not yet built)

## Flow

```mermaid
flowchart TD
    Email(["📧 Email: 'Precisamos de mais informações'"])
    Email --> TokenDecode{"Token válido\ne não expirado?"}

    TokenDecode -->|"Inválido / expirado\n/ já utilizado"| InvalidLink["✅ Protótipo: Tela de link inválido\n/bookings/[id]/submit-info"]
    TokenDecode -->|"Válido"| Form["✅ Protótipo: Formulário de resposta\n/bookings/[id]/submit-info"]

    Form --> FillText(("Preenche resposta\n(texto obrigatório)"))
    FillText --> PhotoOpt{"Upload de fotos\n(opcional)?"}
    PhotoOpt -->|"Sem fotos"| Submit
    PhotoOpt -->|"Com fotos"| Upload(("Upload via\npresigned URL S3"))
    Upload --> Submit(("Clica 'Enviar resposta'"))

    Submit --> API["PATCH /v1/bookings/:id/submit-info/guest\n?token=…"]
    API -->|"Erro de rede\nou servidor"| ErrRetry["✅ Protótipo: Tela de erro\n(retry disponível)"]
    ErrRetry --> Submit
    API -->|"Sucesso 200"| Success["✅ Protótipo: Confirmação\n/bookings/[id]/submit-info"]

    AuthCustomer(["Cliente autenticado\nrecebe mesmo email"])
    AuthCustomer -->|"Link → /dashboard/bookings/:id"| DashDetail["EXISTENTE (stub): Detalhe do agendamento\n/dashboard/bookings/[id]"]
    DashDetail -->|"Clica 'Responder'"| CustomerForm["❌ GAP: Formulário embutido\n(Minha Conta journey)"]

    classDef gap stroke:#f00,stroke-dasharray: 5 5,fill:#fee
    classDef existing fill:#e6ffe6,stroke:#3a3
    classDef prototyped fill:#fff7ed,stroke:#f97316
    class CustomerForm gap
    class DashDetail existing
    class InvalidLink,Form,ErrRetry,Success prototyped
```

**Legend:** `existing` (green) = code already in production. `prototyped` (orange) = UX validated via static HTML prototype in `prototypes/submit-info/`, but no implementation story written yet. `gap` (red, dashed) = no design or prototype exists yet — genuinely undesigned.

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

- [ ] Tenant branding on this page — see canonical description in `prototypes/submit-info/dev-notes.md` § Known limitations ("No branding per tenant").
- [ ] Photo upload: presigned URL endpoint needed for unauthenticated context — does `POST /v1/bookings/:id/presigned-url/guest?token=` exist, or does the guest just submit text and a staff member uploads photos later?
- [x] What should the page say if the booking has already been approved/rejected before the guest submits info (booking status is no longer `INFO_REQUESTED`)? — **Resolved.** The API returns `409`/non-`INFO_REQUESTED`; `M13-S40`'s invalid-link view gets a `reason="processed"` variant with copy "este agendamento já foi processado."
- [ ] Does the "Criar conta / Entrar" link on the success screen (`02-success.html`) generate real value for the guest at that moment, or is it noise that distracts from the confirmation message? (raised in `prototypes/submit-info/index.html` dry-run checklist item 5)
