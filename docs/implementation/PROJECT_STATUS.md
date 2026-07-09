# CareerLaunch Studio Project Status

Last updated: 2026-07-09 (dashboard UX overhaul)

## Current Sprint

Sprint 6D — Beta Hardening & Release Candidate (v0.9.5).

**Goal:** Validate that CareerLaunch Studio is ready for a closed beta with real users.

**Golden Rule:** No new features. Only bug fixes, UX improvements, performance, accessibility, reliability, and documentation.

### Phases

1. **Dogfooding** — 🟡 Pipeline layer done (6/6 personas pass automated analysis/gap/tailor). UI walkthrough pending. Fixed persona profiles added to eval dataset for repeatable QA.
2. **AI Benchmark** — ✅ PASS. All targets met: 100% JSON validity, 100% schema pass, 0% prompt failure, 0% fabrication rate, σ=0.0 consistency. Benchmark runner created at `scripts/eval/benchmark/benchmark-runner.ts`.
3. **Error Recovery** — ✅ PASS. All 8 scenarios (timeout, invalid JSON, empty response, rate limit, unavailable, quota exceeded, network disconnect, CostLimitError) degrade gracefully. Runner at `scripts/eval/error-recovery.ts`.
4. **Mobile QA** — ⬜ Template created. Requires browser-based verification on 375px viewport.
5. **Accessibility Audit** — ⬜ Template created. Requires keyboard-only + screen reader audit.
6. **Performance** — ⬜ Template created. Requires browser-based P50/P95/P99 measurement. Build compiles in 44s, 27 pages.
7. **Closed Beta Checklist** — ⬜ Not started. Requires production deployment and configuration.

### Auth Hardening (Added Sprint 6D)

See `docs/implementation/AUTH_HARDENING_PLAN.md`.

| Feature | Status |
|---|---|
| Password reset | ✅ Implemented |
| Rate limiting (login/register/forgot-password) | ✅ Implemented |
| Email verification (soft enforcement) | ✅ Implemented |
| Token security (SHA-256 hashed, single-use, expiring) | ✅ Implemented |
| Resend email integration | ✅ Implemented |

### Sprint 6D Infrastructure Created

- **Fixed persona fixtures:** 6 new resume+JD pairs (resume-16 to resume-21) in `scripts/eval/datasets/`
- **Dogfooding runner:** `scripts/eval/dogfooding/dogfood-runner.ts` — automated pipeline check
- **Benchmark runner:** `scripts/eval/benchmark/benchmark-runner.ts` — 7 AI quality metrics
- **Error recovery runner:** `scripts/eval/error-recovery.ts` — 8 failure scenarios
- **6 report templates:** in `docs/release/` — DOGFOODING, MOBILE_QA, ACCESSIBILITY, PERFORMANCE, KNOWN_ISSUES, RELEASE_REPORT
- **Release report format:** Standard template for all future releases (v0.9.5, v1.0.0-beta, v1.0.0, etc.)
- **Updated build plan:** Fixed personas, rigid workflow, severity labels, release gate rules
- **npm scripts:** `eval:dogfooding`, `eval:benchmark`, `eval:recovery`

### Delivered This Sprint (Sprint 6D)

**Dashboard UX Overhaul (2026-07-09):**
- Search, sort, and filters — client-side search bar, sort (Recently Updated / Title A–Z / Oldest First), filter (All / Targeted / Untargeted / Analyzed)
- Actions dropdown menu (`⋮`) — Rename (inline modal), Duplicate, Export PDF, Delete with confirmation
- Recency grouping — resumes grouped by Today / Yesterday / This Week / Earlier
- Enriched workspace sidebar — 2×2 stat grid (Total / Targeted / Analyzed / Exports), upgrade CTA
- Status badges (Draft / Analyzed) with color-coded dots on every card
- Relative timestamps ("2 min ago", "Yesterday", "Jul 5")
- Target role as primary identifier above the resume title
- Template-color thumbnail placeholders on each card
- Separate empty states for "no resumes" vs. "search/filter produced no results"
- "Continue" relabeled to "Edit Resume →"
- New API: DELETE and PATCH `/api/resumes/:resumeId` for rename and delete
- `duplicate-button.tsx` removed — folded into the actions dropdown

### Delivered This Sprint (Sprint 6C)

**User Feedback System:**
- New `SuggestionFeedback` Prisma model stores per-suggestion feedback with provider/model/promptVersion metadata.
- `POST /api/resumes/:resumeId/suggestions/feedback` — non-blocking, fire-and-forget API for feedback submission.
- `SuggestionFeedback` component (`apps/web/components/suggestion-feedback.tsx`) — 👍/👎 buttons on every suggestion.
- On 👎 click, reason picker appears: "Too generic", "Incorrect", "Invented information", "Doesn't match my writing", "Other" (with free text).
- Feedback integrated into TailoringPanel, SuggestionCard, and JobMatchPanel — shown after suggestion is acted on.

**Acceptance Analytics:**
- New `SuggestionEvent` Prisma model tracks lifecycle: viewed, accepted, rejected, applied.
- `POST /api/resumes/:resumeId/suggestions/event` — lightweight, fire-and-forget lifecycle logger.
- `GET /api/analytics/acceptance` — aggregated endpoint returning acceptance rate by category, rejection reasons, and overall stats.
- `AnalysisRun` extended with `viewedCount`, `acceptedCount`, `appliedCount`, `rejectedCount` columns.

**Explainability UI:**
- `ConfidenceBar` component (`apps/web/components/confidence-bar.tsx`) — colored bar (green ≥80%, yellow ≥50%, red <50%) with percentage label.
- "Why" section heading added above every suggestion reason in TailoringPanel, SuggestionCard, and SuggestionDiffModal.
- Confidence bar displayed alongside every suggestion reason.

**Safety Review:**
- Post-processing (`packages/ai/src/tailoring/post-process.ts`) now detects 3 safety flag types:
  - `fabricated_metric` — new numbers in `after` not present in `before`
  - `leadership_inflation` — weak verbs replaced with strong ones without evidence
  - `responsibility_expansion` — specific responsibilities added not in the original
- `SafetyFlag` type added to `TailorSuggestion` interface.
- Yellow warning badge shown in TailoringPanel for flagged suggestions: "⚠ Review carefully" with explanation.

**Evaluation Suite:**
- `scripts/eval/` — CLI runner with 15 resume and 15 job description fixtures.
- Tests job analysis, gap analysis, and tailoring through all pipeline phases.
- Measures latency per call, validates output shape, reports pass/fail.
- Supports `--ai` flag for AI-powered runs alongside deterministic, `--json` for CI output.
- `npm run eval` to execute.

**Tests:**
- 7 new safety detection tests covering all 3 flag types and edge cases.
- Full test suite: 169 AI tests + 41 web tests + 13 domain tests = 223 total, all passing.

**Token utilities (`packages/ai/src/lib/tokens.ts`):**
- `estimateTokens()` — ~4 chars per token heuristic.
- `truncateToTokens()` — word-boundary-aware truncation with ellipsis.
- `estimateObjectTokens()` — JSON-stringify then estimate.

**Prompt system (`packages/ai/prompts/`):**
- 8 prompt files extracted from code to versioned markdown: `ats/v1.md`, `grammar/v1.md`, `impact/v1.md`, `keywords/v1.md`, `summary/v1.md`, `tone/v1.md`, `cover-letter/v1.md`, `job-match/v1.md`.
- Consistent template format: `# Role` → `# Instructions` → `# Resume` → `# Response Format` (JSON schema).
- Template variables: `{resume_json}`, `{job_description}`.
- Prompt loader (`packages/ai/src/lib/prompts.ts`) — file-based loading with in-memory caching, `# Role` section extraction as system prompt.
- `buildSystemPrompt()`, `buildCoverLetterPrompt()`, `buildJobMatchPrompt()` for each use case.

**Structured output validation (`packages/ai/src/lib/validate.ts`):**
- Validators for all 6 dimensions: `validateATS`, `validateGrammar`, `validateImpact`, `validateKeywords`, `validateSummary`, `validateTone`.
- `validateCoverLetter` and `validateJobMatch` for generation/match endpoints.
- Partial results: returns lowered confidence instead of throwing when some fields are valid.
- `ValidationError` class with field and reason context.
- Score range enforcement (0–100), string type checking, array element validation.

**Cost controls (`packages/ai/src/lib/cost-control.ts`):**
- `withCostControls()` — wraps any provider call with budget check, timeout, retry.
- Token budget per user (24h sliding window, configurable via `CostConfig`).
- `checkTokenBudget()`, `recordTokenUsage()`, `getCallCount()` for usage tracking.
- `CostLimitError` when budget is exceeded.
- `estimateAnalysisTokens()` for input + estimated output tokens.

**In-memory cache (`packages/ai/src/lib/cache.ts`):**
- Dimension-aware TTLs: 1h for ats/grammar/summary/cover-letter, 24h for impact/tone, 30min for job-match.
- `hashValue()` — simple deterministic hash for cache keys.
- `buildCacheKey()` — `{provider}:{dimension}:{resumeHash}[:{jdHash}]` format.
- `invalidateCache()` — substring-pattern invalidation.
- Automatic expired entry cleanup on stats retrieval.

**Centralized provider initialization (`apps/web/lib/ai-config.ts`):**
- `initializeAI()` — idempotent, registers MockProvider + any configured providers.
- Auto-detects `AI_DEFAULT_PROVIDER` env var, falls back to first available provider with valid API key, then mock.
- `hasRealAIProvider()` — quick check for real provider availability.
- `resetAIInitialization()` — test support.

**Cover letter generator update (`packages/ai/src/cover-letter/generate.ts`):**
- `generateCoverLetter()` now async — delegates to provider if available, falls back to deterministic.
- Original synchronous logic preserved as `deterministicGenerateCoverLetter()`.
- Graceful error handling: provider errors fall through to deterministic fallback.

**Job match engine update (`packages/ai/src/job-match/index.ts`):**
- `runJobMatch()` now async — delegates to provider if available, falls back to dictionary-based.
- Original deterministic logic preserved as `deterministicRunJobMatch()`.
- Graceful error handling: provider errors fall through to deterministic fallback.

### Next Up

- Sprint 6D — active (see Current Sprint above).

## Completed

**Sprint 6C — AI Quality & Beta Polish (v0.9.0-alpha):**
- User feedback system with 👍/👎 and reason picker
- Acceptance analytics (viewed → accepted → applied → rejected lifecycle)
- Explainability UI (confidence bars, "Why" sections)
- Safety detection (fabricated metrics, leadership inflation, responsibility expansion)
- Evaluation suite with 15 resume/JD fixture pairs
- Token utilities, prompt system, structured output validation, cost controls, cache layer
- 7 new safety detection tests

**Webhook idempotency:**
- New `ProcessedStripeEvent` model records each processed Stripe event ID.
- Webhook handler checks for duplicates at the top of processing; already-processed events return 200 and skip all side effects.
- Migration adds `ProcessedStripeEvent` table with index on `createdAt` for TTL cleanup.

**CANCELED grace period:**
- `getEffectivePlan()` now returns the subscription's paid plan for CANCELED status as long as `currentPeriodEnd` is in the future.
- Stripe's default behavior is honored: customers paid for the full period, so they keep access until period end.

**Cancellation state in UI:**
- `/account/billing` page: orange banner showing "Your subscription will end on {date}" with "Reactivate" button that opens Stripe Customer Portal.
- Subscription API (`GET /api/billing/subscription`) now returns `cancelAtPeriodEnd` and `currentPeriodEnd`.
- `/billing` pricing page: Current plan badge shows "Current plan — cancels {date}" for canceling subscriptions.

**Fixed pricing page CTAs:**
- Enterprise users viewing Professional: shows "Change plan" button that opens Stripe Customer Portal (instead of inert "Downgrade (contact support)" text).
- Free users viewing Professional/Enterprise: "Upgrade to {plan}" button as before.
- Current plan with cancellation: shows "Reactivate" link below the cancellation badge.
- Paid users can downgrade through the Stripe portal without contacting support.

**Stripe test suite (28 tests):**
- `vitest.config.ts` and `vitest.setup.ts` for the `@careerlaunch/web` workspace.
- `checkout.test.ts` — 7 tests: invalid plan, missing plan, customer creation, enterprise price, customer reuse, Stripe error, auth required.
- `subscription.test.ts` — 4 tests: free plan, paid plan, cancellation state, auth required.
- `webhook.test.ts` — 12 tests: missing signature, invalid signature, checkout completed (professional/enterprise/missing metadata), subscription updated (plan/enterprise/cancellation), subscription deleted, payment failed, idempotency, unhandled events.
- `portal.test.ts` — 5 tests: no customer ID, no subscription, session creation, Stripe error, auth required.

**Production smoke checklist:**
- `docs/implementation/BILLING_SMOKE_CHECKLIST.md` documents 10 scenarios covering the full paid-user lifecycle.

### Next Up

- Sprint 6 — Public Beta Polish or AI Quality Improvements (to be decided).

**Billing architecture (from Sprint 5.5):**
- `docs/architecture/BILLING.md` — comprehensive design covering entitlement model, plan registry, feature gate strategy, webhook flow, subscription lifecycle, upgrade/downgrade behavior, failure handling, and testing strategy.
- Principles: entitlements over tiers, code-defined plans, Stripe as source of truth, grace over strictness, watermark before block.

**Entitlement domain (`packages/domain/src/entitlements/`):**
- `types.ts` — `PlanId` (`free | professional | enterprise`), `Entitlements` type with boolean/number/template-access/PDF-kind features, `FeatureKeys` constants for every gateable feature.
- `plans.ts` — three plans defined with per-feature values: Free (3 resumes, 2 templates, basic AI, watermarked PDF, 5 exports/mo), Professional (unlimited, all templates, job match, clean PDF), Enterprise (unlimited + priority support). Pure functions: `can()`, `getFeatureValue()`, `canUseTemplate()`, `getResumeLimit()`, `getAllPlans()`.
- 14 tests covering all plan definitions, feature checks, template access, and limit calculations.

**Entitlement service (`apps/web/lib/entitlements.ts`):**
- `getSubscription(userId)` — creates FREE default if none exists.
- `can(userId, feature)` — runtime check with grace period for PAST_DUE.
- `getFeatureValue(userId, feature)` — returns raw entitlement value.
- `requireEntitlement(userId, feature)` — returns 403 Response or null for API routes.
- `canExportPdf(userId)` — monthly export limit check.
- `getPdfExportKind(userId)` — watermarked vs clean.
- `canUseTemplateByUser(userId, templateId)` — per-template access check.

**Stripe integration:**
- `apps/web/lib/stripe.ts` — lazy `getStripe()`, `getStripePublishableKey()`, price ID helpers, `getBaseUrl()`.
- `POST /api/billing/checkout` — creates Checkout Session with customer creation/upsert.
- `POST /api/billing/portal` — creates Customer Portal session for plan management.
- `POST /api/billing/webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Signature-verified, idempotent.
- `GET /api/billing/subscription` — returns current plan, PDF export kind, monthly usage, all plans for comparison.

**Feature gates:**
- PDF export (`/api/export/pdf`): checks `canExportPdf()` (403 on limit) and applies watermark for Free plan.
- Cover letter PDF export: same gating as resume PDF.
- Builder page (`/builder`): checks `resume_limit` before creating new resume; redirects to `/billing?reason=resume_limit` on limit reached.
- All gates use the entitlement service, not raw billing checks.

**PDF watermark:**
- `PdfOptions.watermarked` in `packages/rendering/src/pdf.tsx` adds semi-transparent "Created with CareerLaunch Studio" watermarks.
- Cover letter PDF renderer has same option: `CoverLetterPdfOptions.watermarked`.
- Watermark is CSS-based, positioned across the page as repeating diagonal text.
- Clean exports have zero watermark overhead.

**Pricing page (`/billing`):**
- Client component with `Suspense` boundary for `useSearchParams`.
- 3-column plan comparison with feature breakdown table.
- Current plan badge, "Upgrade to Professional/Enterprise" buttons.
- Handles `?reason=resume_limit`, `?checkout=success`, `?checkout=canceled` redirect states.
- Error handling for failed checkout sessions.

**Account billing page (`/account/billing`):**
- Shows current plan, monthly export count, export quality (watermarked/clean).
- "Upgrade" button for Free users, "Manage billing" (Stripe Portal) for paid users.

**Dashboard updates:**
- Free plan users see upgrade banner at top with CTA.
- Sidebar refreshed: shows plan badge, billing link, plans link, resume count.
- Subscription data loaded via `getSubscription()` in server component.

**Health endpoint update:**
- `GET /api/health` now checks Stripe key and price ID configuration.

**Environment configuration:**
- `.env.example` documents all Stripe env vars, grace period, and base URL.

**Migration:**
- `prisma/migrations/20260704040000_add_plan_billing_fields/` — adds `Plan` enum, `plan` and `cancelAtPeriodEnd` columns to Subscription, converts userId index to unique constraint.

### Next Up

- Sprint 6B — AI Quality & Public Beta (to be decided).

## Completed

### Sprint 6A — Real AI Foundation ✅

Covered above.

### Sprint 5 — Billing & Entitlement System ✅

First version: Stripe integration, entitlement domain model, plan registry (Free/Professional/Enterprise), feature gates for PDF export (watermark), resume limit, and template access. Pricing page, account billing page, webhook handler, Checkout/Customer Portal. `v0.6.0-alpha`.

### Sprint 5.5 — Billing Stabilization ✅

Covered above.

### Sprint 4.5 — Production Readiness ✅

Covered in previous status.

### Sprint 4 — Import Existing Resume and Version Duplication ✅

Covered in previous status.

### Sprint 3D — Cover Letter Builder MVP ✅

Covered in previous status.

### Sprint 3C — Job Match MVP ✅

Covered in previous status.

### Sprint 3B — Suggestion Preview / Diff UI ✅

Covered in previous status.

### Sprint 2 — Template Library and Resume Checker Depth ✅

Covered in previous status.

### Sprint 1 — Foundation ✅

Covered in previous status.

## Architecture Status

TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, auth with signed HTTP-only cookies. PDF rendering separated into standalone Docker service. Template registry is single source of truth. Entitlement system decouples feature logic from billing state — every feature asks `can(user, feature_key)` rather than checking plan status directly. Plans are code-defined in `@careerlaunch/domain`. Stripe handles payments, webhooks sync subscription state. Sentry, PostHog, rate limiting, and health endpoint in place. AI provider abstraction decouples app code from LLM vendors — `AIProvider` interface with GeminiProvider, GroqProvider, and MockProvider implementations. Provider selection via `AI_DEFAULT_PROVIDER` env var. Prompts extracted to versioned files. Structured output validation ensures reliable typed responses. User feedback system captures suggestion quality signals. Acceptance analytics track the full lifecycle. Evaluation suite provides regression detection for prompt changes.

## Platform Status

Build passes with 223 tests (169 AI + 41 web + 13 domain). TypeScript passes across all workspaces. All new routes registered: feedback, event, and analytics/acceptance. Safety detection and confidence explainability integrated into all suggestion UI. User feedback flows non-blocking — AI UX never fails if analytics logging fails.

## Blockers

- Stripe products and prices must be configured in Stripe dashboard and `STRIPE_PROFESSIONAL_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID` env vars must be set before paid subscriptions can work.
- Production PostgreSQL must be provisioned and `DATABASE_URL` configured.
- Initial Prisma migration must be applied to staging and production databases.
- Stripe webhook endpoint must be configured in Stripe dashboard pointing to `/api/billing/webhook`, with `STRIPE_WEBHOOK_SECRET` set.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories; review before launch.

## Next Milestone

Sprint 6D — active (see Current Sprint above). Target: v0.9.5-alpha, closed beta readiness.

## Last Build

Local build verification passed on 2026-07-09:

- `npm run build` — passes (all routes, including new DELETE/PATCH `/api/resumes/:resumeId`)
- `npm run lint` — 0 errors, 5 pre-existing warnings
- Dashboard page: search, sort, filter, recency grouping, actions dropdown, rename modal, enriched sidebar
- Vercel deployment — requires `sonner` in web workspace (fixed)
