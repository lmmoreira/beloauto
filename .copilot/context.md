# BeloAuto — Agent Context (canonical)

**Symlinked as:** `claude.md`, `gemini.md`  
**Audience:** Any AI coding agent (Claude Code, Copilot CLI, Cursor, Aider, etc.)  
**Rule:** Read this file first on every conversation. Then use §10 to load only the docs you need.  
**Last updated:** 2026-05-19

---

## 0. Permission Protocol (non-negotiable)

Before writing or editing ANY file (`.md`, `.ts`, `.tf`, `.yml`, configs):

1. **Discuss** the change with the user.
2. **Summarise** what you intend to write.
3. **Ask:** "May I now create/update `<path>`?"
4. **Write only after** an explicit yes.

Exceptions: read-only ops (`Read`, `grep`, `ls`, `git status`, memory files).

---

## 1. Project Facts

| Fact | Value |
|---|---|
| **Product** | BeloAuto |
| **Type** | Multi-tenant SaaS — car-wash booking & loyalty |
| **Market** | Brazil 🇧🇷 |
| **Currency** | BRL (R$) — `Money` value object must carry currency code |
| **Locale** | pt-BR (email templates, UI copy, date/number formats) |
| **Default TZ** | `America/Sao_Paulo` (UTC-3); one timezone per tenant via `settings.business_hours.timezone` |
| **Branch** | `main` · Trunk-Based Development · short-lived `feat/UC-xxx` / `fix/xxx` branches |
| **Commits** | Conventional Commits (`feat(booking):`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) |
| **Languages** | TypeScript strict mode — backend + frontend |
| **Backend** | NestJS v11 modular monolith |
| **BFF** | Separate NestJS v11 service (`apps/bff/`) |
| **Frontend** | Next.js 16 + React 19 |
| **Monorepo** | pnpm workspaces (`apps/`, `packages/`) |
| **ORM** | TypeORM v0.3+ |
| **DB** | PostgreSQL 15 — single shared schema, `tenant_id` everywhere |
| **DB migrations** | TypeORM migrations; run via **separate CI job** before deploy — app never auto-migrates at startup |
| **Event bus** | GCP Pub/Sub (prod) · GCP Pub/Sub Emulator (local dev docker-compose) · behind `IEventBus` port |
| **Auth** | Google OAuth 2.0 · JWT sessions (`sub` = backend entity UUID, `tenantId`, `tenantSlug`, `role` in payload) · BFF forwards `X-Actor-ID` / `X-Actor-Type` / `X-Actor-Role` headers to backend |
| **Storage** | S3-compatible (GCS/S3) · paths: `tenants/<tenant_id>/bookings/<booking_id>/<file>` |
| **Observability** | Prometheus + Grafana + OpenTelemetry + Loki + OTel Collector |
| **Container** | Docker · GCP Cloud Run (MVP) → Kubernetes if needed |
| **IaC** | Terraform (GCP provider MVP; cloud-agnostic adapters) |
| **Secrets** | GCP Secret Manager (MVP) → HashiCorp Vault if multi-cloud · `PLATFORM_ADMIN_KEY` (min 32 chars) protects `POST /internal/tenants` |
| **Errors** | RFC 9457 Problem Details on all non-2xx responses |
| **Coverage gate** | ≥ 80% on **changed code** (differential, not global) |
| **Rate limiting** | NestJS `@nestjs/throttler` on all public endpoints |
| **Feature flags** | Environment variables (`FEATURE_FLAG_XYZ=true`) — no external system for MVP |

---

## 2. Multi-Tenancy Invariants (NEVER violate)

Any code that breaks these is a defect regardless of test coverage.

1. Every table has `tenant_id UUID NOT NULL`, indexed first in every composite index.
2. Every query filters `WHERE tenant_id = :tenantId`. No exceptions.
3. Every domain event includes `tenantId`, `eventId` (idempotency key), `occurredAt` (ISO-8601 UTC), `correlationId`.
4. Composite FKs use `(tenant_id, id)` to block cross-tenant references at DB level.
5. **Customers are multi-tenant** — same Google `sub` → multiple `Customer` rows (one per tenant). No unique on `google_oauth_id` alone.
6. **Staff are single-tenant** — `UNIQUE(tenant_id, google_oauth_id)` at DB level.
7. File paths prefixed by tenant (see §1 Storage).
8. Logs, metrics, traces include `tenant_id`. OTel span attrs: `tenant.id`, `user.id`, `correlation.id`.
9. Event consumers are idempotent (at-least-once delivery). Dedup via `eventId`.
10. JWT contains `tenantId`/`tenantSlug`. BFF rejects mismatches.
11. JWT `sub` is always the **backend entity UUID** — `staffId` for STAFF/MANAGER, `customerId` for CUSTOMER (never Google's OAuth `sub`). BFF forwards it as `X-Actor-ID`, along with `X-Actor-Type` (`STAFF`|`CUSTOMER`) and `X-Actor-Role` (`STAFF`|`MANAGER`|`CUSTOMER`). Guest requests carry none of the `X-Actor-*` headers. Backend reads these from `TenantContext`.

Raise a doc bug if a UC appears to violate these — do not "make it work."

---

## 3. Bounded Contexts (brief — load `docs/05-BOUNDED_CONTEXTS.md` for detail)

| Context | Type | Aggregates | Publishes |
|---|---|---|---|
| **Booking** | Core | `Booking`, `Service`, `ScheduleClosure` | `BookingRequested/Approved/Rejected/InfoRequested/InfoSubmitted/Completed/Cancelled/Rescheduled` + `BookingReminderDue`, `BookingReminderDueToday`, `AdminDailyScheduleReminder` |
| **Customer** | Supporting | `Customer` (multi-tenant rows) | — |
| **Staff** | Supporting | `Staff` (single-tenant) | — |
| **Loyalty** | Supporting | `LoyaltyEntry` (append-only, earn-only) | `ServicePointsEarned`, `PointsExpiringSoon` |
| **Notification** | Supporting | `NotificationTemplate`, `NotificationLog` | `EmailSent`, `EmailFailed` |
| **Platform** | Foundational | `Tenant`, `HotsiteConfig` | `TenantProvisioned`, `StaffInvited`, `StaffDeactivated` |

**Loyalty MVP rules (strict):** One immutable `LoyaltyEntry` per `BookingLine` completed. Idempotent via `UNIQUE(tenant_id, booking_line_id)`. Active balance = `SUM(points) WHERE expires_at > now()`. No redemption, no tiers, no manual adjustments.

---

## 4. Event Envelope (every event)

```json
{
  "eventId": "uuid-v7",
  "tenantId": "uuid-v7",
  "occurredAt": "2026-05-11T14:23:45.123Z",
  "correlationId": "uuid-v7",
  "eventName": "BookingCompleted",
  "eventVersion": 1,
  "data": { }
}
```

For full payload definitions → `docs/03-DOMAIN_EVENTS.md`

---

## 5. Booking State Machine

```
PENDING        → INFO_REQUESTED | APPROVED | REJECTED | CANCELLED
INFO_REQUESTED → PENDING (customer responded) | APPROVED | REJECTED | CANCELLED
APPROVED       → COMPLETED | CANCELLED
COMPLETED      (terminal)
REJECTED       (terminal)
CANCELLED      (terminal)
```

`NO_SHOW` is **not** in MVP. UC-014 and UC-015 are **superseded** by UC-021/UC-022 — do not implement.

---

## 6. Use Cases Index (load `docs/04-USE_CASES.md` for detail)

| UC | Title | Status |
|---|---|---|
| UC-001 | Guest requests booking | Active |
| UC-002 | Authenticated customer requests booking | Active |
| UC-003 | Admin approves booking | Active |
| UC-004 | Admin rejects booking | Active |
| UC-005 | Admin requests more info | Active |
| UC-006 | Customer views & manages bookings | Active |
| UC-007 | Customer cancels booking (48 h window from `settings`) | Active |
| UC-008 | Admin cancels / reschedules booking | Active |
| UC-009 | Admin marks booking complete + after-photos | Active |
| UC-010 | Admin closes schedule | Active |
| UC-011 | Guest views calendar availability | Active |
| UC-012 | Admin creates service | Active |
| UC-013 | Admin edits / deactivates service | Active |
| UC-014 | Customer login | **SUPERSEDED by UC-021** |
| UC-015 | Staff login | **SUPERSEDED by UC-022** |
| UC-016 | View customer loyalty metrics | Active |
| UC-017 | Booking analytics | Future — out of MVP |
| UC-018 | Admin daily schedule reminder (6 AM) | Active |
| UC-019 | Customer reminder day-before (6 AM) | Active |
| UC-020 | Customer reminder day-of (6 AM) | Active |
| UC-021 | Customer login + tenant selection | Active (canonical) |
| UC-022 | Staff login — single tenant | Active (canonical) |
| UC-023 | Customer switches tenant | Active |
| UC-024 | Developer provisions new tenant (CLI) | Active |
| UC-025 | Admin first login / accepts invite | Active |
| UC-026 | Admin edits tenant settings | Active |
| UC-027 | Admin manages hotsite content | Active |
| UC-028 | Admin invites new staff member | Active |
| UC-029 | Admin deactivates staff member | Active |

**Missing UCs (do not implement until documented):** Customer profile edit, audit log view, notification template management, failed-notification retry.

---

## 7. Engineering Rules

### Hexagonal layers (per context)
```
src/contexts/<context>/
├── domain/           # entities, value objects, domain events, domain services — zero framework deps
├── application/      # use cases, ports (interfaces), DTOs
└── infrastructure/   # adapters: persistence, REST controllers, event publishers, HTTP clients
```
Shared cross-cutting code → `src/shared/` (logger, OTel, `IEventBus` port, tenant-context).

### Shared utilities and value objects (mandatory rules)

**Utility functions used in more than one place MUST live in `src/shared/utils/`** — never duplicated inline.
Examples already there: `deepMerge` (`src/shared/utils/deep-merge.ts`).

**Fields that carry their own validation MUST be value objects in `src/shared/value-objects/`**, not plain primitives.

| Field | Value Object | File |
|---|---|---|
| Email address | `Email` | `email.vo.ts` |
| Phone number | `PhoneNumber` | `phone-number.vo.ts` |
| Physical address | `Address` | `address.ts` |
| Money amount | `Money` | `money.vo.ts` (future) |
| Hex colour | `HexColor` | `hex-color.vo.ts` |
| IANA timezone | `Timezone` | `timezone.vo.ts` |
| HH:MM time | `TimeOfDay` | `time-of-day.vo.ts` |
| URL-safe slug | `Slug` | `slug.vo.ts` |

Every value object must have a `.spec.ts` unit test covering valid and invalid inputs. Never duplicate a `isValidXxx` function — put it in the VO once.

### Value-object-typed aggregate fields (mandatory — Option A)

Aggregate **props interfaces use VO types**, not plain primitives. **Getters return the VO** — not a derived string. `create()` factory receives raw strings and constructs VOs; `reconstitute()` skips validation for DB reads. JSONB columns require a double cast (`as unknown as XxxProps`).

→ For `create()`/`reconstitute()` code patterns, mapper examples, and in-memory repo comparisons see `docs/VALUE_OBJECTS_REFERENCE.md`.

### Code standards
- `strict: true` TypeScript — no `any`, no `@ts-ignore`, no `// eslint-disable`
- Functions ≤ 20 lines, classes ≤ 200 lines
- Repository signature: `findByTenant(id, tenantId)`, `findAllByTenant(tenantId, filters)`, `save(entity, tenantId)`
- No raw SQL outside repository adapters
- No business logic in controllers — controllers call use cases only
- No direct cross-context calls — data flows through the hierarchy described in "Cross-context data access" below
- DI everywhere — no `new SomeRepository()` in services
- No barrel `index.ts` in `ports/` or `shared/domain/` directories — always import from the specific file (e.g. `./ports/tenant-repository.port`). Test builder barrels (`src/test/builders/`) are the only exception. ESLint `no-restricted-imports` enforces this at CI.
- All configurable values (48 h window, 180 d expiry) read from `tenants.settings`, never hardcoded
- Email templates in pt-BR; Money display as `R$ 1.234,56`
- Domain errors → HTTP status mapping belongs in a `mapXxxError(err: unknown): never` helper in `infrastructure/http/` — never multiple `if (err instanceof X)` chains inside a controller method. The controller method should be one line: `return this.useCase.execute(dto).catch(mapXxxError)`
- **Use case domain error contract (mandatory):** Before writing any use case, define its failure modes as domain errors in `domain/errors/<context>-domain.error.ts` and register them in `infrastructure/http/<context>-error.mapper.ts`. Use cases throw these domain errors for every non-happy-path condition. They **never** return `null`/`undefined` to signal "not found", never throw `HttpException`, and never return a Result/Either type. The controller's `.catch(mapXxxError)` is the sole HTTP translation point — the controller itself contains zero error-checking logic.
- **Use case result type naming (mandatory):** Every use case `execute()` method must return a named exported type following the pattern `{UseCaseClassName}Result` — defined and exported in the same `.use-case.ts` file. Never use `*Info`, `*Dto`, raw arrays (`T[]`), or any other ad-hoc name. Example: `GetTenantByIdUseCase` → `GetTenantByIdUseCaseResult`; `FindOrCreateCustomerUseCase` → `FindOrCreateCustomerUseCaseResult`.
- **Request DTO naming (mandatory):** Input DTOs for use cases and controllers are named `{Action}Dto` — never `{Action}RequestDto`, `{Action}InputDto`, or any other suffix. The Zod schema is named `{Action}Schema`. When a path param must be combined with a request body (e.g. `staffId` from `@Param` + body fields), pass them as **separate arguments** to the use case (`execute(staffId, dto)`) rather than merging into a composite DTO. One DTO per use case — no split `RequestDto` + merged `Dto` pattern.
- Guards that protect a single context's endpoints belong in `src/contexts/<context>/infrastructure/guards/` — only truly cross-cutting guards (used by multiple contexts) go in `src/shared/guards/`
- Every new REST endpoint must have a corresponding request block in `apps/backend/http/<context>/<resource>.http` — include the happy path, all 4xx error cases, and edge cases. Use the existing files as a template.

### Cross-context data access (priority order — follow strictly)

When a use case in Context A needs data owned by Context B, choose the **first** option that applies:

1. **Domain events (preferred — async):** Context B publishes an event; Context A subscribes and projects the data it needs into its own read model. No runtime coupling.
2. **BFF orchestration (preferred — sync read):** The BFF calls both contexts independently and assembles the response. No context knows about the other.
3. **Port + adapter (last resort — sync, same process):** Define an interface (port) in Context A's `application/ports/` (e.g. `ILoyaltyPointsPort`). The infrastructure adapter in Context A implements it by injecting Context B's **service** (never its repository token). Context B must export the service — never the repository.

**None of the above is ever a direct SQL JOIN across schemas inside a repository.** A repository may only query its own context's schema.

```typescript
// ❌ never — Customer repo joining loyalty schema
.leftJoin('loyalty.loyalty_entries', 'le', 'le.customer_id = c.id …')

// ✅ option 3 — port in Customer application layer
export const LOYALTY_POINTS_PORT = Symbol('ILoyaltyPointsPort');
export interface ILoyaltyPointsPort {
  getActivePoints(tenantId: string, customerId: string): Promise<number>;
}
```

**Repository responsibility boundary:** a repository returns only what its own aggregate owns. Fields that belong to another context are assembled by the use case via the appropriate port.

### Transactions (multi-aggregate writes)

Any use case that writes to two or more aggregates **must** wrap all writes in `ITransactionManager.run()`:

```typescript
await this.txManager.run(async () => {
  await this.tenantRepo.save(tenant);
  await this.hotsiteRepo.save(config);
});
```

| Artifact | Location |
|---|---|
| Port | `src/shared/ports/transaction-manager.port.ts` |
| Real adapter | `src/shared/infrastructure/typeorm-transaction-manager.ts` |
| Global module | `src/shared/infrastructure/transaction-manager.module.ts` |
| Test double | `src/test/infrastructure/in-memory-transaction-manager.ts` |
| Context propagation | `src/shared/infrastructure/transaction-context.ts` |

**Repository transaction-awareness:** every TypeORM repo write method checks `getActiveEntityManager()` — if a transaction is active it uses that `EntityManager`, otherwise falls back to `this.repo`. Read methods do not need to be transaction-aware.

### Testing

#### Philosophy — three test layers
| Layer | Tool | What it tests | Speed |
|---|---|---|---|
| Unit | Jest (`.spec.ts`) | Domain logic, use case behaviour, mapping | < 1s per file |
| Integration | Jest (`.integration.spec.ts`) + Testcontainers | Adapter behaviour against a real DB | ~30s total (singleton container) |
| E2E | Playwright | Happy paths through the full stack | minutes |

- TDD for domain logic — red-green-refactor
- Every UC: ≥1 unit test, ≥1 integration test, ≥1 tenant-isolation test
- Tenant-isolation test pattern: create data for Tenant A, attempt access as Tenant B → expect 404/403
- E2E (Playwright): happy paths only
- No `.skip()`, `.only()`, `setTimeout` in tests

#### Test Data Builder pattern (mandatory)
Never construct domain objects inline in tests. Use builders in `src/test/builders/<context>/`.

- One builder class per aggregate / value object / TypeORM entity
- Sensible defaults for every field — tests only set what they care about
- Builders live in `src/test/builders/<context>/index.ts` (barrel export)
- **Every TypeORM entity used in a test MUST have an `XxxEntityBuilder`** — never construct entity objects inline with `makeXxx()` helpers or plain object literals.
- Naming: `CustomerEntityBuilder`, `TenantEntityBuilder`, `StaffEntityBuilder`, etc.
- **The `id` field in every `XxxEntityBuilder` MUST default to `uuidv7()`** — never a hardcoded string.

#### In-memory repository pattern (for use case tests)
Each port has two implementations: the real TypeORM adapter and a test double.
In-memory repos live in `src/test/repositories/<context>/`. Use them in use case unit tests — no DB needed.

**Do NOT delete TypeORM adapter unit tests** — they provide coverage that SonarCloud requires (integration test coverage is not merged into the lcov report).

**SonarCloud only ingests lcov from unit tests** (`--selectProjects unit`). Every new controller and use case must have a `.spec.ts` unit test to satisfy the ≥ 80% new-code threshold — integration tests alone are not sufficient.

#### In-memory infrastructure test doubles

Every shared port that produces side effects has an in-memory double in `src/test/infrastructure/`. **Always prefer these over `jest.fn()` mocks.**

**Controller unit tests** should wire the real use case with an `InMemoryXxxRepository` rather than mocking the use case with `jest.fn()`. Exception: when a dependency has no in-memory double (e.g. `BackendHttpService` in BFF controllers), `jest.fn()` is correct.

| Port | In-memory double | Key feature |
|---|---|---|
| `IEventBus` | `InMemoryEventBus` | `published: DomainEvent[]` — assert on `.published` array |
| `ITransactionManager` | `InMemoryTransactionManager` | Simply calls `work()` — no real transaction needed |

#### Integration test rules
- **Singleton Testcontainers** — one PostgreSQL container per `jest --selectProjects integration` run, started in `src/test/integration-global-setup.ts` via Jest `globalSetup`. Never create a container inside a test file.
- **Story-based tests** — each `it()` tells a meaningful sequence of domain operations. Avoid narrow method-verification tests.
- **File-local slug prefixes** — each integration file uses unique slugs to avoid UNIQUE constraint conflicts.
- Each integration spec calls `createTestDataSource()` in `beforeAll` and `dataSource.destroy()` in `afterAll`.

### CI gates (block merge)
- ESLint + Prettier — zero warnings
- `tsc --noEmit` — zero errors
- All tests pass — 100%
- Coverage ≥ 80% on changed code
- SonarCloud Quality Gate GREEN
- Snyk SCA — zero high/critical vulns
- Gitleaks — zero secrets detected
- Trivy image scan — zero high/critical
- Checkov/Tfsec IaC scan — zero high

### Definition of Done
- [ ] Matches cited UC's main + alt flows
- [ ] Unit + integration + tenant-isolation tests pass
- [ ] Coverage delta ≥ 80% on changed code
- [ ] All queries filter by `tenant_id`
- [ ] All events use standard envelope with `tenantId`, `eventId`, `correlationId`
- [ ] No hardcoded config values — read from `tenants.settings`
- [ ] No secrets in code
- [ ] Migration is backward-compatible (expand/contract)
- [ ] CI passes locally: `pnpm lint`, `pnpm test`, `pnpm type-check`
- [ ] API change reflected in `docs/14-API_CONTRACTS.md` (with permission)
- [ ] Conventional Commit + PR description links the UC

---

## 8. Anti-Patterns (BLOCK MERGE)

| Pattern | Problem | Fix |
|---|---|---|
| `WHERE id = ?` without `tenant_id` | Cross-tenant data leak | Add `AND tenant_id = ?` |
| Event missing `tenantId` in envelope | Can't isolate per tenant | Include in every event |
| Hardcoded `48`, `180`, `7` for business rules | Breaks per-tenant config | Read from `tenants.settings` |
| `@ts-ignore`, `any`, `eslint-disable` | Defeats static analysis | Fix the type/lint error |
| `.skip()` / `.only()` in tests | Hides failures in CI | Remove before commit |
| Synchronous call from Loyalty → Booking | Tight coupling | Subscribe to `BookingCompleted` event |
| `new XRepository()` inside a service | Untestable | Inject via DI |
| Same template body for all tenants | Breaks branding | Templates are per-tenant aggregates |
| Photo stored at `bookings/<id>/` without tenant prefix | No isolation | Path: `tenants/<tid>/bookings/<bid>/<file>` |
| Logging without `tenant_id` | Can't slice per-tenant | Add to structured log context |
| Running migrations at app startup | Unsafe for rolling deploys | Run as separate CI job before deploy |
| English copy in email templates | Wrong locale | All customer-facing text in pt-BR |
| Money as plain `number` | Loses currency | Use `Money { amount: Decimal, currency: 'BRL' }` |
| Import from `src/contexts/<B>/` inside Context A | Breaks context isolation | Only import from `src/shared/` or own context |
| SQL JOIN into another context's schema inside a repository | Hardest coupling — defeats schema independence, blocks port swapping | Repository queries its own schema only; cross-context data via events, BFF, or port+adapter (see §7) |
| Cross-schema DB FK between contexts | Tight schema coupling | Store UUID only; no FK constraint across schemas |
| Event consumer querying another context to fill missing data | Defeats self-contained events | Add the needed data to the event payload |
| Placing a domain entity or use case in `src/shared/` | Blurs context ownership | Only ports, base classes, and multi-context VOs in shared |
| Exporting repository tokens from a `*.module.ts` | Makes repo injectable cross-module — BC isolation violation | Never export repository tokens; use BFF orchestration, events, or shared read-only port |
| Writing to two or more aggregates without `ITransactionManager.run()` | Partial DB failure leaves inconsistent state | Wrap all writes in `txManager.run(async () => { ... })` |
| Using `jest.fn()` to stub `IEventBus` or `ITransactionManager` | Misses state assertions; mock expectations are brittle | Use `InMemoryEventBus` / `InMemoryTransactionManager` from `src/test/infrastructure/` |
| Multiple `if (err instanceof X)` chains inside a controller method | Noisy, inflates cognitive complexity | Extract into a `mapXxxError(err: unknown): never` helper in `infrastructure/http/` |
| Placing a context-specific guard in `src/shared/guards/` | Misleads future agents — implies cross-cutting | Guards for a single context live in `src/contexts/<context>/infrastructure/guards/` |
| Barrel `index.ts` in `ports/` or `shared/domain/` directories | Hides symbol origins; circular dep risk | Import directly from the specific file; `no-restricted-imports` ESLint rule enforces this |
| Single `DATABASE_URL` connection string for TypeORM | Passwords with special chars (`@`, `:`, `/`) break silently | Use five explicit vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| `TypeOrmModule.forRoot({ … process.env['X'] … })` | Env vars are `undefined` at import time (before dotenv) | Use `TypeOrmModule.forRootAsync({ useFactory: () => ({ … }) })` |
| `{{$env varName}}` in `.http` REST Client files | Reads OS env — REST Client vars live in `.vscode/settings.json`; resolves to empty string | Use `{{varName}}` for REST Client env vars; `{{$dotenv VAR}}` only for `.env` secrets |
| Duplicating a validation function (`isValidEmail`, `isValidTimezone`, etc.) across files | Two copies diverge silently | Extract into a shared value object in `src/shared/value-objects/` |
| Storing email, phone, address, money, colour as a plain `string` / `number` | Invalid values reach the domain silently | Wrap in a value object that validates on construction |
| Duplicating a utility function (deep merge, formatting, etc.) | Two copies diverge | Extract into `src/shared/utils/` |
| Aggregate field typed as `string` when a shared VO exists | Type system lies — invalid values stored in props | Type props with the VO; getters return the VO |
| `makeEntity()` helper or plain object literal used in a test | Couples test to TypeORM entity constructor; bypasses builder pattern | Create an `XxxEntityBuilder` in `src/test/builders/<context>/` |
| Seed file calling `CREATE TABLE`, `CREATE SCHEMA`, or `DROP TABLE` | Drift from migrations | Seeds are data-only; schema owned 100% by TypeORM migrations |
| `XxxEntityBuilder` with a hardcoded default `id` | Second `save()` silently upserts over first — isolation assertions fail | Default `id` to `uuidv7()` in every `XxxEntityBuilder` constructor |
| Controller directly injecting a repository token | Bypasses use-case layer — domain errors never thrown, HTTP mapping skipped | Controllers inject use cases only |
| `jest.fn()` mock for a use case in a controller unit test | Hides real behaviour; tests only delegation | Wire the real use case with `InMemoryXxxRepository` |
| Exporting constants or helpers from `main.ts` | `import { X } from '../main'` triggers bootstrap / `process.exit(1)` in tests | Move shared constants to a dedicated module file; `main.ts` may re-export them |
| Inline `schema.safeParse(body)` inside a controller method | Inconsistent with `ZodValidationPipe` + DTO pattern; loses typed `@Body()` | Define schema + `z.infer<>` type in `application/dtos/`; apply `@UsePipes(new ZodValidationPipe(schema))` |
| `z.string().uuid()` / `z.string().url()` | Deprecated in Zod v4 (SonarCloud S1874); `z.uuid()` rejects non-RFC-4122 test UUIDs | Use `z.uuid()` and `z.url()` directly; use RFC 4122-compliant UUIDs: `'10000000-0000-4000-8000-000000000001'` |
| Declaring a dynamic route (`@Get(':id')`) before a static route | NestJS resolves in declaration order — dynamic matches first | Always declare static/prefix routes first, then parameterized ones |
| Use case returns `null` / `undefined` instead of throwing a domain error | Controller must inspect the return value and decide HTTP status — business logic in the wrong layer | Use cases always throw domain errors (`StaffNotFoundError`, `StaffAlreadyActiveError`, etc.) for every non-happy-path; controller is one line: `return this.useCase.execute(dto).catch(mapXxxError)` |
| Throwing `HttpException` directly from a use case | Couples the application layer to HTTP — use cases must be framework-agnostic | Throw domain errors only; `mapXxxError` in the infrastructure layer converts them to `HttpException` |
| Non-UUID string (e.g., `'non-existent-id'`) as path/query param for a PostgreSQL UUID column | PostgreSQL throws `QueryFailedError: invalid input syntax for type uuid` → 500 instead of expected 404/400 | Add `ParseUUIDPipe` to every `@Param`/`@Query` that maps to a UUID column; in integration tests, use valid-UUID-format IDs for non-existent cases (e.g., `'10000000-0000-4000-8000-999999999999'`) |
| Integration test `it()` with only supertest `.expect(status)` and no Jest `expect()` call | SonarCloud S6957 BLOCKER — supertest's `.expect()` is invisible to Jest's assertion counter | Every `it()` must have at least one `expect()` call: `const { body } = await request(app)…expect(404); expect(body.status).toBe(404)` |
| `.catch(() => null)` on BFF backend HTTP calls | Swallows 5xx errors and timeouts — a backend outage silently misdirects users (e.g., shows `tenant-not-found` when the DB is down) | Only catch the expected failure status: `.catch(err => { if (err instanceof HttpException && err.getStatus() === HttpStatus.NOT_FOUND) return null; throw err; })` |
| `new Error('msg')` to mock `BackendHttpService` errors in BFF tests | Plain `Error` is not caught by `instanceof HttpException` checks; the real service always wraps non-2xx responses as `HttpException` | Mock errors as `new HttpException('Not Found', 404)` to match real service behaviour |
| Use case `execute()` return type named `*Info`, `*Dto`, raw `T[]`, or any ad-hoc name | Callers can't predict the type name from the class name; codebase surface becomes inconsistent | Name the result `{UseCaseClassName}Result`; define and export it in the same `.use-case.ts` file |
| Request DTO named `{Action}RequestDto`, `{Action}InputDto`, or any suffix other than `Dto` | Inconsistent naming — callers can't predict the DTO name | Use `{Action}Dto` only; Zod schema is `{Action}Schema` |
| Split DTO pattern: `{Action}RequestDto` (body) + `{Action}Dto` (body + path param) merged via `{ pathParam, ...dto }` | Two types for one use case input — unnecessary complexity | Pass path param and body as separate arguments: `execute(pathParam, dto)` |

---

## 9. Story Implementation Workflow (mandatory — every story, no exceptions)

Every story follows this sequence. Skipping steps — especially branch creation — is a defect in agent behaviour.

### Step 1 — Create feature branch (BEFORE writing any code)
`git checkout -b feat/M0X-SYY-<short-description>`

Never write code on `main`. If you are already on `main` with uncommitted changes, stash first.

### Step 2 — Implement the story
Write all files defined in the story spec. See §0 for permission rules (code files = autonomous once story is approved; `.md` / architecture docs still require explicit approval).

### Step 3 — Verify locally before committing
Run type-check, lint, and jest for the changed context — zero errors and warnings required.

### Step 4 — Commit with Conventional Commit
Stage specific files only (never `git add -A` or `git add .`). Message format:
```
feat(<context>): <description> (M0X-SYY)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Step 5 — Push (pre-push hook runs `ci:fast` automatically)
`git push -u origin feat/M0X-SYY-<short-description>`

`ci:fast` = lint + prettier + type-check + unit tests (~15 s). If it fails the push is blocked. Fix, re-commit, re-push.

### Step 6 — Run `ci:local` (optional — developer decides)
`pnpm ci:local` (~5 min, Docker must be running). Not mandatory — GitHub CI catches the same issues. Run when touching Dockerfiles, infra, or integration-test paths.

### Step 7 — Self-review the full diff (MANDATORY — before every PR)

Run `/pre-pr` — must report **zero issues** before the PR is opened. This skill runs all 14 checks (framework imports, transaction wrapping, .http blocks, return types, VO typing, EntityBuilders, ZodValidationPipe, SonarCloud patterns, and domain-audit) against the branch diff.

### Step 8 — Open the PR
```bash
gh pr create \
  --title "feat(<context>): <description> (M0X-SYY)" \
  --body "## Summary
- <bullet>

## Story
M0X-SYY — <title>

## Test plan
- [ ] Unit tests pass
- [ ] Type-check clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)" \
  --repo lmmoreira/beloauto
```

### Step 9 — Monitor CI; self-fix any failure
```bash
gh pr checks <PR-number> --repo lmmoreira/beloauto
gh run view <run-id> --repo lmmoreira/beloauto --log-failed
```
Fix → commit → push → re-check. Loop until all checks are green.

### Step 10 — Ask user before merging (MANDATORY)
Once all CI checks are green, report the result and ask:
> "All checks are green on PR #N. Have you reviewed it and are you happy to merge?"

**Never merge without explicit user confirmation.** Only after they say yes:
```bash
gh pr merge <PR-number> --repo lmmoreira/beloauto --squash --delete-branch
git checkout main && git pull origin main
```

### Step 11 — Mark story done (only after the squash commit is on `main`)
Run `/mark-done M0X-SYY`. The skill updates the plan file, commits to main, and alerts if all stories in the milestone are now done.

### Step 12 — Milestone complete? Create wrap-up docs
If every story in the milestone is now `✅ Done`, see §15 item 15 for the two wrap-up files to create.

---

## 10. Dynamic Context Loading — Load Only What You Need

**Always start with this file.** Then use the table below to load only the docs relevant to your task.

| Task | Docs to load | ~KB |
|---|---|---|
| Quick clarification | This file only | 0 |
| Implement a UC | `docs/04-USE_CASES.md` (that UC's section) + `docs/02-DOMAIN_MODEL.md` (relevant aggregate) + `docs/03-DOMAIN_EVENTS.md` (relevant events) | 4–6 |
| Database / migration | `docs/13-DATABASE_SCHEMA.md` + `docs/02-DOMAIN_MODEL.md` (relevant aggregate) | 4 |
| API endpoint | `docs/14-API_CONTRACTS.md` + the cited UC | 3–5 |
| Event handler | `docs/03-DOMAIN_EVENTS.md` (event) + `docs/05-BOUNDED_CONTEXTS.md` (context) | 3 |
| Hotsite / public frontend | `docs/15-HOTSITE_DYNAMIC_ARCHITECTURE.md` + `docs/14-API_CONTRACTS.md` (tenants section) + `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md` (folder structure) | 4 |
| Dashboard / admin frontend | `docs/16-DASHBOARD_FRONTEND_ARCHITECTURE.md` + `docs/14-API_CONTRACTS.md` | 3 |
| BFF implementation | `docs/24-BFF_ARCHITECTURE.md` + `docs/14-API_CONTRACTS.md` | 4 |
| Architecture question | `docs/11-ARCHITECTURE.md` + `docs/05-BOUNDED_CONTEXTS.md` | 5 |
| Multi-tenancy / isolation | `docs/06-TENANT_ISOLATION_STRATEGY.md` | 2 |
| Testing patterns | `docs/08-TESTING_STRATEGY.md` | 3 |
| Value objects / aggregate mappers | `docs/VALUE_OBJECTS_REFERENCE.md` | 1 |
| CI / pipelines | `docs/09-CI_CD_PIPELINE.md` + `docs/17-GITHUB_WORKFLOWS_GUIDELINES.md` | 4 |
| Deployment / infra | `docs/12-DEPLOYMENT_STRATEGY.md` + `docs/22-TECH_STACK_DECISIONS.md` | 5 |
| Observability | `docs/10-OBSERVABILITY_STRATEGY.md` | 2 |
| Full feature (UC + API + DB + tests) | All of the above relevant rows | 12–18 |
| Working on M01+ (any backend/BFF/web task) | `plan/M00-MONOREPO-FOUNDATION_IMPLEMENTATION_DETAILS_IA.md` — version gotchas, stubs, CJS/ESM decisions, seed UUIDs, testing setup | 3 |
| Working on M02+ (any task touching CI, Dockerfiles, or deployment) | `plan/M01-CI-QUALITY-GATES_IMPLEMENTATION_DETAILS_IA.md` — workflow job map, Dockerfile gotchas (pnpm deploy, --ignore-scripts, npm removal, .next/.dist copy), Checkov path-filter, local vs CI gate coverage, required GitHub Secrets | 2 |
| Working on M03+ (any task touching Platform context, TenantContext, TypeORM setup, settings, deepMerge, or REST Client HTTP files) | `plan/M02-PLATFORM-CONTEXT_IMPLEMENTATION_DETAILS_IA.md` — DB_* vars, forRootAsync timing, AsyncLocalStorage TenantContext, ManagerRoleGuard stub, deepMerge null/array behaviour, error mapper pattern, test builders | 3 |
| Working on M04+ (any task touching auth, BFF guards, OAuth flow, customer/staff login, JWT, tenant switching, Zod validation, or BFF→backend internal calls) | `plan/M03-AUTHENTICATION_IMPLEMENTATION_DETAILS_IA.md` — OAuth state encoding (`__staff__` vs slug vs empty), `passReqToCallback` signature, `JWT_COOKIE_OPTIONS` location, `FindOrCreate` flow, switch-tenant 3-call pattern, `mapXxxError` + dedicated mapper spec, optional-chain SonarCloud S6582, `BackendHttpService` jest.fn() pattern, Zod v4 UUID format | 3 |

**Never load:** anything under `docs/archive/` — superseded content.  
**Never load:** `plan/*_DEVELOPER.md` files — written for the human developer, not for agents.

---

## 11. Repository Layout

### Monorepo (pnpm workspaces)
```
.
├── apps/
│   ├── backend/          # NestJS modular monolith
│   │   └── src/contexts/ # booking/ customer/ staff/ loyalty/ notification/ platform/
│   ├── bff/              # NestJS BFF (separate service, own container)
│   └── web/              # Next.js 14 (hotsite + dashboard)
├── packages/
│   ├── types/            # shared TypeScript types / DTOs
│   └── config/           # shared ESLint, tsconfig, Prettier configs
├── infrastructure/
│   └── terraform/        # GCP resources (Cloud Run, Cloud SQL, Pub/Sub, Secret Manager)
├── .github/workflows/    # CI/CD pipeline YAML files
├── docker/               # Dockerfiles + docker-compose.yml (local dev)
├── .copilot/context.md   # THIS FILE
├── claude.md             # → symlink to .copilot/context.md
├── CLAUDE.md             # Claude Code project instructions
└── docs/                 # source of truth documentation (see §10)
```

### Per-context structure (inside `apps/backend/src/contexts/<context>/`)
```
├── domain/           # entities, value objects, events, domain services (no framework)
├── application/      # use cases, port interfaces, DTOs
└── infrastructure/   # adapters: TypeORM repos, REST controllers, Pub/Sub publishers, HTTP clients
    └── migrations/   # TypeORM migrations scoped to this context's schema
```

### Shared folder — cross-cutting concerns ONLY (`apps/backend/src/shared/`)
```
src/shared/
├── ports/            # IEventBus, IEmailSender, IRepository<T>
├── domain/           # AggregateRoot, DomainEvent, ValueObject (base classes)
├── value-objects/    # Money, Address (used by multiple contexts)
├── tenant/           # TenantContext (request-scoped), TenantInterceptor
├── observability/    # Logger, OTel tracer, structured log helpers
└── http/             # Pagination DTOs, RFC 9457 ProblemDetail base type
```

**Rule:** A context module MUST NOT import from another context's path. Only `src/shared/` is importable across contexts. Domain objects (entities, aggregates, use cases, repositories) are NEVER in shared.

---

## 12. Open Decisions (stop and ask before implementing)

Only truly unresolved items remain here:

1. **Multi-location (post-MVP):** Multiple locations per tenant = separate tenants or sub-tenant model?

---

## 14. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A car-wash company on the platform. Unit of isolation. |
| **Slug** | URL-safe tenant identifier (e.g. `lavacar-belo`). Globally unique. |
| **BFF** | Backend-for-Frontend — separate NestJS service, sole entry point for the web layer. |
| **Hotsite** | Public unauthenticated tenant-branded marketing + booking page. |
| **Hotsite Manifest** | JSON with branding + module layout served to the frontend per tenant slug. |
| **Port** | Interface owned by the application layer (e.g. `IBookingRepository`). |
| **Adapter** | Infrastructure implementation of a port (e.g. `TypeOrmBookingRepository`). |
| **Tenant Context** | Request-scoped object holding active `tenantId`, injected by `TenantInterceptor`. |
| **Idempotent consumer** | Event handler whose effect is identical whether the message arrives 1 or N times. |
| **Composite FK** | Multi-column FK `(tenant_id, id)` blocking cross-tenant DB references. |
| **Expand/Contract** | Two-phase migration pattern safe for rolling deploys. |

---

## 15. Self-Check Before Submitting

> **BEFORE WRITING ANY CODE:** Create a feature branch first — `git checkout -b feat/M0X-SYY-<description>`. Never code directly on `main`. See §9 for the full workflow.

1. Did I read this file at the start of the conversation? ✓
2. Did I get permission before writing any file? ✓
3. Does every query / event / log include `tenant_id`? ✓
4. Is the change scoped to one UC cited in the PR? ✓
5. Does coverage delta stay ≥ 80% on changed code? ✓
6. Did I follow Conventional Commits? ✓
7. Did I check §12 (Open Decisions) and stop on anything unresolved? ✓
8. Are functions ≤ 20 lines, no `any`, no hardcoded config values? ✓
9. Is all customer-facing text in pt-BR, money in BRL? ✓
10. Does the integration test include a tenant-isolation assertion? ✓
11. Did `/pre-pr` report zero issues before opening the PR? ✓
12. Did I run `pnpm ci:fast` before pushing? (auto-runs via pre-push hook if `git config core.hooksPath .githooks` is set) ✓
13. (Optional) Did I run `pnpm ci:local` if the change touches Dockerfiles, infra, or integration-test paths? ✓
14. After opening the PR, did I verify all CI checks passed (`gh pr checks <N> --repo lmmoreira/beloauto`)? If any failed — fix, commit, push, re-verify. Once all checks are green, merge: `gh pr merge <N> --repo lmmoreira/beloauto --squash --delete-branch`. ✓
15. After merging, did I run `/mark-done M0X-SYY`? ✓
16. Are ALL stories in this milestone now `✅ Done`? If yes — create both wrap-up files:
    - `plan/MXX-<NAME>_IMPLEMENTATION_DETAILS_IA.md` — token-efficient reference for AI agents: artifacts table, critical gotchas, version facts, structural decisions. No prose, no tutorials.
    - `plan/MXX-<NAME>_IMPLEMENTATION_DETAILS_DEVELOPER.md` — detailed learning doc for the human developer: every concept explained with rationale, real code examples from this codebase, enough depth that a developer can learn NestJS, DDD, and the engineering patterns used here just by reading it.
    - Add the IA file to §10 of this file. ✓

---

## 17. Project Slash Commands (Claude Code)

Commands live in `.claude/commands/`. Claude Code auto-discovers them — type `/` to see the list. Other agents (Cursor, Copilot, Gemini) don't execute these, but knowing they exist helps them suggest the right workflow.

| Command | File | When to use |
|---|---|---|
| `/pre-pr` | `.claude/commands/pre-pr.md` | **Before every PR** — runs all 14 checks (framework imports, transactions, .http blocks, return types, VO typing, EntityBuilders, ZodValidationPipe, SonarCloud patterns) + domain-audit. Must report zero issues. |
| `/domain-audit [context-path]` | `.claude/commands/domain-audit.md` | Structural VO/builder scan. Called automatically by `/pre-pr`; run standalone for a quicker focused check. |
| `/mark-done M0X-SYY` | `.claude/commands/mark-done.md` | **After merge to main** — marks the story `✅ Done` in the plan file, commits, and alerts if the milestone is now complete. |

**Adding new commands:** create `.claude/commands/<name>.md`. Use `$ARGUMENTS` as the placeholder for optional user-typed arguments. Document it in this table.
