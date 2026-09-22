# CalculationTime API Governance Rulebook

Locked in on 2026-09-22.

The CalculationTime API exists to power high-value tools on calculationtime.com. It is not a dumping ground for generic wrappers, speculative CRUD routes, or micro-service sprawl.

## Governing Rule

If an endpoint does not make a user's calculation faster, more accurate, or fundamentally possible, it should not exist.

## The Three Architectural Gates

Every new endpoint must pass all three gates before routing code is written.

### 1. Direct Pain Point Gate

The endpoint must solve a specific, high-friction calculation, time conversion, or astronomical lookup that is too heavy, secure, or data-intensive to run client-side.

Reject immediately when:

- The route is a generic database wrapper.
- The route is a vanity endpoint.
- The route duplicates frontend logic without improving accuracy, speed, security, or feasibility.

### 2. Zero-Redundancy Gate

Before creating a new route, verify that an existing endpoint cannot be extended or parametrized to handle the request.

Reject immediately when:

- The route is a minor variation of an existing formula.
- The route is a duplicate namespace with no user-facing value.
- The same dataset or calculation can be exposed through an existing stable endpoint.

### 3. Lean Payload Gate

Request and response payloads must be strictly typed, minimal, and free of nested metadata that does not directly serve the calculation result or rendered tool output.

Reject or redesign when:

- The response returns a large generic object graph where an atomic result is enough.
- The request accepts loose or ambiguous shapes.
- The output includes metadata that the UI, docs, or agent-facing consumer does not need.

## Compute vs. Client Split

Keep deterministic lightweight logic in the frontend when it is standard time math, basic date shifting, formatting, colour conversion, simple text transformation, or minor client-side utility work.

Reserve backend routes for:

- Heavy astronomical ephemerides.
- Large historical star catalogues or reference datasets.
- Server-side data lookups that should not be bundled into clients.
- Secure processing.
- Calculations where central consistency, auditability, or protected assumptions matter.

## Validation And Errors

All incoming requests must be validated at the boundary with strict schemas.

Invalid parameters must fail fast with clear, actionable error structures. Do not allow silent failures, partial coercion surprises, raw stack traces, or inconsistent error envelopes.

## Idempotency And Caching

Calculation endpoints must be stateless and deterministic wherever possible.

Cache rules:

- Static and historical lookups should use immutable or long-lived cache headers.
- Time-sensitive calculations should declare their freshness assumptions clearly.
- Routes should be safe to retry unless explicitly documented otherwise.

## Pruning Rule

Existing endpoints should be audited against this rulebook. Routes that fail the gates should be tagged for pruning, migration, consolidation, or frontend-only replacement before any code is removed.

Pruning live routes requires a separate controlled change:

- Update route code.
- Regenerate OpenAPI.
- Update docs and the endpoint directory.
- Run tests and local smoke checks.
- Restart production only after approval.
- Verify live `/health`, `/v1/status`, `/openapi.json`, and affected routes.
