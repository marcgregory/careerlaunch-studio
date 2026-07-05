# CLAUDE.md

## Project

CareerLaunch Studio

## Purpose

Build an original SaaS product for creating, improving, and exporting resumes, CVs, and cover letters. The product should compete in the same category as Zety while using its own identity, templates, copy, UX details, and content library.

## Current Sprint

Sprint 6D — Beta Hardening & Release Candidate (v0.9.5). No new features. See `docs/implementation/SPRINT_6D_BUILD_PLAN.md`.

## Current Implementation Summary

The project has completed Sprints 1 through 6C. The resume builder is fully functional with authenticated draft creation, four registry-driven templates (Modern, Executive, Minimal, ATS Classic), guided sections with add/remove/reorder flows, resume scoring, autosave, and real PDF export via Playwright. Cover letter builder shares the template engine and PDF renderer. AI analysis engine supports full review, job matching, and resume tailoring with Gemini 2.5 Flash and Groq (Llama 4 Scout) providers. User feedback, acceptance analytics, explainability UI, and safety warnings are integrated into all suggestion surfaces. Billing system handles subscriptions via Stripe with feature gating (PDF watermark, resume limits, template access). Sprint 6D is a stabilization sprint — no new features, only quality, performance, and beta readiness.

## Architecture Summary

Use a TypeScript monorepo with a Next.js application, PostgreSQL database, Prisma ORM, server actions or route handlers for app APIs, Stripe for subscriptions, and a background-job path introduced only when AI generation or export workloads require it. Start as a modular monolith with clear feature boundaries.

## Key Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Engineering Rules

### Product First Rule

Build user-facing value before internal polish. Every sprint must produce a visible feature and a working demo.

### Single Sprint Rule

Only one sprint may be active. Do not start future sprint work until the active sprint meets its Definition of Done or the plan is explicitly changed.

### Definition of Done

A sprint is done only when the feature works, documentation is updated, TypeScript passes, the build passes, tests pass, `ROADMAP.md` is updated, `CHANGELOG.md` is updated, and `PROJECT_STATUS.md` is updated.

### Roadmap Discipline

`docs/implementation/ROADMAP.md` only answers "What should be built?" Keep it limited to Completed, In Progress, Sprint Queue, Future, and Blocked.

### Architecture Rules

Follow `docs/ARCHITECTURE.md`. Prefer a modular monolith in the monorepo. Do not introduce Redis, queues, search services, Kubernetes, microservices, or complex event infrastructure until a sprint requirement creates clear pressure.

### State Management Rules

Keep server state, client state, and realtime state separate. Resume data, billing state, and export history are server state. Builder draft UI controls are client state. Realtime collaboration is out of scope for MVP.

### Package Boundaries

Shared validation schemas, template renderers, domain types, and UI primitives belong in packages. Feature modules may consume public package APIs but should not reach into another feature's internals.

### Documentation Discipline

Keep each document in its lane: PRD for behavior, scope for boundaries, architecture for design, build plan for execution, roadmap for backlog, changelog for history, project status for now, technical debt for cleanup, release plan for done.

### Suggestion ID Rule

Suggestion IDs must be deterministic and path-scoped. Every `Suggestion.id` is produced by `suggestionId(category, code, path)` from `packages/ai/src/suggestion/types.ts`. Format:

```
category:code:path
```

Where `path` is the resume section or entry ID the suggestion targets. This keeps IDs stable across re-analysis, enables deduplication in the orchestrator, and avoids React key conflicts in the UI.

### Testing Rules

Each sprint must include focused unit tests, integration tests for persistence and permissions, Playwright checks for core flows, accessibility checks for builder screens, and build/lint verification.

### Release Rules

Do not mark a release Ready unless release criteria, quality gates, demo checklist, performance goals, and blocking issues are reviewed in `docs/implementation/RELEASE_PLAN.md`.

## Known Gaps

- Product name is a working title.
- Legal review is needed before public launch to confirm subscription, refund, privacy, and generated-content terms.
- AI provider, pricing, and exact model selection remain open until implementation.
- Resume template designs must be original and accessibility-tested.

## Technical Debt

See `docs/implementation/TECHNICAL_DEBT.md`.

Initial debt is planning debt only: implementation scaffolding, legal review, content-source policy, and analytics governance.

## Next Priority

Sprint 6D — Beta Hardening & Release Candidate. Dogfooding, AI benchmark, error recovery, mobile QA, accessibility, performance measurement, closed beta checklist. See `docs/implementation/SPRINT_6D_BUILD_PLAN.md`.

## AI Handoff

Start with `docs/PRD.md`, then `docs/ARCHITECTURE.md`, then `docs/implementation/BUILD_PLAN.md`, then `docs/implementation/ROADMAP.md`. Check `PROJECT_STATUS.md` for current sprint state.

