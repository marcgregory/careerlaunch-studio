# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 3A.5 — Apply Engine + Acceptance Persistence is complete. Tagged `v0.3.1-alpha`.

### Delivered This Sprint (3A.5)

**Apply Engine (`packages/ai/apply/`):**
- Pure-function `applyChanges()` — transforms `ApplyOperation[]` into `ResumeDocument` mutations with full immutability and no side effects.
- 5 safe operation types: `replace_summary`, `replace_bullet`, `replace_skill`, `add_skill`, `remove_skill`.
- `ApplyError` class for stale-target detection with operation context and reason.
- 49 unit tests covering all operations, stale target failure, immutability, and multi-operation composition.

**API Route — `POST /api/resumes/:resumeId/suggestions/apply`:**
- Thin auth + persistence wrapper around `applyChanges()`.
- Returns 409 for stale targets (ApplyError), 400 for invalid payloads, 401/404 for auth/ownership.
- Persists updated resume to database on success.

**Suggestion → Operation Mapping:**
- `apps/web/lib/suggestion-to-operation.ts` — maps `Suggestion` objects to `ApplyOperation[]` for summary, experience/impact bullets, and skill replacements.
- Returns `null` for unsupported categories (education, contact, formatting, etc.) so the caller can gracefully skip.

**UI Integration:**
- `HealthDashboard.handleAccept()` now calls the apply API via `onApplySuggestion` callback.
- Optimistic local state update (marks suggestion "accepted" immediately), reverts to "pending" on API failure.
- Error banner shown when apply fails (stale target, network error, unsupported operation).
- `ResumeBuilder.handleApplySuggestion()` receives `ApplyOperation[]`, calls the API, updates local resume state on success so the preview reflects changes immediately.

**Testing:**
- 21 unit tests for `suggestionToOperation()` mapping function.
- Playwright E2E test: accept a suggestion and verify preview updates.
- Playwright E2E test: 409 stale target behavior.
- Playwright E2E test: resume unchanged when apply returns 409.
- Playwright E2E test: direct apply API verification (persistence check).

### Next Up

Sprint 3B — AI Rewrite Assistance. Bullet rewrites, summary improvements, headline tuning, shorten/expand.

## Completed

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

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering lives in `packages/rendering` with a browser-safe preview entry and a server-only Playwright renderer entry. The template registry is the single source of truth for both browser preview and PDF rendering.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. The local environment has `DATABASE_URL` available to Playwright, and the database-backed signup/save/export flow passes locally.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Complete Sprint 3A — AI Analysis Engine with working analysis pipeline, suggestion UI, accept/reject flow, and quota enforcement.

## Last Build

Local build verification passed on 2026-07-03:

- `npm run build` — passes
- `npm run test` — 70/70 AI tests + 2/2 domain tests pass (21 new suggestion-to-operation tests)
- `npm run typecheck` — passes
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability

Playwright covers anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, builder section/item ordering persistence, visual regression across all 4 templates, template-specific PDF QA, suggestion acceptance flow, stale-target 409 handling, and apply API persistence.