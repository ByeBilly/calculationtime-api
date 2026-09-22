# CalculationTime API Governance Rulebook (v2)

Locked in 2026-09-22 (v1), amended 2026-09-22 (v2). Supersedes v1 in place.

The CalculationTime API exists to power high-value tools on calculationtime.com and for third-party developers. It is not a dumping ground for generic wrappers, speculative CRUD routes, or micro-service sprawl.

## Governing Rule

If an endpoint does not make a user's calculation faster, more accurate, or fundamentally possible — for calculationtime.com, or for a genuine third-party consumer — it should not exist.

## The Four Architectural Gates

Every new endpoint must pass all four gates before routing code is written. Every existing endpoint is subject to the same gates on an ongoing basis (see Pruning Rule).

### 1. Direct Pain Point Gate

The endpoint must solve a specific, high-friction calculation, lookup, or process, via one of two paths:

**1a — too heavy, secure, or data-intensive to run client-side.** A browser calling this API cannot reasonably do the work itself (heavy ephemerides, large reference/historical datasets, secure processing, geographic boundary/terrain data).

**1b — genuine third-party utility value.** The API's consumer isn't only calculationtime.com's own browser pages — it's any developer, in any environment, over plain JSON. A route passes on this path only if it names a real, specific case where the operation is not trivially available to that consumer, and only where there's *authentic, real-world demand* — not "someone could technically use this." Two named consumer types qualify: a no-code/low-code automation platform (Zapier, Make, n8n) with no code-execution step, or a polyglot backend wanting guaranteed-consistent behavior instead of drift across independent implementations.

**1b's bound.** "A developer could write this in one line" is true of almost everything and is not disqualifying on its own — but it's also why 1b requires *authentic, verifiable demand*, not a hypothetical. Test it against: would a real person or team actually reach for this, and would an honest mention or link follow from it being genuinely good — not merely "it could be marketed as a feature." A route fails 1b if:
- A single well-known, purpose-built free library already dominates that exact niche (e.g. sun/moon/twilight timing — `SunCalc.js` and equivalents are the established standard; a bespoke lesser-known API does not earn authentic recommendations over them).
- It's an academic/engineering-textbook formula with thin real-world standalone demand (matrix/vector operations, uncommon solid geometry, niche physics formulas) even though it's technically usable.
- It's trivial in every mainstream language's standard library *and* has no no-code-platform gap (most closed-form single-formula math).

**1b's documentation/backlink leg.** A route's value isn't only its own call volume — a genuinely useful, well-documented calculator endpoint gets cited from developer blogs, "useful free API" roundups, and integration write-ups, which is real value to the domain. This only counts for routes that are actually commonly searched-for, standalone utility categories (a BMI calculator, a business-days calculator, a hex/RGB converter) — never for esoteric formulas nobody would write about. This is a byproduct of genuine usefulness, not a target to be gamed; a route "rubbish nobody would ever likely use" fails regardless of framing.

Reject immediately when:
- The route is a generic database wrapper.
- The route is a vanity endpoint.
- The route duplicates frontend logic without improving accuracy, speed, security, feasibility, or serving a named 1b consumer.

### 2. Zero-Redundancy Gate

Before creating a new route, verify that an existing endpoint cannot be extended or parametrized to handle the request. Applies across families, not just within one — a "stats" route duplicating a "math" route still fails this gate.

Reject immediately when:
- The route is a minor variation of an existing formula (different input variables for the same underlying calculation).
- The route is a duplicate namespace with no user-facing value (e.g. the same operation served at two path prefixes).
- The same dataset or calculation can be exposed through an existing stable endpoint.

**Single canonical path per operation.** One version prefix. No operation is served at two paths with identical output. Where this exists today, the older path gets a deprecation date, not a silent duplicate.

### 3. Lean Payload Gate

Request and response payloads must be strictly typed, minimal, and free of nested metadata that does not directly serve the calculation result or rendered tool output.

**Exception**: provenance fields on reference-data endpoints (`dataset_version`, `source`) are not fluff — they're what makes a "visible assumptions" claim credible, and stay.

Reject or redesign when:
- The response returns a large generic object graph where an atomic result is enough.
- The request accepts loose or ambiguous shapes.
- The output includes metadata that the UI, docs, or agent-facing consumer does not need (excluding the provenance exception above).

### 4. Auth-Tier Fit Gate (added v2)

A route being keyed must be a deliberate choice per route, not a uniform default. Ask: does this route's cost, abuse risk, or customer-data exposure actually require a key, or does it belong in a free/rate-limited public tier? A route that's keyed today only because every route is keyed by default is a decision nobody made on purpose — make it explicitly per route.

## Improve-Before-Cull (added v2)

A route that fails a gate is not automatically deleted. Before it's tagged for pruning, check whether a concrete enhancement — a real maintained dataset behind it, bundling into a richer feature, an artifact-generation step, orchestration across data the API already holds — would bring it into compliance.

- **If yes**: tag it `improve`, name the specific change, and either ship the improvement or let the deprecation deadline pass with no change.
- **If no** — it's an inherently stateless formula needing zero data and zero meaningful compute, and it doesn't clear Gate 1b either — tag it `cut` for real. Renaming or bundling a route without changing what it depends on does not count as an improvement.

## Compute vs. Client Split

Keep deterministic lightweight logic in the frontend when it is standard time math, basic date shifting, formatting, unit/color conversion, simple text transformation, or minor client-side utility work — *unless* it separately clears Gate 1b as a documented third-party utility route.

Reserve backend routes for:
- Heavy astronomical ephemerides (verify against known free client libraries before assuming this applies — see Gate 1b).
- Large historical star catalogues or reference datasets.
- Server-side data lookups that should not be bundled into clients.
- Secure processing.
- Calculations where central consistency, auditability, or protected assumptions matter (numerically finicky finance formulas like IRR, jurisdiction-specific regulatory data).
- Documented third-party utility routes (Gate 1b).

## Storage/Session Carve-Out (added v2)

Endpoints that persist or resolve state on the caller's behalf (e.g. Observatory share tokens) are not calculations. The four gates don't apply to them the way they apply to calculation endpoints — they're governed by ordinary data-retention and access-control practice instead, and should be labeled as a distinct category in the contract.

## Validation And Errors

All incoming requests must be validated at the boundary with strict schemas.

Invalid parameters must fail fast with clear, actionable error structures. Do not allow silent failures, partial coercion surprises, raw stack traces, or inconsistent error envelopes.

## Idempotency And Caching

Calculation endpoints must be stateless and deterministic wherever possible.

Cache rules:
- Static and historical lookups should use immutable or long-lived cache headers.
- Time-sensitive calculations should declare their freshness assumptions clearly.
- Routes should be safe to retry unless explicitly documented otherwise.

## Ownership and Staleness (added v2)

Any endpoint encoding regulatory or jurisdiction-specific rules (tax rates, holiday calendars, VAT/CIS logic, mileage reimbursement rates) needs a named owner and an annual review date, tracked in the contract's internal notes. Undated regulatory logic goes stale silently — the first sign of it is usually a user acting on wrong tax or holiday information.

## Public Contract Hygiene (added v2)

Only routes a third-party developer should call belong in the public `openapi.json`. Internal admin/customer-management routes (`/v1/admin/*`) do not belong there regardless of auth requirements — move them to an internal-only contract.

## Pruning Rule

Existing endpoints are audited against this rulebook on an ongoing basis. Routes that fail the gates are tagged for pruning, migration, consolidation, or frontend-only replacement before any code is removed.

Pruning live routes requires a separate controlled change:
- Update route code.
- Regenerate OpenAPI.
- Update docs and the endpoint directory.
- Run tests and local smoke checks.
- Restart production only after approval.
- Verify live `/health`, `/v1/status`, `/openapi.json`, and affected routes.

See `docs/api-endpoint-audit-2026-09-22.md` for the full route-by-route audit against this rulebook — every currently live route, tagged keep / keep-conditional / improve / merge / cut, with reasoning.
