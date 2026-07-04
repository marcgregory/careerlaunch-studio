# CareerLaunch Studio Project Status

Last updated: 2026-07-04

## Current Sprint

Sprint 4.5 — Production Readiness.

### Delivered This Sprint (Sprint 4.5)

**Request ID middleware:**
- `apps/web/lib/request-id.ts` — extracts or generates `X-Request-ID` for correlation across services.
- PDF export routes (`/api/export/pdf`, `/api/export/cover-letter-pdf`) now forward the incoming request ID to the renderer.

**Sentry error monitoring:**
- `@sentry/nextjs` (v10.63.0) installed and configured with `sentry.client.config.ts`, `sentry.server.config.ts`, and `instrumentation.ts`.
- `apps/web/lib/error-reporting.ts` — `reportError()` helper that captures exceptions with request ID tags, no-ops in development.
- 6 high-risk API routes instrumented with Sentry error capture: `/analyze`, `/job-match`, `/cover-letter/generate`, `/export/pdf`, `/export/cover-letter-pdf`, `/import/text`.
- `SentryErrorBoundary` wraps the builder page with resume ID context.
- `next.config.mjs` wrapped with `withSentryConfig`.

**PostHog product analytics:**
- `posthog-js` (client) and `posthog-node` (server) installed.
- `apps/web/lib/analytics.tsx` — `AnalyticsProvider` (root layout) and `useAnalytics()` hook. Only fires in production.
- `apps/web/lib/server-analytics.ts` — `captureServerEvent()` for fire-and-forget server-side events.
- Events tracked: `resume_exported`, `resume_imported`, `analysis_run`, `job_match_run`, `cover_letter_generated`, `cover_letter_exported`.
- Server-side `analysis_run` and `job_match_run` events capture scores and counts.

**Rate limiting:**
- `apps/web/lib/rate-limit.ts` — in-memory sliding-window rate limiter with periodic stale-entry sweep. No external dependencies. Swappable to Upstash Redis for multi-instance deployments.
- Limits applied: analyze (10/hr), export (20/hr), cover-letter PDF export (20/hr), job match (20/hr), import (5/hr).
- All return 429 with `Retry-After` header and `X-RateLimit-Remaining`.

**Health endpoint:**
- `GET /api/health` — returns JSON with app version, database connectivity (`SELECT 1`), and PDF renderer health (proxied). Returns 200 if all checks pass, 503 if degraded.

**Backup recovery documentation:**
- `docs/operations/BACKUP_RECOVERY.md` documents Neon restore procedure, migration rollback options, emergency SQL dump command, and testing steps.

### Delivered This Sprint (Sprint 4)

Sprint 4 is complete and tagged `v0.5.0-alpha`.

**Version Duplication (4A):**
- `POST /api/resumes/:resumeId/duplicate` — ownership-checked clone endpoint. Creates a new `ResumeDocument` with title `"Copy of {original}"` and a `ResumeVersion` with source reference.
- Dashboard: "Duplicate" button (Copy icon) on each resume card. Client-side component calls the API and refreshes the list.
- Preserves all content, template, section order, and structure. Original is never modified.

**Resume Import MVP (4B):**
- `packages/ai/src/import/text-parser.ts` — regex-based section parser. Detects summary, experience, education, skills, certifications, projects sections; extracts contact info (name, email, phone, location, website). Pure function with no AI dependency. Returns `{ parsed, confidence, warnings }`.
- `POST /api/import/text` — authenticated, max 50 KB payload, returns parse result.
- `/import` page — paste → parse → preview → create draft flow. States: idle, parsing (spinner), preview (with confidence warning), saving, error. Confidence <50% triggers warning banner. Import creates a new draft, never mutates existing resumes.
- Dashboard: "Import" button added alongside "New resume".

**PDF Renderer Architecture (between sprints):**
- PDF rendering separated into standalone Docker service (`services/pdf-renderer/`). Removed `@sparticuz/chromium-min`, `CHROMIUM_PACK_URL`, and all Vercel Chromium workarounds.
- Production hardening: bearer auth (`PDF_RENDERER_TOKEN`), timeouts (30s), health endpoint (`GET /health`), request validation (5 MB max), browser reuse across requests, correlation ID logging (`X-Request-ID`).
- Env gate: `PDF_RENDERER_URL` set → external renderer; unset → in-process Playwright (local dev).
- `v0.4.1-alpha` tagged after PDF architecture separation.

### Delivered This Sprint (3C)

Sprint 3C — Job Match MVP is complete and tagged `v0.3.3-alpha`.

**Job Match Engine (`packages/ai/src/job-match/`):**
- `normalize-job.ts` — tokenizes job descriptions, extracts skills via 80-skill dictionary, identifies experience level indicators.
- `compare.ts` — compares resume against JD skills, categorizes as present vs missing.
- `keywords.ts` — token-level overlap analysis between resume and JD.
- `score.ts` — match score 0–100 based on skill coverage ratio, floored at 10.
- `index.ts` — `runJobMatch()` orchestrator that normalizes, compares, scores, and returns suggestions.
- All 39 job-match tests pass.

**UI (`apps/web/app/builder/_analysis/job-match-panel.tsx`):**
- Self-contained panel with paste textarea, Analyze Match button.
- Match score gauge with strong/moderate/weak labels.
- Missing vs Present skills in side-by-side columns.
- Suggestion cards with Review (opens diff modal) and Dismiss.

### Architecture Note

Job Match JD parsing is paste-only. URL-based job-description fetching is explicitly deferred to a future sprint — no scraping/API integration.

### Next Up

- Sprint 5 — Paid Export Gates, Premium Template Entitlements, Subscription Tier Enforcement.
- Future — URL job-description fetching for Job Match.

## Completed

### Sprint 4 — Import Existing Resume and Version Duplication ✅

Covered above.

### Sprint 3D — Cover Letter Builder MVP ✅

- CoverLetter Prisma model and migration.
- AI mock generator producing deterministic placeholder text.
- Cover letter PDF renderer in business-letter format.
- API routes for load, upsert, generate, and PDF export.
- CoverLetterPanel UI in builder sidebar with full state coverage.

### Sprint 3C — Job Match MVP ✅

Covered above.

### Sprint 3B — Suggestion Preview / Diff UI ✅

- Word-level diff component using LCS algorithm with side-by-side/inline layouts.
- Diff modal with two-step Review → Apply UX.
- SuggestionCard with Review button and Dismiss.

### Sprint 2 — Template Library and Resume Checker Depth ✅

- Template registry with semantic properties replacing per-template conditionals.
- Metadata-driven gallery with premium lock overlays.
- Four polished templates: Modern, Executive, Minimal, ATS Classic.
- Playwright visual regression and PDF QA tests.

### Sprint 1 — Foundation ✅

- Monorepo, Next.js app, PostgreSQL/Prisma, auth, resume builder, PDF export.

## Architecture Status

TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, auth with signed HTTP-only cookies. PDF rendering is separated into a standalone Docker service. The template registry is the single source of truth for both preview and PDF. Error monitoring (Sentry), analytics (PostHog), rate limiting (in-memory sliding window), and a health endpoint are now in place. AI suggestions flow through a layered pipeline: Analysis → Suggestion → Review UI → Diff → Apply Engine → Persistence.

## Platform Status

Build passes with 146 AI tests + 2 domain tests. Sentry captures server and client errors. PostHog tracks key user events. Rate limits protect high-risk API routes. Health endpoint monitors DB and renderer. Backup procedures documented.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Complete Sprint 5 — Paid Export Gates, Premium Template Entitlements, Subscription Tier Enforcement.

## Last Build

Local build verification passed on 2026-07-04:

- `npm run build` — passes (includes new `/api/health`, Sentry config, PostHog config)
- `npm run test` — 146/146 AI tests + 2/2 domain tests pass
- `npm run typecheck` — passes (all workspaces)
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability
