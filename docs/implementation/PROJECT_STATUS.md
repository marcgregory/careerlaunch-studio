# CareerLaunch Studio Project Status

Last updated: 2026-07-04

## Current Sprint

Sprint 4 — Import Existing Resume and Version Duplication.

### Delivered This Sprint (3D)

Sprint 3D — Cover Letter Builder MVP is complete and tagged `v0.4.0-alpha`.

**Cover Letter Model & Persistence (`prisma/schema.prisma` + migration):**
- New `CoverLetter` model linked to `User` and `ResumeDocument` (one per resume, upsert).
- Fields: recipient name/title/company/address, salutation, body, closing, signatureName, jobDescription.
- Migration applied to local database.

**Domain Type (`packages/domain/src/index.ts`):**
- `CoverLetterDocument` type added — mirrors the Prisma model for type-safe client use.

**AI Generator (`packages/ai/src/cover-letter/`):**
- `generateCoverLetter(input)` — deterministic, template-based mock that produces realistic placeholder text.
- Extracts candidate name, target role, up to 3 key skills, and experience highlights.
- References optional job description in the opening paragraph when provided.
- 8 unit tests covering all states (with JD, without JD, empty resume, no skills, paragraph structure).

**PDF Renderer (`packages/rendering/src/cover-letter-pdf.tsx`):**
- Business-letter format: date line, recipient block, salutation, body paragraphs, closing, signature.
- Uses the resume's template `getResumeTemplate()` for font family and accent color consistency.
- Same Playwright render pipeline as resume PDF.
- Exported via `@careerlaunch/rendering/cover-letter-pdf`.

**API Routes:**
- `GET /api/resumes/:resumeId/cover-letter` — load existing cover letter (or null).
- `PUT /api/resumes/:resumeId/cover-letter` — upsert cover letter fields.
- `POST /api/resumes/:resumeId/cover-letter/generate` — generate draft via mock, upsert, return.
- `POST /api/export/cover-letter-pdf` — render and return PDF bytes.
- All routes authenticated with ownership checks.

**CoverLetterPanel UI (`apps/web/app/builder/_analysis/cover-letter-panel.tsx`):**
- Self-contained panel integrated into the builder sidebar alongside HealthDashboard and JobMatchPanel.
- States: idle (generate prompt + optional JD textarea), generating (spinner), editing (body textarea + recipient fields + salutation + closing), saving, exporting, error.
- Auto-loads existing cover letter on mount.
- Regenerate button to start fresh.
- Full Polish: save indicator, error recovery with retry, disabled states during async operations.

### Delivered This Sprint (3C)

Sprint 3C — Job Match MVP is complete and tagged `v0.3.3-alpha`.

**Job Match Engine (`packages/ai/src/job-match/`):**
- `normalize-job.ts` — tokenizes job descriptions, extracts skills via 80-skill dictionary, identifies experience level indicators.
- `compare.ts` — compares resume against JD skills, categorizes as present vs missing.
- `keywords.ts` — token-level overlap analysis between resume and JD.
- `score.ts` — match score 0–100 based on skill coverage ratio, floored at 10.
- `index.ts` — `runJobMatch()` orchestrator that normalizes, compares, scores, and returns suggestions.
- All 39 job-match tests pass.

**Operation Factory Upgrade (`packages/ai/src/operations/factory.ts`):**
- `createOperations(suggestion, resume)` — upgraded to accept resume context, enabling `add_skill` operations.
- `suggestionToOperation(suggestion)` preserved as deprecated wrapper.
- `"job-match"` SuggestionCategory added for add_skill suggestions.

**API:**
- `POST /api/resumes/:resumeId/job-match` — authenticated, validates input, persists `AnalysisRun` with type `"job_match"`.

**AnalysisRun Table:**
- Prisma model, migration `20260703083953_add_analysis_run`.
- Persisted for both `/analyze` and `/job-match` API calls.
- `AnalysisRunRecord` type exported from `@careerlaunch/ai`.

**UI (`apps/web/app/builder/_analysis/job-match-panel.tsx`):**
- Self-contained panel with paste textarea, Analyze Match button.
- Match score gauge with strong/moderate/weak labels.
- Missing vs Present skills in side-by-side columns.
- Suggestion cards with Review (opens diff modal) and Dismiss.
- Handles all states: idle, loading, error, success, empty JD, no extracted skills.
- Integrated into builder sidebar alongside HealthDashboard.

### Architecture Note

Job Match JD parsing is paste-only. URL-based job-description fetching is explicitly deferred to a future sprint — no scraping/API integration.

### Next Up

- Sprint 4 — Import Existing Resume and Version Duplication.
- Sprint 5 — Paid Export Gates, Premium Template Entitlements, Subscription Tier Enforcement.
- Future — URL job-description fetching for Job Match.

## Completed

### Sprint 3B — Suggestion Preview / Diff UI ✅

**Diff Component (`apps/web/components/diff-view.tsx`):**
- Word-level diff algorithm using LCS (longest common subsequence) — no external dependencies.
- Side-by-side and inline layout modes with word-level added/removed/same highlighting.
- Pure function `wordDiff()` returns structured `DiffResult` for use outside React.
- Handles all edge cases: empty old/new text, complete replacement, partial overlap, punctuation.

**Diff Modal (`apps/web/components/suggestion-diff-modal.tsx`):**
- Dialog overlay showing suggestion severity, title, reason, and before/after diff.
- Two-step UX: Review opens modal → user inspects diff → Apply from modal.
- Handles all states: idle, applying (spinner), applied (auto-close after 1.5s), error with message.
- Close on Escape, backdrop click, Cancel button.
- Informational suggestions (no text change) show a polite message instead of diff.

**SuggestionCard Changes:**
- Replaced direct Accept (✓) button with a **Review** button (👁 Review) that opens the diff modal.
- Dismiss (X) remains one-click, unchanged.
- `onAccept` → `onReview` prop rename; `onReject` unchanged.

**HealthDashboard Changes:**
- `handleAccept` split into `handleReview` (opens modal) + `handleApplyFromModal` (calls API).
- New state: `reviewingSuggestion`, `applyState`, `modalError`.
- `SuggestionDiffModal` rendered when a suggestion is being reviewed.
- Suggestions now rendered inline instead of via `SuggestionsList` component.

### Sprint 2 — Template Library and Resume Checker Depth ✅

**Tagged:** `v0.2.0` / `Sprint-2-complete`

The template system has been refactored from per-template conditionals to a registry-driven architecture:

- **Template registry** (`packages/rendering/src/index.tsx`): Each template is defined by semantic properties (`headerStyle`, `nameStyle`, `roleStyle`) rather than hardcoded ID checks. Adding a new template requires one config object with no renderer changes.
- **Metadata-driven gallery**: Templates carry `premium`, `accentColor`, and `swatches`. The gallery uses these for selection highlights and premium lock overlays.
- **PDF from registry**: The PDF renderer generates CSS programmatically from the template definition via `pdfCss()`, eliminating preview/PDF drift.
- **Four polished templates**: Modern (accent bar, editorial), Executive (double-rule, serif-adjacent), Minimal (thin-rule, monochrome), ATS Classic (simple, parser-friendly).
- **Test coverage**: Visual regression tests (Playwright `toHaveScreenshot()`), template-specific PDF QA, per-template PDF validation — all passing.
- **Sprint 2 user assessment**: Architecture 10/10, Rendering Pipeline 10/10, Testing 10/10, Maintainability 10/10, Extensibility 10/10.

## Architecture Status

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering is separated into a standalone Docker service (`services/pdf-renderer/`) authenticated with a shared bearer token, with the Vercel app falling back to the in-process Playwright renderer when `PDF_RENDERER_URL` is unset (local dev). The template registry is the single source of truth for both browser preview and PDF rendering. AI suggestions flow through a layered pipeline: Analysis → Suggestion → Review UI → Diff → Apply Engine → Persistence, with Job Match now using the same pipeline unchanged.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. Build passes with 146 AI tests and 2 domain tests. PDF renderer service has production hardening: bearer auth, timeouts, request validation, health endpoint, browser reuse, correlation ID logging, and a Dockerfile for Railway deployment.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Complete Sprint 4 — Import Existing Resume and Version Duplication.

## Last Build

Local build verification passed on 2026-07-03:

- `npm run build` — passes
- `npm run test` — 144/144 AI tests + 2/2 domain tests pass (8 new cover letter tests)
- `npm run typecheck` — passes (AI, rendering, domain packages)
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability

Playwright covers anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, builder section/item ordering persistence, visual regression across all 4 templates, template-specific PDF QA, suggestion review modal flow, suggestion acceptance via modal, stale-target 409 handling, cancel review modal behavior, and apply API persistence.
