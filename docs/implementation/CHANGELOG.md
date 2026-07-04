# Changelog

All notable changes to CareerLaunch Studio will be documented here.

## 0.5.0-alpha - 2026-07-04

### Added

- **Sprint 4 — Resume Import + Version Duplication**
- **Version duplication** — `POST /api/resumes/:resumeId/duplicate` clones a resume with ownership check, preserves all content/template/structure, and creates a new `ResumeVersion` with source reference. "Duplicate" button on each dashboard resume card.
- **Text import parser** (`packages/ai/src/import/text-parser.ts`) — regex-based parser that detects sections (summary, experience, education, skills, certifications, projects), extracts contact info (name, email, phone, location, website), and returns `{ parsed, confidence, warnings }`. Pure function, no AI dependency.
- **`POST /api/import/text`** — authenticated API route, max 50 KB, returns parse result with confidence score.
- **`/import` page** — full import flow: paste text → parse → preview parsed data → create draft → redirect to builder. States: idle, parsing (spinner), preview (low-confidence warning banner, editable data display), saving, error. Confidence threshold <50% triggers warning banner.
- **Documentation updates** — ROADMAP, PROJECT_STATUS, DEPLOYMENT.md, CHANGELOG updated for Sprint 4 completion.

### Changed

- PDF rendering architecture: separated into standalone Docker service (`services/pdf-renderer/`), removing `@sparticuz/chromium-min`, `CHROMIUM_PACK_URL`, and all Vercel Chromium workarounds. Production hardening: bearer auth, timeouts, health endpoint, request validation, browser reuse, correlation ID logging.
- Dashboard: added "Import" button (secondary style) next to "New resume" and "Duplicate" button (Copy icon) on each resume card.
- tsconfig.base.json: added `@careerlaunch/ai/*` path for subpath imports.

### Removed

- `@sparticuz/chromium-min` dependency from root `package.json` and `packages/rendering/package.json`.
- `CHROMIUM_PACK_URL` env var — replaced by `PDF_RENDERER_URL` + `PDF_RENDERER_TOKEN`.
- Vercel-specific Chromium launch logic from `packages/rendering/src/browser.ts`.
- Postinstall Playwright hacks from root `package.json`.

### Added

- **Sprint 3D — Cover Letter Builder MVP** — generate, edit, save, and export a cover letter associated with a resume. AI drafts → user edits → user exports. No auto-send, no email integration.
- **CoverLetter Prisma model and migration** (`20260703095249_add_cover_letter`) — linked to User and ResumeDocument with fields for recipient details, salutation, body, closing, and optional job description. One cover letter per resume (upsert).
- **`CoverLetterDocument` domain type** (`packages/domain/src/index.ts`) — type-safe client interface matching the Prisma model.
- **Cover letter mock generator** (`packages/ai/src/cover-letter/`) — `generateCoverLetter()` produces deterministic, realistic placeholder text from resume data (name, role, skills, experience) and optional job description. Zero AI calls.
- **Cover letter PDF renderer** (`packages/rendering/src/cover-letter-pdf.tsx`) — business-letter format PDF using the resume's template styling for font and color consistency. Same Playwright render pipeline as resume PDF. Exported as `@careerlaunch/rendering/cover-letter-pdf`.
- **Cover letter API routes** — `GET/PUT /api/resumes/:resumeId/cover-letter` (load/upsert), `POST /api/resumes/:resumeId/cover-letter/generate` (AI draft + persist), `POST /api/export/cover-letter-pdf` (PDF bytes). All authenticated with ownership checks.
- **CoverLetterPanel UI** (`apps/web/app/builder/_analysis/cover-letter-panel.tsx`) — self-contained panel integrated into the builder sidebar alongside HealthDashboard and JobMatchPanel. Full state coverage: idle, generating, editing, saving, exporting, error. Auto-loads existing cover letter on mount.
- **8 new cover letter tests** — all passing. 144 AI tests total.

### Changed

- `prisma/schema.prisma`: User model now has `coverLetters` relation; ResumeDocument has `coverLetters` relation.
- `packages/rendering/package.json`: added `./cover-letter-pdf` export.
- Builder sidebar now shows Cover Letter panel below Job Match.

## 0.3.3-alpha - 2026-07-03

### Added

- **Sprint 3C — Job Match MVP** — paste-only job description comparison without URL scraping.
- **Job Match engine** (`packages/ai/src/job-match/`): `normalize-job.ts` (tokenizer + 80-skill dictionary), `compare.ts` (resume vs JD skill comparison), `keywords.ts` (keyword overlap analysis), `score.ts` (match scoring 0–100), `index.ts` (orchestrator). Dictionary-based, deterministic, zero AI calls.
- **`"job-match"` SuggestionCategory** — new category for `add_skill` operations from job matching.
- **`createOperations(suggestion, resume)`** — upgraded operation factory that accepts resume context, enabling `add_skill` operations for job-match suggestions. Deprecated wrapper keeps `suggestionToOperation(suggestion)` working.
- **`POST /api/resumes/:resumeId/job-match`** — authenticated API route that runs the match pipeline and persists an `AnalysisRun` with `type: "job_match"`.
- **JobMatchPanel UI** (`apps/web/app/builder/_analysis/job-match-panel.tsx`) — self-contained panel with JD paste area, match score gauge, missing/present skill lists, suggestion cards, and Review → Diff → Apply integration. Integrated into the builder sidebar alongside HealthDashboard.
- **39 new tests** — `normalize-job.test.ts`, `compare.test.ts`, `score.test.ts`, `keywords.test.ts`, `index.test.ts` integration, plus `createOperations` job-match tests. All 136 tests pass.
- **AnalysisRun database table** — `Prisma` model persisted per analysis and per job-match run. Exported as `AnalysisRunRecord` type.
- **Suggestion ID convention** — documented in CLAUDE.md Engineering Rules.

### Changed

- `suggestionToOperation()` moved from `apps/web/lib/` to canonical `packages/ai/src/operations/factory.ts`. Exported from `@careerlaunch/ai`. Web import updated. Tests now import from canonical package.
- Analysis orchestrator deduplication — merged suggestions use `Map<string, Suggestion>` (AI overwrites static for same ID).
- Empty dead code `apps/web/lib/suggestion-to-operation.ts` removed.

### Fixed

- **Duplicate suggestion IDs** — `suggestionId(category, code, path)` produces deterministic, path-scoped IDs. Both static and AI providers use the same factory.

### Documentation

- Sprint 3C closeout: ROADMAP, PROJECT_STATUS, CHANGELOG, TECHNICAL_DEBT updated.
- Job Match JD parsing documented as paste-only MVP; URL-based fetching explicitly deferred.
- Technical debt item added for future URL job-description scraping/API integration. — `suggestionId(category, code, path)` produces deterministic, path-scoped IDs. Both static and AI providers use the same factory.

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

## 0.3.2-alpha - 2026-07-03

Sprint 3B — Suggestion Preview / Diff UI.

### Added

- `apps/web/components/diff-view.tsx` — word-level diff component with LCS-based algorithm, side-by-side and inline layout, added/removed/same highlighting.
- `apps/web/components/suggestion-diff-modal.tsx` — dialog overlay for reviewing suggestions before applying; supports applying, success, error, and dismiss states.
- Review flow in `SuggestionCard` — replaced direct Accept (✓) with Review (👁) button that opens the diff modal.
- Modal state management in `HealthDashboard` — split accept into review (open modal) + apply (from modal), managing `reviewingSuggestion`, `applyState`, and `modalError`.

### Changed

- `suggestion-card.tsx`: `onAccept` → `onReview` prop, Review button replaces Accept button.
- `suggestions-list.tsx`: `onAccept` → `onReview` prop pass-through.
- `health-dashboard.tsx`: suggestions rendered inline with diff modal support; removed dependency on external `SuggestionsList` for the rendered suggestions.
- E2E tests: updated to test review modal flow (open → inspect diff → apply → success) and cancel behavior (close → still pending).
- Updated ROADMAP, PROJECT_STATUS, and CHANGELOG for Sprint 3B completion.

Sprint 3A.5 — Apply Engine + Acceptance Persistence. Tagged `v0.3.1-alpha`.

### Added

- Pure-function apply engine in `packages/ai/apply/` with 5 safe operation types: `replace_summary`, `replace_bullet`, `replace_skill`, `add_skill`, `remove_skill`.
- `applyChanges()` function — transforms operation arrays into resume mutations with full immutability and no side effects.
- `ApplyError` class with operation context and reason for stale-target detection.
- `POST /api/resumes/:resumeId/suggestions/apply` — authenticated API endpoint with auth, ownership check, apply engine, and database persistence.
- `suggestionToOperation()` in `packages/ai/src/operations/factory.ts` — canonical mapping from Suggestion objects to ApplyOperation arrays.
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