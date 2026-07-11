# CareerLaunch Studio

CareerLaunch Studio is an original resume, CV, and cover-letter builder for job seekers who need polished application materials fast. It is inspired by the resume-builder category, not by copying Zety's brand, templates, wording, or proprietary flows.

## Product

- Target users: job seekers, career switchers, students, and professionals updating resumes for specific roles.
- Primary outcome: create, improve, and export job-ready application documents with guided content suggestions.
- Current sprint: Sprint 1 - Resume Builder Vertical Slice.
- Next milestone: MVP demo with account creation, one editable resume, one template, guided sections, scoring, and PDF export.

## Documentation Map

- `docs/PRD.md` - product behavior, users, requirements, and acceptance criteria.
- `docs/PROJECT_SCOPE.md` - scope, non-goals, assumptions, risks, and constraints.
- `docs/ARCHITECTURE.md` - system design, boundaries, data, APIs, state, and security.
- `docs/TECH_STACK.md` - selected technologies, tools, packages, and rejected options.
- `docs/DEPLOYMENT.md` - environments, release process, operations, and rollback.
- `docs/FOUNDER_OS.md` - market, pricing, GTM, risks, and ROI analysis.
- `docs/adr/` - consequential architecture decisions.
- `docs/implementation/ROADMAP.md` - what should be built.
- `docs/implementation/BUILD_PLAN.md` - how the active and queued sprints will be built.
- `docs/implementation/PROJECT_STATUS.md` - current project snapshot.
- `docs/implementation/CHANGELOG.md` - versioned history.
- `docs/implementation/TECHNICAL_DEBT.md` - cleanup list.
- `docs/implementation/RELEASE_PLAN.md` - definition of finished.

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
npm run typecheck
npm run test:e2e --workspace @careerlaunch/web
```

## Environment

Copy `.env.example` to `.env`, set `DATABASE_URL` and `AUTH_SECRET`, then run the Prisma migration before testing the full persistence path.

```bash
node_modules/.bin/prisma migrate dev --schema prisma/schema.prisma
```

## Current Status

Sprint 1 is in progress. Auth, protected resume persistence routes, database-backed builder code, and export ownership checks are implemented. Sprint 1 should not be marked complete until PostgreSQL is configured, the migration is applied, and the full Playwright signup/save/export path passes against the database.
