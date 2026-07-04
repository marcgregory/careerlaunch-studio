# Billing & Entitlements Architecture

Last updated: 2026-07-04

## Sprint 5 Order

1. `docs/architecture/BILLING.md`
2. Entitlement system
3. Plan limits
4. Premium template gates
5. Free PDF watermark / export limits
6. Stripe checkout
7. Stripe webhooks
8. Billing portal

This architecture intentionally puts the entitlement layer before Stripe. Product code should never ask whether a user is "premium". Product code asks whether the user has a capability:

```ts
await can(user.id, "export_clean_pdf");
await can(user.id, "use_premium_templates");
await can(user.id, "run_job_match");
```

Stripe changes subscription state. The entitlement layer translates subscription state into product capabilities.

## Goals

- Keep feature access independent from plan names and Stripe status strings.
- Make Free, Professional, and Enterprise limits code-defined and testable.
- Support watermarked Free exports before paid clean exports.
- Enforce premium gates on both the client and server.
- Add Stripe only after local entitlements are stable.

## Non-Goals

- No hardcoded `isPremium`, `plan === "professional"`, or direct Stripe checks in feature code.
- No database-backed plan catalog in Sprint 5.
- No coupons, metered billing, invoices UI, annual plans, or team seats yet.

## Architecture

```text
Feature route / component
        |
        v
can(userId, featureKey) / getFeatureValue(userId, featureKey)
        |
        v
Effective subscription state from local DB
        |
        v
Code-defined plan registry
        |
        v
Boolean or typed feature value
```

Stripe sits outside the feature path:

```text
Stripe checkout / portal / webhook
        |
        v
Subscription row
        |
        v
Entitlement service
        |
        v
Feature gates
```

## Entitlement Contract

Canonical feature keys live in `@careerlaunch/domain` and are re-exported by `apps/web/lib/entitlements.ts`.

| Feature key | Type | Purpose |
| --- | --- | --- |
| `resume_limit` | number | Maximum active resume drafts. |
| `templates` | template access | Exact template IDs or all templates. |
| `ai_analysis` | boolean | Resume analysis access. |
| `run_job_match` | boolean | Job description match access. |
| `cover_letter` | boolean | Cover letter builder access. |
| `pdf_export` | `watermarked` or `clean` | Render mode for PDF exports. |
| `export_clean_pdf` | boolean | Whether non-watermarked PDF export is allowed. |
| `monthly_exports` | number | Monthly PDF export quota. |
| `use_premium_templates` | boolean | Premium template access. |
| `priority_support` | boolean | Enterprise support flag. |

Feature code should use helpers like:

```ts
const gate = await requireEntitlement(user.id, FeatureKeys.RUN_JOB_MATCH);
if (gate) return gate;

const exportKind = await getPdfExportKind(user.id);
const pdfOptions = { watermarked: exportKind !== "clean" };
```

## Plan Registry

Plans are defined in `packages/domain/src/entitlements/plans.ts`.

```ts
free: {
  resume_limit: 3,
  templates: { kind: "list", templateIds: ["modern", "minimal"] },
  ai_analysis: true,
  run_job_match: false,
  cover_letter: true,
  pdf_export: "watermarked",
  export_clean_pdf: false,
  monthly_exports: 5,
  use_premium_templates: false,
  priority_support: false,
}

professional: {
  resume_limit: Infinity,
  templates: { kind: "all" },
  ai_analysis: true,
  run_job_match: true,
  cover_letter: true,
  pdf_export: "clean",
  export_clean_pdf: true,
  monthly_exports: Infinity,
  use_premium_templates: true,
  priority_support: false,
}

enterprise: {
  resume_limit: Infinity,
  templates: { kind: "all" },
  ai_analysis: true,
  run_job_match: true,
  cover_letter: true,
  pdf_export: "clean",
  export_clean_pdf: true,
  monthly_exports: Infinity,
  use_premium_templates: true,
  priority_support: true,
}
```

## Data Model

`Subscription` stores the local billing projection:

| Field | Purpose |
| --- | --- |
| `userId` | Owner. Unique per user. |
| `plan` | `FREE`, `PROFESSIONAL`, or `ENTERPRISE`. |
| `status` | `FREE`, `TRIALING`, `ACTIVE`, `PAST_DUE`, or `CANCELED`. |
| `stripeCustomerId` | Stripe customer reference. |
| `stripeSubscriptionId` | Stripe subscription reference. |
| `currentPeriodEnd` | Billing period end or grace anchor. |
| `cancelAtPeriodEnd` | Pending cancellation flag. |

If a user has no subscription row, `getSubscription(userId)` creates a Free row.

## Effective Plan Rules

- `FREE` uses Free entitlements.
- `ACTIVE` and `TRIALING` use the row's plan.
- `PAST_DUE` keeps the row's plan until the grace window expires.
- `CANCELED` and expired `PAST_DUE` use Free entitlements.

Grace defaults to 3 days via `PAST_DUE_GRACE_DAYS`.

## Gates

| Area | Gate |
| --- | --- |
| Creating resumes | `can(user, "resume_limit")` |
| Saving premium templates | `canUseTemplateByUser(user, templateId)` and `can(user, "use_premium_templates")` |
| Job matching | `can(user, "run_job_match")` |
| PDF export quota | `canExportPdf(user)` using `monthly_exports` |
| Clean PDF rendering | `can(user, "export_clean_pdf")` or `getPdfExportKind(user)` |

Server routes are the source of enforcement. Client gates are for user experience only.

## Free PDF Watermark / Export Limits

Free users can export PDFs, but exports are watermarked and limited monthly. Professional and Enterprise users export clean PDFs with unlimited monthly quota.

Watermarking is applied in the rendering layer through `PdfOptions.watermarked`, not in client code.

## Stripe Checkout

Checkout is introduced after local gates work.

- `POST /api/billing/checkout` accepts `professional` or `enterprise`.
- The route creates or reuses a Stripe customer.
- The route creates a Stripe Checkout Session with metadata `{ userId, plan }`.
- The user returns to `/billing?checkout=success` or `/billing?checkout=canceled`.

Environment variables:

```text
STRIPE_SECRET_KEY=
STRIPE_PROFESSIONAL_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

## Stripe Webhooks

Webhook handlers update local `Subscription` rows. Feature routes do not call Stripe.

Required events:

| Event | Local action |
| --- | --- |
| `checkout.session.completed` | Link customer/subscription and set selected plan. |
| `customer.subscription.created` | Upsert subscription row. |
| `customer.subscription.updated` | Sync plan, status, period end, cancellation flag. |
| `customer.subscription.deleted` | Downgrade to Free or mark canceled. |
| `invoice.payment_failed` | Mark `PAST_DUE`. |

Webhook processing must be idempotent before production launch. If an event log table is not added in Sprint 5, the webhook must at least tolerate repeated subscription upserts.

## Billing Portal

`POST /api/billing/portal` creates a Stripe Customer Portal session for users with a Stripe customer ID. Users without a Stripe customer are redirected to `/billing`.

Portal responsibilities:

- Change plan.
- Cancel subscription.
- Update payment method.
- View invoices in Stripe.

Local app state still changes through webhooks.

## Testing Strategy

- Unit test plan definitions and `can(plan, feature)` for `export_clean_pdf`, `use_premium_templates`, and `run_job_match`.
- Integration test API gates for resume limits, premium template saves, job match, and export limits.
- E2E test Free users see locked premium templates and watermarked exports.
- E2E test paid users can use premium templates, run job match, and export clean PDFs.
- Webhook tests should cover duplicate delivery, cancellation, payment failure, and recovery.

## Operational Notes

- Billing and export routes must use `Cache-Control: no-store`.
- Stripe secrets must never be exposed to client bundles.
- Entitlement failures should return `403` with `{ feature, upgradeUrl }`.
- Existing resumes remain editable after downgrade unless the user attempts to save a newly gated premium template.
