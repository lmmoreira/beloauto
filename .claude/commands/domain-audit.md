Run a structural audit of the backend codebase to catch anti-patterns before they reach code review. Scope: `apps/backend/src/`. Report every finding with file path and line number. Group findings by category. At the end give a total issue count. Fix nothing — audit only.

Optional argument: `$ARGUMENTS` — if provided, restrict the scan to that context path (e.g. `contexts/customer`). Otherwise scan the full backend src.

---

## Checks to run

### 1. Aggregate props typed as plain primitives when a shared VO exists

Shared VOs and the primitive they replace:
- `Email` → `email: string`
- `PhoneNumber` → `phone: string`
- `Slug` → `slug: string`
- `Timezone` → `timezone: string`
- `TimeOfDay` → fields named `open`, `close`, `opens_at`, `closes_at` typed as `string` inside business_hours-like structures
- `HexColor` → fields named `color`, `primary_color`, `accent_color` typed as `string`

How to find them: look for `Props` interfaces inside `*/domain/*.aggregate.ts` files. Report any field that matches a known VO candidate but is typed as `string` or `number`.

### 2. Duplicated `isValidXxx` / inline validation functions outside `src/shared/value-objects/`

Grep for:
- `function isValid` outside `src/shared/value-objects/`
- `const isValid` outside `src/shared/value-objects/`
- Inline regex patterns like `/^[a-z0-9-]+$/`, `/^#[0-9A-Fa-f]{6}$/`, `/@.*\./` in domain or application layer files (not in value-objects)
- `Intl.supportedValuesOf` calls outside `src/shared/value-objects/`

### 3. `makeXxx()` helpers or inline TypeORM entity construction in tests

Grep for:
- `function make` in `*.spec.ts` or `*.integration.spec.ts` files
- `new XxxEntity()` called directly inside a test `it()` or `describe()` block (not inside a builder class)
- Object literals assigned to a variable of a TypeORM entity type inside test files

The fix pattern: create a `XxxEntityBuilder` in `src/test/builders/<context>/`.

### 4. Missing `XxxEntityBuilder` for existing TypeORM entities

For each TypeORM entity class found in `*/infrastructure/entities/*.entity.ts`, check whether a corresponding `XxxEntityBuilder` exists in `src/test/builders/<context>/`. Report entities that have no builder file.

### 5. Seed file containing DDL

Check `src/shared/database/seed.ts` (and any other file under `src/shared/database/`) for:
- `CREATE TABLE`, `CREATE SCHEMA`, `DROP TABLE`, `DROP SCHEMA`
- `ensureSchemas`, `createSchemas`, `createTable`

Seeds must be data-only. Schema belongs in migrations.

### 6. Utility functions duplicated across files (outside `src/shared/utils/`)

Grep for:
- `deepMerge` implemented inline (not imported from `src/shared/utils/deep-merge`)
- Any function body that re-implements string trimming, digit-stripping, or format conversion that already exists in a shared VO or util

### 7. Builder fields without a `withXxx()` setter must be readonly (S2933)

For each `*.builder.ts` in `src/test/builders/`, find private fields initialised inline (`private fieldName = ...`) that have no corresponding `withFieldName(...)` fluent setter method. SonarCloud (S2933) flags these — a field that's never reassigned via a setter should be `readonly`.

Report: `<file>:<line> — 'fieldName' has no setter; mark readonly`

---

## Output format

```
## Domain Audit Report

### 1. Aggregate props typed as plain primitives
- [ ] src/contexts/X/domain/X.aggregate.ts:42 — `email: string` should be `email: Email`
...

### 2. Duplicated isValidXxx / inline validation
- [ ] src/contexts/X/domain/X.vo.ts:10 — local `isValidTimezone` duplicates `Timezone.isValid()`
...

### 3. makeXxx() helpers / inline entity construction in tests
- [ ] src/contexts/X/infra/repos/X.spec.ts:25 — `makeEntity()` should use `XxxEntityBuilder`
...

### 4. Missing XxxEntityBuilder
- [ ] CustomerEntity has no CustomerEntityBuilder in src/test/builders/customer/
...

### 5. Seed DDL
- [ ] src/shared/database/seed.ts:12 — `ensureSchemas()` creates schemas; remove, migrations own the schema
...

### 6. Duplicated utilities
(none found)

### 7. Builder readonly fields (S2933)
- [ ] src/test/builders/customer/customer-entity.builder.ts:18 — 'createdAt' has no setter; mark readonly
...

---
Total issues: N
```

If a category has no findings, print `(none found)`.
