Run the pre-PR checklist against the current branch. This is the mandatory gate before opening any PR. Do not open the PR until this reports zero issues.

1. Run `git diff main...HEAD --name-only` to identify changed files.
2. Run `git diff main...HEAD` to read the full diff.
3. Identify which apps have changed files (`apps/backend/`, `apps/bff/`, `apps/web/`) and which backend contexts were touched.

---

## Step 0 — Run the actual compilers and linters first

These are the real CI gates. Run them before any grep-based check — a failure here makes the rest irrelevant.

For each app with changed files, run:
- `apps/backend/` changed → `pnpm --filter @beloauto/backend run type-check` then `pnpm --filter @beloauto/backend run lint`
- `apps/bff/` changed → `pnpm --filter @beloauto/bff run type-check` then `pnpm --filter @beloauto/bff run lint`
- `apps/web/` changed → `pnpm --filter @beloauto/web run type-check` then `pnpm --filter @beloauto/web run lint`

Report the full output of any failure. If any command fails, mark **Step 0 ❌ FAIL** and still continue with the grep checks below so all issues are visible at once.

---

## Checks

### 1. No framework imports in domain or application layers

Grep changed files matching `*/domain/**` and `*/application/**` for:
- `from '@nestjs/`
- `from 'class-validator'` or `from 'class-transformer'`
- `HttpException`, `HttpStatus`

Controllers, guards, and pipes may use these — domain and application layers must not.

### 2. Multi-aggregate writes wrapped in ITransactionManager.run()

Read each changed use case file (`*.use-case.ts`). If it calls `save()` on two or more different repositories, verify that all saves are inside a `txManager.run(async () => { … })` call.

### 3. Every new REST endpoint has a .http request block

For every new `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` route in changed controller files, check that a corresponding block exists in `apps/backend/http/<context>/<resource>.http`. The block must cover the happy path AND at least the main error cases.

### 4. Every public controller and service method has an explicit return type

Grep changed `*.controller.ts` and `*.service.ts` files for:
- `async [methodName]([^)]*)\s*{` — missing `: Promise<...>` or `: Type` return annotation

### 5. No framework / infrastructure tokens injected directly into controllers

Grep changed `*.controller.ts` files for:
- `@InjectRepository(`
- `DataSource`
- `EntityManager`
- `Repository<`

Controllers must inject use cases only.

### 6. @Body() validation uses ZodValidationPipe + DTO file — no inline safeParse

Grep changed controller files for:
- `.safeParse(` — inline validation instead of `ZodValidationPipe`
- `z.object(` or `z.string(` defined inside a controller class

### 7. No non-null assertions or `any` in production code

Grep changed files outside `*.spec.ts` / `*.integration.spec.ts` / `src/test/` for:
- `!` at end of an expression (non-null assertion) — flag occurrences not in comments or strings
- `as any`
- `: any`
- `@ts-ignore`

### 8. @Global() modules have an explanatory comment

Grep changed `*.module.ts` files for `@Global()`. For each occurrence, verify the line or a nearby comment explains why it is global and where it is imported.

### 9. New required env vars documented in .env.example

Scan the diff for new `process.env['XXX']` or `process.env.XXX` references in production code. For each one, confirm the variable name appears in `.env.example`. Report missing entries.

### 10. Aggregate fields use VO types; getters return the VO

Read changed `*.aggregate.ts` files. Check that:
- Props interfaces use VO types (`Email`, `PhoneNumber`, `Slug`, `Timezone`, `HexColor`, `TimeOfDay`) — not `string` or `number`
- Getter return types match the VO (e.g. `get email(): Email`, not `get email(): string`)

### 11. Every TypeORM entity in tests uses XxxEntityBuilder

Grep changed `*.spec.ts` and `*.integration.spec.ts` files for:
- `new [A-Z][a-zA-Z]+Entity(` — direct construction
- `function make[A-Z]` — inline factory helpers

### 12. SonarCloud-prone patterns

Grep changed production files for patterns that trigger SonarCloud issues:
- `as unknown as` (flag for review — not always wrong, but must be intentional)
- `z.string().uuid()` or `z.string().url()` — deprecated in Zod v4; use `z.uuid()` / `z.url()`
- Functions longer than 20 lines (count lines between `{` and matching `}` for function bodies)

### 13. Static routes declared before dynamic routes in the same controller

Read changed controller files. For each controller class, verify that all `@Get('literal-path')` decorators appear before any `@Get(':param')` decorators in declaration order.

### 14. Missing .spec.ts for new use cases and controllers

For every new file matching `*.use-case.ts` or `*.controller.ts` in the diff, check that a corresponding `*.spec.ts` exists in the same directory tree. Report any new use case or controller that has no unit test file — these will fail the coverage gate.

### 15. New @Injectable() classes registered in their module

For every new class decorated with `@Injectable()` in the diff, verify the class name appears in a `providers` array inside the relevant `*.module.ts`. A class that is injectable but not registered causes the entire NestJS DI container to throw at test time, crashing every test in the context.

To check: grep the module file(s) in the same context for the class name. Report any unregistered injectable.

### 16. No .skip() or .only() in tests

Grep all changed `*.spec.ts` and `*.integration.spec.ts` files for:
- `it.skip(`, `test.skip(`, `describe.skip(`
- `it.only(`, `test.only(`, `describe.only(`
- `xit(`, `xdescribe(`

Any occurrence blocks the full test suite in CI.

### 17. No console.log / console.error in production code

Grep changed files outside `*.spec.ts` / `*.integration.spec.ts` / `src/test/` for:
- `console.log(`
- `console.error(`
- `console.warn(`

All logging must go through the shared structured logger, not `console.*`. ESLint catches this in CI.

### 18. No barrel imports from ports/ or shared/domain/

Grep changed files for import paths that end with `/ports` or `/shared/domain` (without a specific filename):
- `from '.*\/ports'` — should be `from '.*\/ports\/specific-file'`
- `from '.*\/shared\/domain'` — should be `from '.*\/shared\/domain\/specific-file'`

The `no-restricted-imports` ESLint rule blocks these in CI.

### 19. Domain audit

Run the full `/domain-audit` on each changed context (e.g. `/domain-audit contexts/booking`). Include the full output. Any finding is a failure.

---

## Output format

```
## Pre-PR Checklist — <branch name>

### Step 0 — type-check + lint
✅ PASS — @beloauto/backend type-check clean, lint clean

### 1. No framework imports in domain/application layers
✅ PASS

### 2. Multi-aggregate writes wrapped in ITransactionManager.run()
❌ FAIL — src/contexts/booking/application/use-cases/approve-booking.use-case.ts:34 — two repo.save() calls not inside txManager.run()

...

### 19. Domain audit
(paste /domain-audit output here)

---
Total issues: N
```

If all checks pass, output:
```
✅ All pre-PR checks passed. Safe to open the PR.
```
