# TD03: Standardize Cross-Context Communication Pattern

## Status
- **Type**: Technical Debt / Architectural Consistency
- **Priority**: High
- **Context**: Backend (NestJS)
- **Created**: 2026-06-08
- **Updated**: 2026-06-08

---

## Problem

Cross-context ports and adapters were named inconsistently — some used entity names (`customer-profile`, `service-catalog`), some used aggregate names from another context (`reminder-tenant`, `notification-tenant`), and some used the correct context names (`notification-customer`, `platform-booking`). Two adapters also bypass the application layer entirely by injecting `DataSource` directly.

---

## Naming Convention (canonical)

The anchor is always the **context name**, never the entity or aggregate name inside that context.

```
Port file:      [source-context]-[target-context].port.ts
Symbol:         [SOURCE]_[TARGET]_PORT
Interface:      I[Source][Target]Port
Adapter file:   [source-context]-[target-context].adapter.ts
Adapter class:  [Source][Target]Adapter
```

One port file per source–target context pair. If a source context needs multiple things from the same target context, they are all methods on the same port interface — not separate files.

---

## Migration Map

### Port files

| Current | Proposed | Change |
|---|---|---|
| `notification-customer.port.ts` | `notification-customer.port.ts` | none |
| `notification-staff.port.ts` | `notification-staff.port.ts` | none |
| `notification-service.port.ts` | `notification-booking.port.ts` | "service" → context name "booking" |
| `notification-tenant.port.ts` | `notification-platform.port.ts` | "tenant" → context name "platform" |
| `customer-profile.port.ts` | `booking-customer.port.ts` | add source context prefix |
| `reminder-tenant.port.ts` | `booking-platform.port.ts` | add source prefix + "tenant" → "platform" |
| `schedule-tenant-settings.port.ts` | merge into `booking-platform.port.ts` | same source-target pair as above |
| `service-catalog.port.ts` | `loyalty-booking.port.ts` | add source prefix + "service" → "booking" |
| `loyalty-tenant-settings.port.ts` | `loyalty-platform.port.ts` | "tenant-settings" → context name "platform" |
| `booking-lookup.port.ts` | `platform-booking.port.ts` | add source context prefix |

### Symbols and interfaces follow the same rename

| Current symbol | Proposed symbol | Current interface | Proposed interface |
|---|---|---|---|
| `NOTIFICATION_CUSTOMER_PORT` | unchanged | `INotificationCustomerPort` | unchanged |
| `NOTIFICATION_STAFF_PORT` | unchanged | `INotificationStaffPort` | unchanged |
| `NOTIFICATION_SERVICE_PORT` | `NOTIFICATION_BOOKING_PORT` | `INotificationServicePort` | `INotificationBookingPort` |
| `NOTIFICATION_TENANT_PORT` | `NOTIFICATION_PLATFORM_PORT` | `INotificationTenantPort` | `INotificationPlatformPort` |
| `CUSTOMER_PROFILE_PORT` | `BOOKING_CUSTOMER_PORT` | `ICustomerProfilePort` | `IBookingCustomerPort` |
| `REMINDER_TENANT_PORT` | `BOOKING_PLATFORM_PORT` | `IReminderTenantPort` | `IBookingPlatformPort` |
| `SCHEDULE_TENANT_SETTINGS_PORT` | merged into `BOOKING_PLATFORM_PORT` | `IScheduleTenantSettingsPort` | merged into `IBookingPlatformPort` |
| `SERVICE_CATALOG_PORT` | `LOYALTY_BOOKING_PORT` | `IServiceCatalogPort` | `ILoyaltyBookingPort` |
| `LOYALTY_TENANT_SETTINGS_PORT` | `LOYALTY_PLATFORM_PORT` | `ILoyaltyTenantSettingsPort` | `ILoyaltyPlatformPort` |
| `BOOKING_LOOKUP_PORT` | `PLATFORM_BOOKING_PORT` | `IBookingLookupPort` | `IPlatformBookingPort` |

### Adapter classes and files

| Current file | Current class | Proposed file | Proposed class |
|---|---|---|---|
| `customer-info.adapter.ts` | `CustomerInfoAdapter` | `notification-customer.adapter.ts` | `NotificationCustomerAdapter` |
| `staff-info.adapter.ts` | `StaffInfoAdapter` | `notification-staff.adapter.ts` | `NotificationStaffAdapter` |
| `service-info.adapter.ts` | `ServiceInfoAdapter` | `notification-booking.adapter.ts` | `NotificationBookingAdapter` |
| `tenant-info.adapter.ts` | `TenantInfoAdapter` | `notification-platform.adapter.ts` | `NotificationPlatformAdapter` |
| `typeorm-booking-availability.adapter.ts` | — | `booking-customer.adapter.ts` | `BookingCustomerAdapter` |
| `reminder-tenant.adapter.ts` | `ReminderTenantAdapter` | `booking-platform.adapter.ts` | `BookingPlatformAdapter` |
| `schedule-tenant-settings.adapter.ts` | `ScheduleTenantSettingsAdapter` | merged into `booking-platform.adapter.ts` | `BookingPlatformAdapter` |
| `service-catalog.adapter.ts` | `ServiceCatalogAdapter` | `loyalty-booking.adapter.ts` | `LoyaltyBookingAdapter` |
| `loyalty-tenant-settings.adapter.ts` | `LoyaltyTenantSettingsAdapter` | `loyalty-platform.adapter.ts` | `LoyaltyPlatformAdapter` |
| `booking-lookup.adapter.ts` | `BookingLookupAdapter` | `platform-booking.adapter.ts` | `PlatformBookingAdapter` |

---

## Code Pattern — What Adapters Inject

Adapters are infrastructure; they belong to the **source context**. Their only job is to translate the source context's port interface into a call on the **target context's application layer**.

### Decision tree (follow in order)

```
1. Does a UseCase already exist in the target context covering this operation?
   → inject the UseCase

2. Does a QueryService exist in the target context covering this operation?
   → inject the QueryService

3. Neither exists?
   → create a QueryService in the target context (preferred)
     OR extend an existing UseCase if it naturally covers the operation
     (e.g. add optional `ids` filter to ListServicesUseCase)

Never → inject DataSource, Repository, or an Entity class from another context
```

### Applied to each adapter

| Adapter | Injects today | Should inject | Action |
|---|---|---|---|
| `NotificationCustomerAdapter` | `CustomerQueryService` | `CustomerQueryService` | rename only |
| `NotificationStaffAdapter` | `GetStaffByIdUseCase` + `StaffQueryService` | same — two methods, two sources | rename only |
| `NotificationBookingAdapter` | `ServiceInfoAdapter` — check | TBD after review | review |
| `NotificationPlatformAdapter` | `GetTenantByIdUseCase` ✓ | `GetTenantByIdUseCase` | rename only |
| `BookingCustomerAdapter` | `CustomerQueryService` | `CustomerQueryService` | rename only |
| `BookingPlatformAdapter` | `GetTenantByIdUseCase` ✓ + `DataSource` ❌ | `GetTenantByIdUseCase` for both methods | fix DataSource — add `findAllActive` to `TenantQueryService` or use `GetTenantByIdUseCase` |
| `LoyaltyBookingAdapter` | `DataSource` ❌ | `ListServicesUseCase` (extend with optional `ids` filter) | fix DataSource — extend use case |
| `LoyaltyPlatformAdapter` | `GetTenantByIdUseCase` ✓ | `GetTenantByIdUseCase` | rename only |
| `PlatformBookingAdapter` | `BookingQueryService` | `BookingQueryService` | rename only |

### Canonical adapter template

```ts
// loyalty/infrastructure/cross-context/loyalty-booking.adapter.ts
@Injectable()
export class LoyaltyBookingAdapter implements ILoyaltyBookingPort {
  constructor(private readonly listServices: ListServicesUseCase) {}

  async findServicesByIds(tenantId: string, ids: string[]): Promise<ServiceSummary[]> {
    const result = await this.listServices.execute(ids);
    return result.items.map((s) => ({ serviceId: s.id, serviceName: s.name }));
  }
}
```

Rules embedded in the template:
- `@Injectable()` only — no `@Inject()` unless overriding a token
- Constructor injects only **application-layer artifacts** (UseCase or QueryService) from the target context
- Maps the result to the port's own DTO — never exposes a domain aggregate to the caller
- No business logic inside the adapter

---

## Code Fixes Required (beyond renames)

### Fix 1 — `LoyaltyBookingAdapter` (currently `ServiceCatalogAdapter`)

**Problem:** Injects `DataSource` and imports `ServiceEntity` from the booking context directly.

**Fix:** Extend `ListServicesUseCase.execute()` to accept an optional `ids?: string[]` parameter. When provided, call `serviceRepo.findByIds(ids, tenantId)` instead of `findAllByTenant`. The repository method already exists.

```ts
// before
async execute(): Promise<ListServicesUseCaseResult>

// after
async execute(ids?: string[]): Promise<ListServicesUseCaseResult>
```

### Fix 2 — `BookingPlatformAdapter` (currently `ReminderTenantAdapter`)

**Problem:** Injects `DataSource` and imports `TenantEntity` from the platform context to call `findAllActive`.

**Fix:** Add `findAllActive(tenantId?: string): Promise<ActiveTenantInfo[]>` to the platform context's `TenantQueryService` (or create it if absent). Adapter injects `TenantQueryService` instead of `DataSource`.

---

## Acceptance Criteria

- [ ] All cross-context port files follow `[source]-[target-context].port.ts`
- [ ] All symbols follow `[SOURCE]_[TARGET]_PORT` using context names
- [ ] All interfaces follow `I[Source][Target]Port`
- [ ] All adapters are in `infrastructure/cross-context/` and follow `[source]-[target-context].adapter.ts`
- [ ] Zero `DataSource` or `Repository` injections in cross-context adapters
- [ ] Zero imports of Entity classes from another context inside an adapter
- [ ] `booking-platform.port.ts` merges the two previous platform ports from booking
- [ ] `ListServicesUseCase` accepts optional `ids` filter
- [ ] All affected `.spec.ts` and `.integration.spec.ts` files updated
- [ ] `pnpm build` passes with zero circular dependency warnings
