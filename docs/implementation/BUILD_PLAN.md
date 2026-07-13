# Operational Readiness and Closed-Beta Operations Build Plan

Last updated: 2026-07-14

## Goal

Make production releases observable, repeatable, and safe enough for an invite-only closed beta without adding new product features.

## Scope

- Sentry modernization and production capture verification
- Automated CI release gate
- Structured logs and request-ID correlation
- AI and PDF latency telemetry
- Distributed rate limiting
- Closed-beta dashboards, alerts, incident checklist, feedback intake, and invite rollout

Parser feature work is explicitly out of scope unless the parser policy’s evidence gate is satisfied.

## Dependencies

- Existing Vercel production deployment
- Existing Sentry project and DSN configuration
- Production-safe smoke-test credentials and cleanup
- A shared low-latency store suitable for rate-limit counters
- Existing health, authentication, resume, AI, PDF, and billing test paths

## Tasks

### 1. Sentry Modernization

- Audit deprecated initialization and configuration paths.
- Confirm server, route-handler, client, and edge error capture where applicable.
- Attach environment, release, request ID, route, and safe user context.
- Add a production-safe verification path and document cleanup.

### 2. Automated Release Gate

- Run typecheck, lint, build, unit/integration tests, and critical Playwright checks in CI.
- Add deployment smoke checks for health, auth, builder, resume CRUD, AI analysis, PDF export, billing, and Sentry.
- Fail promotion when a critical check fails and retain machine-readable evidence.

### 3. Production Observability

- Emit structured logs with request-ID correlation.
- Capture error class, route, provider, operation, and duration without sensitive resume content.
- Measure AI and PDF P50/P95 latency and failure rate.
- Define alert thresholds for health degradation and repeated critical failures.

### 4. Distributed Rate Limiting

- Select the simplest shared backend compatible with Vercel.
- Preserve existing rate-limit semantics and response behavior.
- Add concurrency, expiry, isolation, and failure-mode tests.
- Document fail-open/fail-closed decisions per endpoint.

### 5. Closed-Beta Operations

- Create operational dashboard and incident checklist.
- Define invite cohort size, feedback intake, support owner, and rollback criteria.
- Run the automated release gate and invite the first cohort only after it passes.

## Definition of Done

- Sentry captures a production-safe verification event with required context.
- Every production promotion runs the automated critical-flow gate.
- Structured logs correlate critical operations by request ID.
- AI and PDF latency and failure rates are queryable.
- Rate limits are consistent across application instances.
- Closed-beta alerts, incident response, feedback intake, and rollback steps are documented.
- Typecheck, lint, build, tests, and production smoke checks pass.
- Status, roadmap, known issues, checklist, changelog, and handoff docs are current.

## Acceptance Criteria

- A broken critical smoke path blocks promotion.
- A deliberate safe error appears in Sentry with release and request context.
- Concurrent requests through separate instances consume the same rate-limit budget.
- Logs and telemetry never include passwords, tokens, raw resume content, or job descriptions.
- Operators can identify AI and PDF latency regressions without reproducing them locally.
- Parser code remains unchanged unless the evidence-based parser policy is satisfied.

## Demo

Demonstrate a production candidate passing CI, verify a tagged Sentry event, trace one AI and one PDF request by request ID, show shared rate-limit enforcement, review the operational dashboard and incident checklist, and approve the first closed-beta invite cohort.

