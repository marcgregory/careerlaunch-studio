# Changelog

All notable changes to CareerLaunch Studio will be documented here.

## 0.1.0 - 2026-07-03

### Added

- Initial project foundation.
- Product scope, PRD, architecture, tech stack, deployment, roadmap, build plan, release plan, status, technical debt, ADRs, and Founder OS.
- TypeScript monorepo scaffold with Next.js web app and shared `domain`, `rendering`, and `ui` packages.
- First resume-builder vertical slice with dashboard, editable builder, local autosave, resume scoring, live preview, and print-to-PDF export.
- Prisma schema for users, resume documents, versions, export jobs, and subscriptions.
- First-party email/password auth with signed HTTP-only session cookies.
- Protected dashboard and builder pages.
- Database-backed resume create/edit/save API routes with per-user ownership checks.
- Ownership-checked PDF export request route.
- Initial PostgreSQL Prisma migration.
- Complete builder editing coverage for contact, target, summary, experience, education, skills, certifications, projects, and section order.
- Builder validation, empty states, reset controls, autosave status, and export-disabled states for incomplete resumes.
- Real PDF generation with preview/PDF section-order parity and repeated-render stability coverage.
- Playwright e2e coverage for auth protection, database-backed signup/save/export, PDF regression, and builder section/item ordering persistence.
- Domain test coverage for resume scoring.

### Changed

- Root build script now skips workspaces without build scripts.
- Resume builder persistence now saves through API routes instead of browser `localStorage`.
- Dashboard now lists authenticated user's persisted resumes.
- Root layout now declares Next's smooth-scroll behavior attribute to keep route-transition diagnostics clean.
- Sprint 1 status and roadmap documentation now mark the resume-builder vertical slice as release-complete.

### Fixed

- Fixed workspace TypeScript resolution by pointing the rendering package entry to its `.tsx` source.
- Added a default Next document module required by the production build.
- Restored generated `next-env.d.ts` to the production routes import after dev server runs.

### Removed

- Removed localStorage-based resume autosave from the builder.

## 0.3.1-alpha - 2026-07-03

Sprint 3A.5 — Apply Engine + Acceptance Persistence. Tagged `v0.3.1-alpha`.

### Added

- Pure-function apply engine in `packages/ai/apply/` with 5 safe operation types: `replace_summary`, `replace_bullet`, `replace_skill`, `add_skill`, `remove_skill`.
- `applyChanges()` function — transforms operation arrays into resume mutations with full immutability and no side effects.
- `ApplyError` class with operation context and reason for stale-target detection.
- `POST /api/resumes/:resumeId/suggestions/apply` — authenticated API endpoint with auth, ownership check, apply engine, and database persistence.
- `suggestionToOperation()` in `apps/web/lib/suggestion-to-operation.ts` — maps Suggestion objects to ApplyOperation arrays.
- Apply wiring in `HealthDashboard` — accept button now calls the API with optimistic state and error handling.
- `handleApplySuggestion` in `ResumeBuilder` — updates local resume state from API response so preview reflects changes.
- 21 unit tests for `suggestionToOperation()` mapping.
- Playwright E2E tests for suggestion acceptance, 409 stale target, resume unchanged on failure, and apply API persistence.

### Changed

- Updated ROADMAP, PROJECT_STATUS, and CHANGELOG for Sprint 3A.5 completion.

## 0.2.0 - 2026-07-03

Sprint 2 user assessment: Architecture 10/10, Rendering Pipeline 10/10, Testing 10/10, Maintainability 10/10, Extensibility 10/10. "The engineering foundation now looks mature."

### Added

- Template registry with semantic properties (`headerStyle`, `nameStyle`, `roleStyle`) replacing per-template conditionals.
- Template metadata (`premium`, `accentColor`, `swatches`) for data-driven gallery rendering.
- Premium template lock UI — locked templates show a lock icon, overlay, and upgrade prompt; disabled state prevents selection.
- Playwright visual regression tests capturing screenshots for all 4 templates (modern, executive, minimal, ats).
- Template-specific PDF QA tests verifying each template produces valid PDF output.

### Changed

- PDF renderer (`packages/rendering/src/pdf.tsx`) now generates CSS programmatically from template definitions, eliminating preview/PDF drift.
- `ResumePreview` component refactored — mapping functions for header border, name style, role style, contact weight, and item titles all branch on semantic properties instead of `isAts`/`isExecutive` flags.
- Template gallery selection highlights use `accentColor` from template metadata instead of hardcoded green.
- Updated ROADMAP, PROJECT_STATUS, and CHANGELOG to reflect Sprint 2 template foundation work.

### Fixed

- PDF contact line font-weight now matches browser preview for `display`-style templates (900 instead of 800).