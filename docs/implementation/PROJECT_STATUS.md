# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 3A — AI Analysis Engine is active. Read-only analysis: ATS scoring, grammar, impact statements, keyword density, completeness. Suggestions flow through accept/reject. Static analysis runs without AI. Provider abstraction. Cost controls and quota enforcement.

### Delivered This Sprint

- `docs/architecture/AI.md` — comprehensive AI architecture document covering design principles, analysis pipeline, suggestion schema, provider abstraction, prompt architecture, response validation, caching, cost controls, privacy, and success criteria.
- `packages/ai` — new package with AI provider abstraction, registry, MockProvider, resume normalizer, static analysis engine (20+ deterministic checks), analysis orchestrator, and scoring engine. 49 unit tests.
- `GET /api/resumes/:resumeId/analyze` — authenticated, read-only analysis endpoint.
- Builder preview panel — now sticky (`sticky top-6 self-start`) with `max-h-[calc(100vh-6rem)]` and inner scroll, keeping the resume visible while editing.
- `HealthDashboard` component — interactive resume health widget with ScoreGauge (SVG ring, colour-coded 0–100), category breakdown, and "Analyze Resume" button with idle/loading/success/error states.
- `SuggestionsList` component — suggestions grouped by severity (critical → info) with expand/collapse detail, accept/dismiss buttons, and resolved status tags. All accept/dismiss is client-side UI state only — no auto-application to the resume.
- `SuggestionCard` component — individual suggestion with severity badge, source label (`Auto`/`AI`), target text block, and suggested text block.

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
- `npm run test` — 49/49 AI tests + 2/2 domain tests pass
- `npm run typecheck` — passes
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability

Playwright covers anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, builder section/item ordering persistence, visual regression across all 4 templates, and template-specific PDF QA.