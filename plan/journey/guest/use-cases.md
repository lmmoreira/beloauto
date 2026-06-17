# GUEST — Use Case Inventory

Source: `docs/04-USE_CASES.md`. Working checklist for journeys in this folder — the unauthenticated visitor on a tenant's public hotsite.

| UC | Title | Notes | Journey file |
|---|---|---|---|
| UC-001 | Guest Requests Booking (No Authentication) | | `book-a-service.md` |
| UC-011 | Guest Views Real-Time Calendar Availability | Shared algorithm with `customer/` booking flow | `book-a-service.md` |
| UC-005 (A2) | Guest submits requested info | Alt flow only — main flow (admin requests info) lives in `staff/use-cases.md`. Backend/BFF complete (M08-S04/S05), incl. guest tokenised-link endpoint (`PATCH /v1/bookings/:id/submit-info/guest?token=`). **GAP:** frontend page doesn't exist — no M12/M13 story covers it. Email link currently hardcodes `/bookings/:id/responder?token=`; decided to rename to `/bookings/:id/submit-info` — `buildRespondLink()` + its spec must be updated in the same story that creates the page. | `guest/submit-info.md` |

## Exit point

A guest who clicks "Entrar com Google" leaves this folder's journeys and enters `customer/login-and-tenant-selection.md` (UC-021).
