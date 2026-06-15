Audit `docs/04-USE_CASES.md` for staleness, internal inconsistency, and drift from the actually-implemented code (roles, endpoints, entities, frontend pages). Run this before drafting any journey file (`plan/journey/`) or starting a new milestone — it establishes a verified baseline so IA/journey work isn't built on stale UC text.

Optional argument: `$ARGUMENTS`
- A UC number or comma-separated list, e.g. `UC-021` or `UC-002,UC-021,UC-027` — scope checks to these UCs (the full document is still read for cross-reference context).
- A milestone prefix, e.g. `M13` — read `plan/M13-*.md` (excluding `_IMPLEMENTATION_DETAILS_*` files), extract every UC number referenced in its stories' "Docs to load" lines, and scope to those.
- Blank — audit every UC in `docs/04-USE_CASES.md`.

Fix nothing without permission — audit first, propose fixes, then write only what the user approves (CLAUDE.md §0).

---

## Step 1 — Read source docs

Read in full:
- `docs/04-USE_CASES.md`
- `.copilot/context.md` §6 (Use Cases Index)

If `$ARGUMENTS` is a milestone prefix, also read the matching `plan/MXX-*.md` and build the UC scope list as described above. Otherwise the scope is the UC(s) in `$ARGUMENTS`, or all UCs if `$ARGUMENTS` is empty.

---

## Step 2 — Verify against code (parallel Explore agents)

Spawn Explore agents in parallel, one per area below. Give each agent the relevant UC excerpts (actor lines, endpoint paths, domain-term references) for the in-scope UCs, plus its specific question. Request "very thorough" search breadth.

### Agent A — Roles & guards
For every actor/role term the in-scope UCs use (e.g. "Admin", "Staff", "Manager", "Super admin", "Developer", "Platform operator", "Customer"), grep `apps/bff/src/**/*.controller.ts` for the `@Roles(...)` decorator on the endpoint(s) that UC describes. Report, per UC: the role(s) the doc claims vs. the role(s) the guard actually enforces, and whether they match CLAUDE.md §1's two staff roles (`STAFF`, `MANAGER` — `MANAGER` is a superset) plus `CUSTOMER`. Flag any doc role term with zero corresponding JWT role.

### Agent B — Endpoints & .http coverage
For every HTTP method+path literal in the in-scope UCs (e.g. `PATCH /customers/me`, `POST /v1/loyalty/redeem`), grep backend (`apps/backend/src/contexts/**/*.controller.ts`) and BFF (`apps/bff/src/**/*.controller.ts`) for a matching route decorator, and grep `apps/backend/http/**/*.http` + `apps/bff/http/**/*.http` for a corresponding request block. Report any UC-stated path with no matching controller route, any method mismatch (UC says PATCH, code has PUT, etc.), and any route missing an `.http` block.

### Agent C — Entities, enums, settings keys & frontend pages
For every domain term an in-scope UC asserts as a concrete shape (module types, status enums, `tenants.settings` keys, table/column names), grep the relevant `*.aggregate.ts`, enum, or `docs/21-TENANTS_SETTINGS_SCHEMA.md` and report whether the doc's list matches the code's. Separately, for every in-scope UC that implies a dedicated frontend page/route (a distinct "guest views X" / "customer submits Y" screen, not just an API call), check `apps/web/app/` for a matching page and report MISSING if none exists — this is the IA-gap signal that feeds `plan/journey/`.

Wait for all agents to finish, then collect their findings.

---

## Step 3 — Internal consistency checks (direct doc reading, no subagents)

For the in-scope UCs:
- **Summary table vs. detail sections** — the bottom-of-file summary table row (Title, Actor, Outcome) must match the detailed section's `**Actor:**` line and described outcome.
- **Cross-UC references** — every "see UC-XXX" / "superseded by UC-XXX" / "lives in UC-XXX" reference points to a UC that exists, with a status consistent with how it's being referenced (don't cite an active flow as living inside a UC marked SUPERSEDED).
- **`.copilot/context.md` §6 sync** — UC title + status in §6's index table matches the summary table in `docs/04-USE_CASES.md`.
- **State machine** — any booking status transition named in a UC is valid per CLAUDE.md §5; no UC references `NO_SHOW`, UC-014, or UC-015 as active.

---

## Step 4 — Findings report

```
## UC Audit Report — <scope>

### Stale / Conflicting (doc says X, code says Y)
1. [UC-XXX] <field> — doc: "<old>" / code: "<actual>" → proposed fix: <one-line>

### Internal inconsistencies (doc vs. doc)
1. [UC-XXX] Summary table says "<A>", detail section says "<B>"

### IA gaps (UC implies a page that doesn't exist)
1. [UC-XXX] <flow> — no page under apps/web/app/... — candidate for plan/journey/<actor>/

### Confirmed correct
1. [UC-XXX] <thing> ✓
```

If a category has no findings, print `(none found)`.

---

## Step 5 — Resolve findings

For each "Stale/Conflicting" and "Internal inconsistency" finding:
- If the code is the unambiguous source of truth (roles, endpoint shapes, entity/enum definitions) and there's one obvious fix, propose the exact doc edit (old → new text).
- If the fix requires a judgment call (terminology choice, which doc is authoritative, scope decision), collect it and ask via `AskUserQuestion` — batch all such questions into one round.

"IA gaps" are not fixed in this step — list them for the user, to be carried into `plan/journey/<actor>/use-cases.md` when that actor's journeys are drafted. Don't propose doc edits for them unless asked.

Before writing anything, apply CLAUDE.md §0: summarise every proposed edit across all affected files in one message, ask "May I now write these N changes?", and write only after an explicit yes.

---

## Step 6 — Verdict

```
## Audit verdict — <scope>

✅ N stale/conflicting items fixed
✅ N internal inconsistencies fixed
📋 N IA gaps recorded (see report above) — carry into plan/journey/ when drafting that actor's journeys

Docs are now a verified baseline for journey-mapping / milestone planning.
```
