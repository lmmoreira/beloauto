# STAFF — Use Case Inventory

Source: `docs/04-USE_CASES.md`. Working checklist for journeys in this folder — shared by `STAFF` and `MANAGER` roles. UCs restricted to `MANAGER` only live in `manager/use-cases.md`.

| UC | Title | Notes | Journey file |
|---|---|---|---|
| UC-022 | Staff Login (No Tenant Selection) | Entry point | _TBD_ |
| UC-025 | Admin First Login (Accepts Invite) | First-time staff onboarding | _TBD_ |
| UC-003 | Admin Approves Booking | | _TBD_ |
| UC-004 | Admin Rejects Booking | | _TBD_ |
| UC-005 (main flow) | Admin Requests More Information | Alt flow A2 (info submission) lives in `customer/` / `guest/` | _TBD_ |
| UC-008 | Admin Cancels or Reschedules Booking | | _TBD_ |
| UC-009 | Admin Marks Booking Complete | | _TBD_ |
| UC-010a–d | Admin Manages Schedule Closures and Openings | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | _TBD_ |
| UC-012 | Admin Creates New Service | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | _TBD_ |
| UC-013 | Admin Edits Service Details | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | _TBD_ |
| UC-016 | View Customer Loyalty Metrics (admin/staff variant) | Staff/Manager looks up ANY customer's balance — own-data variant lives in `customer/use-cases.md` | _TBD_ |
| UC-017 | Admin Views Booking Analytics | Future — out of MVP, low priority | _TBD_ |
| UC-018 | Admin Receives Daily Schedule Reminder | Email-based; relates to the "today's schedule" dashboard gap identified during M13 review | _TBD_ |
