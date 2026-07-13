# CareerLaunch Studio Roadmap

Last updated: 2026-07-13

## Completed

- Project foundation created.
- Product scope, PRD, architecture, tech stack, deployment, ADRs, founder analysis, release plan, and sprint plan documented.
- Monorepo scaffold created.
- Local resume-builder demo created with dashboard, builder, preview, scoring, autosave, and print export.
- Initial Prisma schema created.
- First-party email/password auth, protected routes, and Prisma-backed resume persistence implemented.
- Real PDF export implemented with Playwright print-to-PDF and ownership-checked download responses.
- Builder completeness delivered for all core resume sections, including add/remove/reorder flows, empty states, validation, autosave state, and reset/export recovery states.
- First original resume template polished across live preview and PDF export.
- Release-closeout QA completed for desktop/mobile builder behavior, accessibility basics, preview/PDF parity, and full local verification.
- Database-backed Playwright coverage verifies signup, save, real PDF export bytes, repeated PDF render stability, and builder section/item ordering persistence.
- Template registry refactored to semantic properties, removing per-template conditionals (`isAts`, `isExecutive`) from renderers.
- PDF renderer now generates CSS programmatically from template definitions, eliminating preview/PDF drift.
- Template gallery is data-driven — uses `premium`, `accentColor`, `swatches` metadata for selection highlights and lock overlays.
- Playwright visual regression tests added for all 4 templates (modern, executive, minimal, ats).
- Template-specific PDF QA tests verify each template produces valid, single-page PDF output.
- Sprint 3A — AI Analysis Engine (read-only). `v0.3.1-alpha` tagged. Analysis pipeline, suggestion schema, provider abstraction, MockProvider, health dashboard, accept/dismiss UI.
- Sprint 3A.5 — Apply Engine + Acceptance Persistence. Pure-function apply layer, API endpoint, database persistence for accepted suggestions, stale-target 409 handling, 5 safe operations (replace_summary, replace_bullet, replace_skill, add_skill, remove_skill), suggestion-to-operation mapping, and Playwright E2E acceptance tests.
- Sprint 3C — Job Match MVP. Paste-only JD comparison, dictionary-based skill extraction, match score, missing/present skills, suggestions through Review → Diff → Apply. AnalysisRun table. Operation factory upgraded to createOperations(suggestion, resume). URL job-description fetching explicitly deferred (paste-only MVP).
- Sprint 3D — Cover Letter Builder MVP. User picks a resume, optionally pastes a job description, mock AI generates a draft cover letter, user edits manually, saves, and exports to PDF. No auto-send, no email integration. Reuses template engine and PDF renderer. `v0.4.0-alpha` tagged.
- PDF rendering separated into standalone Docker service (`services/pdf-renderer/`). Removed `@sparticuz/chromium-min`, `CHROMIUM_PACK_URL`, and all Vercel Chromium workarounds. Production hardening: bearer auth, timeouts, health endpoint, request validation, browser reuse, correlation ID logging.
- Sprint 4.5 — Production Readiness. Request ID middleware, Sentry error monitoring, PostHog product analytics, in-memory rate limiting on 5 high-risk routes, `GET /api/health` endpoint for app/renderer/DB checks, backup recovery documentation.
- Sprint 5 — Billing & Entitlement System. Stripe integration, entitlement domain model, plan registry (Free/Professional/Enterprise), feature gates for PDF export (watermark), resume limit, and template access. Pricing page, account billing page, webhook handler, Checkout/Customer Portal. `v0.6.0-alpha` tagged.
- Sprint 5.5 — Billing Stabilization. Webhook idempotency (ProcessedStripeEvent table), CANCELED grace period (paid access until period end), cancellation state visible in UI (banner with date + reactivation), fixed pricing page CTAs (downgrade → portal, cancellation badge), Stripe test suite (28 tests covering checkout/subscription/webhook/portal), production smoke checklist. `v0.6.1-alpha` tagged.
- Sprint 6A — Real AI Foundation. AIProvider interface expanded (generateCoverLetter, matchJob), GeminiProvider (Gemini 2.5 Flash), GroqProvider (Llama 4 Scout), 8 prompt files extracted to packages/ai/prompts/, structured output validation, cost controls (token budget, retry/backoff, caching). `v0.7.0-alpha` tagged.
- Sprint 6B — AI Resume Tailoring (Flagship Feature). Job analysis, gap analysis, resume tailoring, before/after diff, apply suggestions (individual + bulk per category), unified TailoringPanel UI. 3 new provider methods. Post-processing safety validation. `v0.8.0-alpha` tagged.

## Completed

- Sprint 6C — AI Quality & Beta Polish. User feedback system, acceptance analytics, explainability UI, safety warnings, evaluation suite. `v0.9.0-alpha` tagged.

## In Progress

- Sprint 6D — Beta Hardening & Release Candidate (v0.9.5). No new features. Dogfooding, AI benchmark, error recovery, mobile QA, accessibility, performance, closed beta checklist.
- Sprint 6D — Auth Hardening (password reset, rate limiting, soft email verification). See `docs/implementation/AUTH_HARDENING_PLAN.md`.
- Product Completion audit: duplicate API entitlement/data consistency fixed, registration throttling adjusted, mobile dashboard action accessibility fixed. Full E2E remains blocking; see `docs/implementation/FUNCTIONAL_READINESS_AUDIT.md`.

## Future

- DOCX export.
- TXT export.
- Job-description matching (URL-based).
- Partner dashboards for bootcamps and career coaches.
- Localization.
- Admin analytics.
- Annual billing discounts.
- Coupon and promo code support.
- Team/enterprise accounts.
- Lifetime license option.

## Blocked

- Final auth provider is undecided.
- Production database connection details are not configured.
- Final brand name, legal requirements, and payment-market policy remain unconfirmed.
