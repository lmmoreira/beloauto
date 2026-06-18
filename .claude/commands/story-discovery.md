Run a structured pre-implementation discovery session for a story. Checks doc clarity, completeness, consistency, dependency artifacts, and — for frontend stories — alignment with the validated UX prototype, before any code is written.

> **HARD RULE — NO CODE CHANGES:** This skill only reads code and updates documentation files (`.md` plan and doc files). It NEVER writes or modifies any `.ts`, `.js`, or any source/test/config file. If a gap requires a code change (e.g. enriching an event payload, adding a method to an aggregate), flag it as a recommendation in the readiness verdict and let the user decide when and how to handle it — do NOT make the change.

Argument: `$ARGUMENTS` — story ID (e.g. `M09-S04`).

---

## Step 1 — Locate the story

Parse the milestone prefix (e.g. `M09` from `M09-S04`).

Find the plan file: `plan/<milestone>-*.md` — exclude `*_IMPLEMENTATION_DETAILS_IA.md` and `*_IMPLEMENTATION_DETAILS_DEVELOPER.md`. **Exactly one match expected — if zero or more than one file matches, STOP and surface it as a BLOCKER instead of guessing which one is canonical:**
> Found <N> files matching `plan/<milestone>-*.md`: <list>. This milestone's planning docs are ambiguous/fragmented — confirm with the user which file is canonical (and check CLAUDE.md §10's table for which one it actually references) before proceeding. Do not pick one silently.

Read the file and find `### <story-id> —` (full `M<milestone>-S<NN>` form, e.g. `M13-S01` — not a bare `S01`). If not found, stop:
> Story `<story-id>` not found in `plan/<file>`. Check the ID and try again.

Extract these fields from the story block:
- Title, Agent target, Complexity
- **Docs to load** — every path + optional `§ Section` listed
- Description (all prose)
- Backend use case steps (numbered list)
- BFF endpoint spec (method, path, auth, response)
- Acceptance criteria (all checkboxes)
- Dependencies (story IDs)
- **Prototype references** — every `plan/journey/...` path listed under a "Prototype references:", "Prototype reference:", or milestone-level "Journey prototype:" line

**Immediately after extracting story content — spawn one Explore agent for symbol search.**

From the Dependencies list and the story description, derive every artifact symbol the story expects (aggregate methods, use-case class names, event names, port names, component names, fetcher function names, page route paths — using the vocabulary rules in Step 3). Spawn an Explore agent with "very thorough" breadth and instruct it to run, for each symbol:

```bash
grep -r "<symbol>" apps/ --include="*.ts" --include="*.tsx" -l
```

The agent should return `{symbol, found: true/false, matchingFiles: [...]}` for each. Continue to Step 2 immediately without waiting — collect results before Step 4.

---

## Step 2 — Load referenced docs

For each entry in "Docs to load":
1. Verify the file path exists.
2. If a `§ Section` is specified, confirm that heading exists inside the file.
3. Read the relevant content.

Also load unconditionally:
- `docs/CODE_STANDARDS.md`
- `docs/AGENT_PATTERNS.md`
- The matching `plan/<milestone>_IMPLEMENTATION_DETAILS_IA.md` (if it exists — older milestones have one)

For each entry in "Prototype references":
1. Verify the file path exists.
2. Also load that folder's `dev-notes.md` and `index.html` — even if not explicitly cited, they're the canonical implementation-handoff and screen-inventory files for the prototype.
3. Load the parent journey `.md` spec (e.g. `plan/journey/staff/agenda.md` for a prototype under `staff/prototypes/agenda/`).

Flag any path that doesn't resolve as a **BLOCKER**.

---

## Step 3 — Dependency symbol check

Collect the results from the Explore agent spawned at the end of Step 1. If the agent has not yet returned, wait for it now.

The symbol vocabulary (used to brief the agent and to interpret its results):
- **`backend-ts`/`bff-ts` dependencies:** aggregate methods, use-case class names, event names, port interface names, repository method names.
- **`frontend-ts`/`web-ts` dependencies:** component names, page/route file paths, hook names, exported fetcher function names (e.g. `DashboardShell`, `fetchStaffBookings`, `apps/web/app/dashboard/bookings/page.tsx`) — these live under `apps/web/`, not `apps/backend/`/`apps/bff/`.

If a symbol has `found: false` → **BLOCKER — dependency artifact not found in codebase**.

---

## Step 4 — Discovery checklist

Run every check silently. Tag each finding as **BLOCKER**, **RISK**, or **CONFIRMATION**.

### 4a. Doc validity
- Every "Docs to load" path exists and resolves (`docs/archive/` refs are always blockers — superseded content)
- Every referenced `§ Section` heading exists in its file

### 4b. Use case completeness
- The UC section in `docs/04-USE_CASES.md` covers all flows the story description mentions
- Acceptance criteria address the UC's main flow + primary alternative flows
- Every failure mode in acceptance criteria has a named HTTP status code
- Config-driven values name the exact `tenants.settings` key (cross-check against `docs/21-TENANTS_SETTINGS_SCHEMA.md`)

### 4c. State machine consistency
- Every state transition the story triggers is valid per CLAUDE.md §5
- No criterion references `NO_SHOW` (not in MVP)
- No reference to UC-014 or UC-015 (superseded by UC-021/UC-022)

### 4d. Event envelope completeness
- Every event the story emits is defined in `docs/03-DOMAIN_EVENTS.md`
- Each event carries: `eventId`, `tenantId`, `occurredAt`, `correlationId`, `eventName`, `eventVersion`, `data`
- Domain-specific payload fields (e.g. `isBusiness`, `cancelledBy`) are documented

### 4e. Multi-tenancy invariants
- Every query implied by the story filters by `tenant_id`
- Cross-aggregate references use composite FKs `(tenant_id, id)`
- No implied `UNIQUE(google_oauth_id)` alone for customers

### 4f. Test coverage readability
- At least one tenant-isolation acceptance criterion (Tenant A data + Tenant B caller → 404/403)
- At least one integration test scenario is specified
- Acceptance criteria are concrete enough to derive test names from

### 4g. Cross-context data access
- Data from another context is accessed via events, BFF orchestration, or a named port — not direct repo injection
- Port interfaces referenced in the story are named explicitly

### 4h. API contract
- BFF endpoint: method, path, auth requirement (role/JWT), and response body fields are all specified
- Shared endpoints (same path, different role) explicitly state how routing/branching works

### 4i. Configuration / settings
- Every configurable threshold names its exact `tenants.settings` path
- No hardcoded business values in use-case steps

### 4j. Conflicts with project standards
- Story doesn't contradict CLAUDE.md §7 engineering rules or §8 anti-patterns
- Story doesn't conflict with patterns locked in prior milestones' `_IMPLEMENTATION_DETAILS_IA.md`

### 4k. Journey / prototype alignment (frontend stories — `Agent: frontend-ts`/`web-ts`, or any story citing a `plan/journey/` path)
- Frontend-facing story with **no** prototype reference at all → **RISK** — UI wasn't UX-validated via a prototype before this story was written
- Component/route names the story introduces match what `dev-notes.md`'s file map / per-screen sections call them — no invented names that drift from the prototype's documented components
- Exact pt-BR copy/error strings in the acceptance criteria match the prototype's validated copy verbatim — don't let a story re-invent wording the prototype already settled
- Every unhappy-path/variant screen present in the prototype folder (loading, fetch-error, validation-error, empty, success states) has a corresponding acceptance criterion — a screen that exists in the prototype but is silently dropped from the story's AC is a UX regression, not a scope simplification
- Every "Known limitations" bullet in the prototype's `dev-notes.md` is either addressed by this story's AC or explicitly carried into the story's own open questions
- `index.html`'s dry-run checklist questions are either answered by the story's AC or explicitly left open

---

## Step 5 — Print findings

```
## Story Discovery — <story-id>: <title>

### Blockers (resolve before writing any code)
1. [DOC-PATH] `docs/03-DOMAIN_EVENTS.md §BookingRescheduled` — section not found
2. [SYMBOL] `booking.reschedule()` — no match in apps/ — M07-S03 may be incomplete

### Risks (could cause rework mid-story)
1. [COVERAGE] No tenant-isolation acceptance criterion — CI gate will require one
2. [API] BFF routing for shared PATCH endpoint not described — ambiguous which use case is called
3. [JOURNEY] No prototype reference found for this frontend story — UX wasn't validated before the story was written

### Confirmations (assumed settled — flag if any are wrong)
1. APPROVED → CANCELLED transition is valid per state machine ✓
2. `cancellation_window_hours` key exists in docs/21-TENANTS_SETTINGS_SCHEMA.md ✓
3. PATCH /v1/bookings/:id/cancel endpoint created in M09-S01 — this story reuses it ✓
4. "Tentar novamente" retry-button copy matches `01e-submit-error.html` exactly ✓
```

If zero blockers and zero risks, emit:
```
✅ No issues found. Story is implementation-ready — proceed to branch creation.
```
and skip Steps 6–7.

---

## Step 6 — Questions to the user (one shot)

Collect every question that requires human input (i.e., the answer isn't derivable from the existing docs) and post them all at once in a single numbered list. Group by theme.

```
## Questions before we start

Please answer all at once — I'll wait for one reply before proposing any doc changes.

**Event payload**
1. [BLOCKER] `BookingRescheduled` isn't in `docs/03-DOMAIN_EVENTS.md`. Should `data` carry `previousScheduledAt` + `newScheduledAt` + `rescheduledBy`? Or a different shape?

**BFF routing**
2. [RISK] The story says one `PATCH /v1/bookings/:id/reschedule` endpoint but doesn't say how the BFF picks the backend use case. JWT role only, or also a body flag?

**Defaults**
3. [CONFIRMATION] I'm reading "cancellation_window_hours absent → fall back to 48h" as the intent. Correct, or should a missing setting be a hard error?
```

Wait for the user's single reply before continuing.

---

## Step 7 — Propose doc updates

> **DOCS ONLY.** This step updates `.md` files only — plan files and docs in `docs/`. Never touch `.ts`, `.js`, migration files, or any source/test/config file.

For every blocker or risk that a doc gap caused (missing event payload field, ambiguous criterion, wrong reference, missing consumer), propose a concrete doc fix. Show the exact content to add/change.

If resolving the gap would also require a **code change** (e.g. enriching an event class interface or updating an aggregate method), do NOT make the code change. Instead, include it in the readiness verdict under a dedicated section:

```
### Code changes required before implementation
- `booking-cancelled.event.ts` — add `scheduledAt`, `lineSummary`, `totalPrice` fields to interface
- `booking.aggregate.ts` — update `cancel()` to populate the new fields at emit time
These changes are outside the scope of story-discovery. Implement them on the feature branch before writing M09-S04 code, or address them in a separate preparatory commit on main.
```

For EACH doc change, apply §0 permission protocol:
1. Summarise what you intend to write.
2. Ask: "May I now update `<path>`?"
3. Write only after an explicit yes.

If the user says no to a change, note it and proceed with the current docs.

---

## Step 8 — Readiness verdict

After all questions are answered and doc updates are applied (or declined), emit a final verdict:

```
## Readiness verdict

✅ READY — all blockers resolved.

What was clarified:
- BookingRescheduled payload: previousScheduledAt + newScheduledAt + rescheduledBy
- BFF routing: JWT role determines use case (STAFF|MANAGER → admin; CUSTOMER → customer)
- Missing cancellation_window_hours → default 48h
- Tenant-isolation criterion added to plan file

Next step: `git checkout -b feat/M09-S04-<short-description>`
```

or:

```
## Readiness verdict

❌ NOT READY — N blocker(s) unresolved.

Remaining blockers:
- [SYMBOL] booking.reschedule() not found in codebase — fix dependency before starting

Do not start implementation until all blockers are cleared.
```
