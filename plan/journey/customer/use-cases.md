# CUSTOMER — Use Case Inventory

Source: `docs/04-USE_CASES.md`. Working checklist for journeys in this folder — the authenticated `CUSTOMER` role.

| UC | Title | Notes | Journey file |
|---|---|---|---|
| UC-021 | Customer Login (with Tenant Selection) | Entry point | `book-a-service.md` |
| UC-023 | Customer Switches Tenant | | _TBD_ |
| UC-002 | Authenticated Customer Requests Booking | | `book-a-service.md` |
| UC-005 (A2) | Customer submits requested info | Alt flow only — main flow (admin requests info) lives in `staff/use-cases.md` | _TBD_ |
| UC-006 | Customer Views and Manages Bookings | | _TBD_ |
| UC-007 | Customer Cancels Booking | | _TBD_ |
| UC-016 | View Customer Loyalty Metrics (own data) | Admin-viewing-any-customer variant lives in `staff/use-cases.md` | _TBD_ |
| UC-019 | Customer Receives Booking Reminder (Day Before) | ⚠️ Email-only, no dashboard page — likely N/A for journey mapping | _TBD_ |
| UC-020 | Customer Receives Booking Reminder (Day Of) | ⚠️ Email-only, no dashboard page — likely N/A for journey mapping | _TBD_ |

## Entry point

Reached from `guest/use-cases.md` via the "Entrar com Google" CTA (UC-021).
