# CLAUDE.md

## Project

CareerLaunch Studio

## Purpose

Build an original SaaS product for creating, improving, and exporting resumes, CVs, and cover letters. The product should compete in the same category as Zety while using its own identity, templates, copy, UX details, and content library.

## Current Sprint

Sprint 1 - Resume Builder Vertical Slice.

## Current Implementation Summary

No implementation code exists yet. The project foundation defines product scope, architecture, stack, roadmap, sprint plan, release rules, founder strategy, and ADRs.

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

Scaffold the TypeScript monorepo and implement Sprint 1: authenticated resume draft creation, one editable template, guided sections, lightweight scoring, and PDF export.

## AI Handoff

Start with `docs/PRD.md`, then `docs/ARCHITECTURE.md`, then `docs/implementation/BUILD_PLAN.md`. Keep Sprint 1 as the only active sprint until the vertical slice is demonstrable.

