# STAFF — Use Case Inventory

Source: `docs/04-USE_CASES.md`. Working checklist for journeys in this folder — shared by `STAFF` and `MANAGER` roles. UCs restricted to `MANAGER` only live in `manager/use-cases.md`.

| UC | Title | Notes | Journey file |
|---|---|---|---|
| UC-022 | Staff Login (No Tenant Selection) | Entry point | `staff/login.md` |
| UC-025 | Admin First Login (Accepts Invite) | First-time staff onboarding | `staff/login.md` |
| UC-003 | Admin Approves Booking | | `staff/agenda.md` |
| UC-004 | Admin Rejects Booking | | `staff/agenda.md` |
| UC-005 (main flow) | Admin Requests More Information | Alt flow A2 (info submission) lives in `customer/` / `guest/` | `staff/agenda.md` |
| UC-008 | Admin Cancels or Reschedules Booking | Extends the same `/dashboard/bookings/[id]` detail page as UC-003/004/005, branched by status | `staff/agenda.md` |
| UC-009 | Admin Marks Booking Complete | Extends the same `/dashboard/bookings/[id]` detail page as UC-003/004/005, branched by status | `staff/agenda.md` |
| UC-010a–d | Staff Manages Schedule Closures and Openings | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | `staff/horarios.md` |
| UC-012 | Admin Creates New Service | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | `staff/servicos.md` |
| UC-013 | Admin Edits Service Details | Confirmed STAFF + MANAGER (`@Roles('MANAGER','STAFF')`) | `staff/servicos.md` |
| UC-016 | View Customer Loyalty Metrics (admin/staff variant) | Staff/Manager looks up ANY customer's balance, earning history, and redemption history | `staff/fidelidade.md` |
| UC-017 | Admin Views Booking Analytics | Future — out of MVP, low priority | _TBD_ |
| UC-018 | Admin Receives Daily Schedule Reminder | Email-based; relates to the "today's schedule" dashboard gap identified during M13 review | _TBD_ |
