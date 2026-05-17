# M02 — Implementation Details for AI Agents

**Audience:** AI coding agents working on M03 and beyond.  
**Purpose:** Avoid re-learning what M02 already solved. Read when touching the Platform context, TenantContext, TypeORM setup, or REST Client HTTP files.  
**Companion:** Always read `CLAUDE.md` first. Then load this file when working on any M03+ story that touches tenants, auth, or settings.

---

## 1. What M02 Built (quick reference)

| Artifact | Location | Notes |
|---|---|---|
| Tenant aggregate | `src/contexts/platform/domain/tenant.aggregate.ts` | `create()`, `updateSettings()`, `updateName()`, `deactivate()` — all guard `isActive` |
| HotsiteConfig aggregate | `src/contexts/platform/domain/hotsite-config.aggregate.ts` | Created atomically with Tenant via `ITransactionManager` |
| TenantSettings value object | `src/contexts/platform/domain/value-objects/tenant-settings.vo.ts` | Full validation in `create()`, defaults in `default()`, no-validation in `reconstitute()` |
| Platform domain errors | `src/contexts/platform/domain/errors/platform-domain.error.ts` | `PlatformDomainError`, `SlugAlreadyTakenError`, `TenantNotFoundError`, `TenantInactiveError` |
| Domain events | `src/contexts/platform/domain/events/` | `TenantProvisioned`, `StaffInvited`, `StaffDeactivated` |
| ITenantRepository port | `src/contexts/platform/application/ports/tenant-repository.port.ts` | `findBySlug`, `findById`, `save`, `existsBySlug` |
| IHotsiteConfigRepository port | `src/contexts/platform/application/ports/hotsite-config-repository.port.ts` | `findByTenantId`, `save` |
| TypeORM entities | `src/contexts/platform/infrastructure/entities/` | `TenantEntity`, `HotsiteConfigEntity` |
| TypeORM repositories | `src/contexts/platform/infrastructure/repositories/` | `TypeOrmTenantRepository`, `TypeOrmHotsiteConfigRepository` |
| DB migrations | `src/contexts/platform/infrastructure/migrations/` | `CreatePlatformTenants`, `CreatePlatformHotsiteConfigs` |
| PlatformModule | `src/contexts/platform/platform.module.ts` | Imports `TenantModule` — never exports repository tokens |
| TenantContext | `src/shared/tenant/tenant-context.ts` | AsyncLocalStorage-based, not request-scoped DI |
| TenantInterceptor | `src/shared/tenant/tenant.interceptor.ts` | Skips `/health` and `/internal` — reads `X-Tenant-ID` header |
| TenantModule | `src/shared/tenant/tenant.module.ts` | Exported from AppModule; also imported by PlatformModule — safe due to shared AsyncLocalStorage |
| PlatformAdminGuard | `src/contexts/platform/infrastructure/guards/platform-admin.guard.ts` | `crypto.timingSafeEqual` + SHA-256 normalisation |
| ManagerRoleGuard | `src/contexts/platform/infrastructure/guards/manager-role.guard.ts` | **Stub — always returns true.** M03-S05 must enforce real MANAGER check via `X-Actor-Role` header |
| platform-error.mapper.ts | `src/contexts/platform/infrastructure/http/platform-error.mapper.ts` | Maps `SlugAlreadyTakenError`→409, `TenantInactiveError`→409, `TenantNotFoundError`→404, `PlatformDomainError`→400 |
| ProvisionTenantUseCase | `src/contexts/platform/application/use-cases/provision-tenant.use-case.ts` | Writes Tenant + HotsiteConfig atomically; publishes `TenantProvisioned` |
| InternalTenantController | `src/contexts/platform/infrastructure/controllers/internal-tenant.controller.ts` | `POST /internal/tenants` — guarded by `PlatformAdminGuard` |
| UpdateTenantSettingsUseCase | `src/contexts/platform/application/use-cases/update-tenant-settings.use-case.ts` | Deep-merges partial settings; checks `isActive` via domain |
| TenantSettingsController | `src/contexts/platform/infrastructure/controllers/tenant-settings.controller.ts` | `PATCH /tenants/settings` — reads `tenantId` from `TenantContext` |
| deepMerge utility | `src/shared/utils/deep-merge.ts` | Wraps `deepmerge` npm package; `DeepPartial<T>` typed; arrays replaced not concatenated |
| HTTP test files | `apps/backend/http/platform/` | `internal-tenants.http`, `tenant-settings.http` |
| Test builders | `src/test/builders/platform/` | `TenantBuilder`, `HotsiteConfigBuilder`, `TenantSettingsPropsBuilder`, `TenantEntityBuilder`, `HotsiteConfigEntityBuilder` |
| In-memory repos | `src/test/repositories/platform/` | `InMemoryTenantRepository`, `InMemoryHotsiteConfigRepository` |
| deepMerge utility | `src/shared/utils/deep-merge.ts` | Wraps `deepmerge` npm package; `DeepPartial<T>` typed — **import from here, never re-implement** |
| Email value object | `src/shared/value-objects/email.vo.ts` | `Email.isValid(str)` + `Email.create(str)` — **import from here for all email validation across all contexts** |

---

## 2. Critical Gotchas

**#1 — TypeORM connection: use explicit DB_* vars, never DATABASE_URL**  
Passwords from GCP Secret Manager contain arbitrary chars (`@`, `:`, `/`) that break URL parsing silently. Always use:
```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
```
Never `DATABASE_URL`.

**#2 — TypeOrmModule.forRootAsync, never forRoot**  
`forRoot({ … process.env['X'] … })` evaluates at import time, before dotenv runs → always `undefined`. Use `forRootAsync({ useFactory: () => ({ … }) })` — factory runs during DI build, after dotenv.

**#3 — REST Client HTTP files: `{{varName}}` not `{{$env varName}}`**  
`$env` reads OS-level env vars. REST Client environment values (e.g. `backendUrl`) live in `.vscode/settings.json`. Always use `{{backendUrl}}` for REST Client vars and `{{$dotenv VAR}}` only for `.env` secrets (e.g. `PLATFORM_ADMIN_KEY`).

**#4 — TenantContext is AsyncLocalStorage, not request-scoped DI**  
`TenantContext` holds no state itself — it delegates to a module-level `AsyncLocalStorage<TenantStore>`. This means:
- Importing `TenantModule` in both `AppModule` and `PlatformModule` is safe — both `TenantContext` instances share the same storage.
- No `REQUEST` scope needed — AsyncLocalStorage propagates through async chains automatically.
- `TenantInterceptor` calls `runWithTenantContext(tenantId, correlationId, () => next.handle().subscribe(subscriber))` to bind the store to the request.

**#5 — PlatformAdminGuard: SHA-256 before timingSafeEqual**  
`timingSafeEqual` requires equal-length buffers. Rather than padding, we hash both sides with SHA-256 first. This also prevents key-length leaks (different-length tokens take the same time to compare).

**#6 — ManagerRoleGuard is a stub**  
`apps/backend/src/contexts/platform/infrastructure/guards/manager-role.guard.ts` always returns `true`. M03-S05 must replace this with a real check on `TenantContext.actorRole` (populated from `X-Actor-Role` header forwarded by BFF). See M03-AUTHENTICATION.md §M03-S05 for the full contract.

**#7 — TenantInactiveError is enforced at the domain level**  
`Tenant.updateSettings()` and `Tenant.updateName()` both throw `TenantInactiveError` if `isActive=false`. This means no use case can bypass it — even future use cases that add update operations must also call these domain methods.

**#8 — deepMerge: null overrides are preserved, arrays are replaced**  
`deepMerge({ saturday: { open:'09:00', close:'17:00' } }, { saturday: null })` → `{ saturday: null }`.  
`deepMerge({ layout: ['HERO','GALLERY'] }, { layout: ['HERO'] })` → `{ layout: ['HERO'] }`.  
This is important for business_hours day closure and HotsiteConfig layout updates.

**#9 — PlatformModule never exports repository tokens**  
Repository tokens (`TENANT_REPOSITORY`, `HOTSITE_CONFIG_REPOSITORY`) are only injected within PlatformModule's own providers. Cross-context data flows through BFF orchestration or domain events. Never add these to `exports`.

**#10 — TenantSettings.create() validates; reconstitute() does not**  
Use `TenantSettings.create(props)` when receiving user input (runs full validation).  
Use `TenantSettings.reconstitute(props)` when loading from DB (skips validation — data was already validated on write).

---

## 3. DB Schema (platform schema)

```sql
-- platform.tenants
id          UUID PRIMARY KEY
name        VARCHAR(255) NOT NULL
slug        VARCHAR(100) NOT NULL UNIQUE
settings    JSONB NOT NULL DEFAULT '{}'
is_active   BOOLEAN NOT NULL DEFAULT true
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()

-- platform.hotsite_configs
id           UUID PRIMARY KEY
tenant_id    UUID NOT NULL REFERENCES platform.tenants(id)
branding     JSONB NOT NULL DEFAULT '{}'
layout       JSONB NOT NULL DEFAULT '[]'
is_published BOOLEAN NOT NULL DEFAULT false
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(tenant_id)
```

---

## 4. Request Flow (authenticated backend request)

```
BFF (M03) → X-Tenant-ID, X-Actor-ID, X-Actor-Type, X-Actor-Role headers
  → TenantInterceptor → runWithTenantContext(tenantId, correlationId, ...)
  → TenantContext.tenantId / .actorId / .actorType / .actorRole available anywhere in the call chain
  → Controller reads TenantContext.tenantId → passes to use case
  → Use case queries repo with tenantId → domain logic → save
```

Guest / internal routes skip `TenantInterceptor` (bypass paths: `/health`, `/internal`).

---

## 5. Environment Variables Added in M02

| Var | Required | Notes |
|---|---|---|
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (default 5432) |
| `DB_USER` | Yes | PostgreSQL username |
| `DB_PASSWORD` | Yes | PostgreSQL password — may contain special chars |
| `DB_NAME` | Yes | PostgreSQL database name |
| `PLATFORM_ADMIN_KEY` | Yes | Min 32 chars — protects `POST /internal/tenants` |

---

## 6. Test Patterns Established in M02

**Unit tests** use:
- `InMemoryTenantRepository` + `InMemoryHotsiteConfigRepository` (no DB)
- `InMemoryEventBus` — assert on `.published` array
- `InMemoryTransactionManager` — calls `work()` directly
- `TenantBuilder`, `TenantEntityBuilder` for test data

**Integration tests** use:
- `TEST_DATABASE_URL` env var → Testcontainers PostgreSQL singleton
- `supertest` against a real `INestApplication`
- File-local slug prefixes to avoid UNIQUE conflicts across parallel test files
- `TenantEntityBuilder` for direct DB insertion of edge-case states (e.g. inactive tenant)

**SonarCloud rule to watch (S2699):** Every `it()` must contain at least one Jest `expect()`. Supertest's `.expect(401)` does NOT count. Always destructure `{ body }` and add `expect(body.status).toBe(...)`.

---

## 7. Common Commands

```bash
# Run all platform unit tests
pnpm --filter @beloauto/backend exec jest --testPathPatterns="contexts/platform" --no-coverage --selectProjects unit

# Run platform integration tests
pnpm --filter @beloauto/backend exec jest --testPathPatterns="contexts/platform" --selectProjects integration

# Run migrations
pnpm --filter @beloauto/backend run migration:run

# Type-check
pnpm --filter @beloauto/backend run type-check

# Lint
pnpm --filter @beloauto/backend run lint
```

---

## 8. CLAUDE.md Cross-References

| Topic | Where |
|---|---|
| No DATABASE_URL anti-pattern | CLAUDE.md §8 |
| forRootAsync timing | CLAUDE.md §8 |
| REST Client `{{varName}}` syntax | CLAUDE.md §8 |
| No barrel index.ts in ports/ | CLAUDE.md §7 + §8 |
| No exported repository tokens | CLAUDE.md §8 |
| mapXxxError helper pattern | CLAUDE.md §7 + §8 |
| ManagerRoleGuard enforcement | M03-AUTHENTICATION.md §M03-S05 |
| X-Actor-* identity headers | CLAUDE.md §2 invariant #11 |
