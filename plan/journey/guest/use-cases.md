# GUEST — Use Case Inventory

Source: `docs/04-USE_CASES.md`. Working checklist for journeys in this folder — the unauthenticated visitor on a tenant's public hotsite.

| UC | Title | Notes | Journey file |
|---|---|---|---|
| UC-001 | Guest Requests Booking (No Authentication) | | `book-a-service.md` |
| UC-011 | Guest Views Real-Time Calendar Availability | Shared algorithm with `customer/` booking flow | `book-a-service.md` |
| UC-005 (A2) | Guest submits requested info | Alt flow only — main flow (admin requests info) lives in `staff/use-cases.md`. Backend/BFF complete (M08-S04/S05), incl. guest tokenised-link endpoint (`PATCH /v1/bookings/:id/submit-info/guest?token=`). **GAP:** frontend page doesn't exist — no M12/M13 story covers it. Email link also hardcodes `/bookings/:id/responder?token=` (pt-BR slug, set in `send-booking-info-requested-notification.use-case.ts`); rename to `/bookings/:id/submit-info` to match endpoint naming when this page is built — touches `buildRespondLink()`, its spec, and the M08 IA/DEVELOPER docs. | _TBD_ |

## Exit point

A guest who clicks "Entrar com Google" leaves this folder's journeys and enters `customer/login-and-tenant-selection.md` (UC-021).
