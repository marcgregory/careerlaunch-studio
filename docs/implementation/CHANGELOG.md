# Changelog

All notable changes to CareerLaunch Studio will be documented here.

## 0.8.0-alpha - 2026-07-05

### Added

- **Sprint 6B — AI Resume Tailoring (Flagship Feature).** Tagged `v0.8.0-alpha`.
- **Job Analysis module** (`packages/ai/src/job-analysis/`) — Phase 1 of the tailoring pipeline. Extracts structured data from a job description: required/preferred skills, seniority, responsibilities, ATS keywords, and industry.
- **Gap Analysis module** (`packages/ai/src/gap-analysis/`) — Phase 2 of the tailoring pipeline. Compares analyzed job against normalized resume to produce match score, matched/missing skills, weak section detection, and recommendations.
- **Tailoring module** (`packages/ai/src/tailoring/`) — Phase 3 of the tailoring pipeline. Generates before/after rewrite suggestions for summary, experience bullets, and skills. Post-processing validates suggestions: before text must exist in resume, fabricated metrics capped at confidence 0.3, no invented experience.
- **Prompt files** — job-analysis/v1.md, gap-analysis/v1.md, tailor-summary/v1.md, tailor-bullets/v1.md, tailor-skills/v1.md, tailor/v1.md.
- **Prompt builders** — `buildJobAnalysisPrompt()`, `buildGapAnalysisPrompt()`, `buildTailorPrompt()`.
- **AIProvider interface extended** — optional `analyzeJob()`, `analyzeGap()`, `tailorResume()` methods.
- **MockProvider updated** — mock implementations for all three new methods.
- **Gap analysis API route** — `POST /api/resumes/:resumeId/gap-analysis`.
- **Tailor API route** — `POST /api/resumes/:resumeId/tailor` — full 3-phase pipeline.
- **Bulk apply API route** — `POST /api/resumes/:resumeId/suggestions/apply-bulk`.
- **TailoringPanel UI** — unified panel replacing old JobMatchPanel. Match score, skill comparison, weak sections, collapsible suggestion groups with inline diff preview and per-category "Apply all".
- **Tests** — 162 AI tests (18 new), 41 web, 13 domain. All passing.

## 0.7.0-alpha - 2026-07-05

### Added

- **Sprint 6A — Real AI Foundation.** Tagged `v0.7.0-alpha`.
- **Expanded AIProvider interface** (`packages/ai/src/providers/types.ts`) — added optional `generateCoverLetter()` and `matchJob()` methods so cover letter and job match features can be routed through AI providers.
- **GeminiProvider** (`packages/ai/src/providers/gemini.ts`) — full `AIProvider` implementation using Google's Gemini 2.5 Flash model with structured JSON output (`responseMimeType: "application/json"`). Supports all 6 analysis dimensions, cover letter generation, and job match.
- **GroqProvider** (`packages/ai/src/providers/groq.ts`) — full `AIProvider` implementation using Groq's fast inference API (Llama 4 Scout) via OpenAI-compatible endpoint. Shares prompts and response parsing with GeminiProvider.
- **LLM helpers** (`packages/ai/src/lib/llm.ts`) — `callGemini()` and `callOpenAICompatible()` functions with timeout, retry with exponential backoff, and JSON parsing. `LLMError` class with typed error codes (`auth`, `provider`, `empty`, `timeout`, `parse`).
- **Token utilities** (`packages/ai/src/lib/tokens.ts`) — `estimateTokens()`, `truncateToTokens()`, `estimateObjectTokens()` for token budgeting.
- **Prompt system** (`packages/ai/prompts/`) — 8 prompt files extracted from code into versioned markdown files: `ats/v1.md`, `grammar/v1.md`, `impact/v1.md`, `keywords/v1.md`, `summary/v1.md`, `tone/v1.md`, `cover-letter/v1.md`, `job-match/v1.md`. Prompt loader (`packages/ai/src/lib/prompts.ts`) with file-based loading, caching, and template variable injection.
- **Structured output validation** (`packages/ai/src/lib/validate.ts`) — validators for all dimension responses (ATS, grammar, impact, keywords, summary, tone) plus cover letter and job match. Partial results supported for graceful degradation.
- **Cost controls** (`packages/ai/src/lib/cost-control.ts`) — `withCostControls()` wrapper with token budget enforcement, exponential backoff retry, timeout, and usage tracking. `CostLimitError` for budget exhaustion.
- **In-memory cache** (`packages/ai/src/lib/cache.ts`) — dimension-aware TTL caching (1h for most dimensions, 24h for impact/tone, 30min for job match). `invalidateCache()` for targeted invalidation.
- **Centralized provider initialization** (`apps/web/lib/ai-config.ts`) — replaces inline `registerProvider("mock")` calls in route files. `initializeAI()` auto-detects configured API keys and sets the appropriate default provider. Environment-controlled via `AI_DEFAULT_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`.

### Changed

- **`generateCoverLetter()`** (`packages/ai/src/cover-letter/generate.ts`) — now async. Delegates to provider's `generateCoverLetter()` if available, falls back to deterministic template. Original synchronous logic preserved as `deterministicGenerateCoverLetter()`.
- **`runJobMatch()`** (`packages/ai/src/job-match/index.ts`) — now async. Delegates to provider's `matchJob()` if available, falls back to dictionary-based matcher. Original synchronous logic preserved as `deterministicRunJobMatch()`.
- **Provider registration** — removed inline `registerProvider("mock", ...)` from `analyze/route.ts` and `job-match/route.ts`. Replaced with `initializeAI()` call that registers all providers centrally.
- **`packages/ai/src/index.ts`** — added exports for all new modules: `GeminiProvider`, `GroqProvider`, LLM helpers, token utilities, prompt loader, validators, cost controls, cache.
- **`packages/ai/src/providers/types.ts`** — added imports for `NormalizedResume`, `CoverLetterInput`, `GeneratedCoverLetter`, `JobMatchResult`.

### Added

- **Environment variables** — `GEMINI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER` documented in `.env.example`.
- **Dependencies** — `@google/genai` added to `packages/ai/package.json`.

## 0.6.0-alpha - 2026-07-04

### Added

- **Sprint 5 — Billing & Entitlement System.** Tagged `v0.6.0-alpha`.
- **Billing architecture document** (`docs/architecture/BILLING.md`) — defines entitlement model, plan registry, feature gate strategy, webhook flow, subscription lifecycle, upgrade/downgrade behavior, and failure handling.
- **Prisma migration** (`20260704040000_add_plan_billing_fields`) — adds `Plan` enum (`FREE`, `PROFESSIONAL`, `ENTERPRISE`), `plan` and `cancelAtPeriodEnd` columns to `Subscription`, and converts `userId` index to unique constraint.
- **Entitlement domain package** (`packages/domain/src/entitlements/`) — `types.ts` (PlanId, Entitlements, FeatureKeys), `plans.ts` (plan definitions with per-feature values). Three plans defined: Free (3 resumes, 2 templates, watermarked PDF, 5 exports/mo), Professional (unlimited everything, clean PDF, job match), Enterprise (unlimited + priority support). Exported from `@careerlaunch/domain`.
- **Entitlement service** (`apps/web/lib/entitlements.ts`) — runtime service: `getSubscription()`, `can()`, `getFeatureValue()`, `requireEntitlement()`, `canExportPdf()`, `getPdfExportKind()`, `canUseTemplateByUser()`. Grace period for PAST_DUE accounts.
- **Entitlement gates** — PDF export route checks `canExportPdf()` (403 on limit reached), cover letter PDF export gated, builder page checks `resume_limit` entitlement before creating new resumes, watermark applied for Free plan.
- **PDF watermark** (`packages/rendering/src/pdf.tsx`, `cover-letter-pdf.tsx`) — `PdfOptions.watermarked` parameter renders semi-transparent "Created with CareerLaunch Studio" watermark across the page. Applied when plan is Free, removed for Professional+.
- **Stripe integration** — lazy-initialized `getStripe()` in `apps/web/lib/stripe.ts`. Checkout (`/api/billing/checkout`), Customer Portal (`/api/billing/portal`), webhook handler (`/api/billing/webhook`) for `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. `/api/billing/subscription` returns current plan and all plans.
- **Pricing page** (`/billing`) — client component with 3-column plan comparison, feature breakdown, current-plan badge, upgrade buttons calling Stripe Checkout. Handles checkout success/canceled/resume-limit redirect states.
- **Account billing page** (`/account/billing`) — shows current plan, usage stats (monthly exports, export quality), manage billing button linking to Stripe Customer Portal.
- **Dashboard upgrade prompts** — Free plan users see upgrade banner at top of dashboard. Sidebar shows "Free plan" badge with link to `/billing` and a "Billing" menu item.
- **Health endpoint** — billing configuration check added (Stripe keys + price IDs).
- **14 entitlement tests** — plan definitions, `can()` checks, `canUseTemplate()`, `getResumeLimit()`, `getFeatureValue()`. All pass.
- **Environment variables** — `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PROFESSIONAL_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `PAST_DUE_GRACE_DAYS`, `NEXT_PUBLIC_BASE_URL` documented in `.env.example`.

### Changed

- Subscription model: `@@index([userId])` replaced with `@@unique([userId])`.
- PDF renderer: `renderResumePdf()` and `resumeToHtml()` now accept `PdfOptions` parameter.
- Cover letter PDF renderer: `renderCoverLetterPdf()` and `coverLetterToHtml()` now accept `CoverLetterPdfOptions`.
- Dashboard sidebar refreshed with billing link, plans link, resume count.

## 0.5.1-alpha - 2026-07-04

### Added

- **Sprint 4.5 — Production Readiness.**
- **Request ID middleware** (`apps/web/lib/request-id.ts`) — extracts or generates `X-Request-ID` for cross-service correlation. PDF export routes now forward the incoming request ID to the renderer instead of generating a new one.
- **Sentry error monitoring** (`@sentry/nextjs` v10.63.0) — server and client config files, `reportError()` helper, instrumented 6 high-risk API routes (analyze, job-match, cover-letter generate, PDF export, cover-letter PDF export, import). `SentryErrorBoundary` wraps the builder page with resume ID context. `next.config.mjs` wrapped with `withSentryConfig`.
- **PostHog product analytics** — `AnalyticsProvider` in root layout, `useAnalytics()` hook on the client, `captureServerEvent()` for server-side fire-and-forget events. Events tracked: `resume_exported`, `resume_imported`, `analysis_run`, `job_match_run`, `cover_letter_generated`, `cover_letter_exported`. Only fires in production.
- **Rate limiting** (`apps/web/lib/rate-limit.ts`) — in-memory sliding-window rate limiter with periodic stale-entry sweep. Applied to 5 high-risk routes: analyze (10/hr), exports (20/hr), job match (20/hr), import (5/hr). Returns 429 with `Retry-After` and `X-RateLimit-Remaining` headers.
- **Health endpoint** (`GET /api/health`) — returns app version, database connectivity (via `SELECT 1`), and PDF renderer health (proxied). Returns 200/503.
- **Backup recovery documentation** (`docs/operations/BACKUP_RECOVERY.md`) — Neon restore procedure, migration rollback options, emergency SQL dump command.

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