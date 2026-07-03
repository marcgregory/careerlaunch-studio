# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 3C — Job Match MVP is complete.

### Delivered This Sprint (3C)

**Job Match Engine (`packages/ai/src/job-match/`):**
- `normalize-job.ts` — tokenizes job descriptions, extracts skills via 80-skill dictionary, identifies experience level indicators.
- `compare.ts` — compares resume against JD skills, categorizes as present (in skills list or mentioned in text) vs missing.
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
- Match score display with strong/moderate/weak labels.
- Missing vs Present skills in side-by-side columns.
- Suggestion cards with Review (opens diff modal) and Dismiss.
- Handles all states: idle, loading, error, success, empty JD, no extracted skills.
- Integrated into builder sidebar alongside HealthDashboard.

### Next Up

- Sprint 3D — Cover Letter Builder. Reuses resume, job description, template engine, and PDF renderer.
- Sprint 4 — Import Existing Resume and Version Duplication.
- Sprint 5 — Paid Export Gates, Premium Template Entitlements, Subscription Tier Enforcement.

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

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering lives in `packages/rendering` with a browser-safe preview entry and a server-only Playwright renderer entry. The template registry is the single source of truth for both browser preview and PDF rendering. AI suggestions flow through a layered pipeline: Analysis → Suggestion → Review UI → Diff → Apply Engine → Persistence, with Job Match now using the same pipeline unchanged.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. Build passes with 136 AI tests and 2 domain tests.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Complete Sprint 3D — Cover Letter Builder using existing template and PDF infrastructure.

## Last Build

Local build verification passed on 2026-07-03:

- `npm run build` — passes
- `npm run test` — 136/136 AI tests + 2/2 domain tests pass
- `npm run typecheck` — passes
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability

Playwright covers anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, builder section/item ordering persistence, visual regression across all 4 templates, template-specific PDF QA, suggestion review modal flow, suggestion acceptance via modal, stale-target 409 handling, cancel review modal behavior, and apply API persistence.
