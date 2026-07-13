# CLAUDE.md

## Project

CareerLaunch Studio

## Purpose

Build an original SaaS product for creating, improving, and exporting resumes, CVs, and cover letters. It competes in the resume-builder category with its own identity, templates, copy, UX, and content library.

## Current Sprint

Operational Readiness and Closed-Beta Operations. The feature set and Sprint 6D hardening work are complete. Do not reopen completed parser or release blockers without new evidence.

## Current Implementation Summary

CareerLaunch Studio has an authenticated resume builder, four registry-driven templates, guided editing, autosave, scoring, import, real PDF export, cover-letter generation, AI analysis, job matching, resume tailoring, suggestion diff/apply, explainability, safety checks, feedback analytics, Stripe billing, and entitlement enforcement. Gemini and Groq paths, production deployment, production smoke flows, mobile QA, parser regressions, typecheck, lint, build, and the full automated suite have been validated.

## Architecture Summary

The repository is a TypeScript monorepo. The web application is a Next.js modular monolith backed by PostgreSQL and Prisma. Stripe owns payment state, domain entitlements own feature access, the external PDF renderer owns PDF generation, and the AI abstraction supports Gemini and Groq. Add infrastructure only for a demonstrated operational requirement.

## Key Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run eval:preflight
npm run eval:dogfooding
npm run eval:benchmark
npm run eval:recovery
```

## Engineering Rules

### Product First Rule

Build user-facing value before internal polish. During the active operational sprint, reliability work is user-facing value because it protects the closed-beta experience.

### Single Sprint Rule

Only one sprint may be active. The active sprint is Operational Readiness and Closed-Beta Operations.

### Definition of Done

A sprint is done only when the behavior works, documentation is current, TypeScript passes, the build passes, tests pass, the roadmap is updated, the changelog is updated when product behavior changed, and project status reflects reality.

### Roadmap Discipline

`docs/implementation/ROADMAP.md` answers only “What should be built?” Keep it limited to Completed, In Progress, Sprint Queue, Future, and Blocked.

### Architecture Rules

Follow `docs/ARCHITECTURE.md`. Preserve the modular monolith. Do not introduce queues, search services, Kubernetes, microservices, or complex event infrastructure without concrete pressure. A shared rate-limit store is allowed because multi-instance production enforcement requires shared state.

### State Management Rules

Keep server state, client state, and realtime state separate. Resume data, billing state, authentication, and export history are server state. Builder interaction state is client state. Realtime collaboration is out of scope.

### Package Boundaries

Shared validation schemas, template renderers, domain types, and UI primitives belong in packages. Feature modules consume public package APIs and must not reach into another feature’s internals.

### Documentation Discipline

Keep each document in its lane: PRD for behavior, scope for boundaries, architecture for design, build plan for execution, roadmap for backlog, changelog for history, project status for now, technical debt for cleanup, release plan/checklist for finished criteria, and known issues for genuinely unresolved problems.

### Parser Policy

The resume import parser is feature-frozen for closed beta.

A parser change may only be merged if:

- a real source document reproduces the issue;
- a regression fixture is added;
- the regression test fails before the fix;
- the regression test passes after the fix; and
- all existing parser regression tests remain green.

Do not implement speculative parser improvements.

### Suggestion ID Rule

Suggestion IDs must be deterministic and path-scoped. Produce every `Suggestion.id` with `suggestionId(category, code, path)` from `packages/ai/src/suggestion/types.ts` using `category:code:path` format.

### Testing Rules

Every change needs proportional unit, integration, and Playwright coverage. Operational work must include production-safe verification, failure-path coverage, and rollback considerations. Never weaken a release gate to make it pass.

### Release Rules

Do not mark a release ready until release criteria, automated gates, production smoke evidence, remaining issues, and rollback steps are reviewed. Closed-beta invitation rollout additionally requires verified Sentry capture and distributed rate limiting.

## Known Gaps

- Sentry modernization and production event-capture verification are incomplete.
- The release gate is not fully automated in CI.
- Structured logging and AI/PDF latency visibility are incomplete.
- Rate limiting is process-local and must become distributed for multi-instance enforcement.
- Broader manual accessibility and legal review remain required before public launch.

## Next Priority

Modernize Sentry and verify production error capture. Then automate the release gate, add production observability, implement distributed rate limiting, and establish closed-beta monitoring.

## AI Handoff

Read `docs/implementation/PROJECT_STATUS.md`, then `docs/implementation/ROADMAP.md`, then `docs/implementation/BUILD_PLAN.md`, then `docs/release/KNOWN_ISSUES.md`, and finally `docs/release/sprint-6d/CLOSED_BETA_CHECKLIST.md`. Do not use older release reports as the current source of truth.

