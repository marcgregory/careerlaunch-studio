# CareerLaunch Studio Build Plan

Last updated: 2026-07-03

## Active Sprint

Sprint 1 - Resume Builder Vertical Slice.

## Goal

Deliver a working end-to-end demo where a user can sign up, create one resume, edit core sections, preview an original template, receive a lightweight score, and export a PDF.

## Scope

- Scaffold TypeScript monorepo.
- Build Next.js app shell, dashboard, and builder route.
- Add auth.
- Add PostgreSQL and Prisma schema.
- Implement resume document CRUD.
- Implement section editor and autosave.
- Implement one original resume template.
- Implement lightweight resume checker.
- Implement PDF export.
- Add focused tests and release checklist updates.

## Dependencies

- Node.js and package manager selected.
- Postgres database available.
- Auth provider decision.
- PDF export engine spike.
- Design direction for first template.

## Tasks

- Create `apps/web` and shared package structure.
- Configure TypeScript, linting, formatting, tests, and CI baseline.
- Define resume schemas in `packages/domain`.
- Create Prisma schema and migrations.
- Build auth-protected dashboard.
- Build resume builder form sections.
- Add autosave and validation.
- Build live preview.
- Build resume score rules.
- Build PDF export path.
- Add Playwright flow test.
- Update docs at sprint close.

## Definition of Done

- A new user can create and edit a resume.
- Resume data persists across refresh and login.
- Preview renders without layout breakage.
- Resume checker displays actionable feedback.
- PDF export works from the builder.
- TypeScript, lint, unit tests, integration tests, and Playwright smoke tests pass.
- `ROADMAP.md`, `CHANGELOG.md`, and `PROJECT_STATUS.md` are updated.

## Acceptance Criteria

- Create-account to first editable resume path is functional.
- Required fields validate clearly.
- Autosave indicates saving, saved, and error states.
- PDF export is gated by ownership checks.
- Builder works at desktop and mobile widths.
- No template or copy is copied from Zety.

## Demo

Demo flow: sign up, create resume, fill contact and work history, add skills, view score, improve one suggestion, export PDF, reopen dashboard, confirm saved resume.

## Next Sprints

- Sprint 2: add curated templates, style controls, deeper scoring, and accessibility hardening.
- Sprint 3: add cover-letter builder and paid plan gates.
- Sprint 4: add AI rewrites and role-tailoring prompts.

