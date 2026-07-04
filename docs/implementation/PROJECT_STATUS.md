# CareerLaunch Studio Project Status

Last updated: 2026-07-04

## Current Sprint

Sprint 5 — Billing & Entitlement System. ✅ Complete and tagged `v0.6.0-alpha`.

### Delivered This Sprint (Sprint 5)

**Billing architecture:**
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

- Sprint 6 — Polish, Performance, and Pre-Launch QA.

## Completed

### Sprint 5 — Billing & Entitlement System ✅

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

TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, auth with signed HTTP-only cookies. PDF rendering separated into standalone Docker service. Template registry is single source of truth. Entitlement system decouples feature logic from billing state — every feature asks `can(user, feature_key)` rather than checking plan status directly. Plans are code-defined in `@careerlaunch/domain`. Stripe handles payments, webhooks sync subscription state. Sentry, PostHog, rate limiting, and health endpoint in place.

## Platform Status

Build passes with 158 tests (144 AI + 14 domain). TypeScript passes across all workspaces. Entitlement system: 14 tests covering all plan definitions, feature gates, template access, and limits. Stripe integration tested for checkout session creation, webhook signature verification, and subscription state transitions. PDF watermark renders correctly. All existing Playwright tests pass.

## Blockers

- Stripe products and prices must be configured in Stripe dashboard and `STRIPE_PROFESSIONAL_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID` env vars must be set before paid subscriptions can work.
- Production PostgreSQL must be provisioned and `DATABASE_URL` configured.
- Initial Prisma migration must be applied to staging and production databases.
- Stripe webhook endpoint must be configured in Stripe dashboard pointing to `/api/billing/webhook`, with `STRIPE_WEBHOOK_SECRET` set.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories; review before launch.

## Next Milestone

Complete Sprint 6 — polish, performance optimization, and pre-launch QA.

## Last Build

Local build verification passed on 2026-07-04:

- `npm run build` — passes (all routes, including new billing API routes and pages)
- `npm run test` — 144/144 AI tests + 14/14 domain tests pass
- `npm run typecheck` — passes (all workspaces)
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability
