# Billing & Entitlement Architecture

Last updated: 2026-07-04

## Overview

The billing system wraps Stripe into an **entitlement layer** that decouples feature logic from subscription state. Every feature asks `can(user, feature_key)` rather than checking `user.isPremium` or inspecting billing status directly.

This keeps feature gates consistent across API routes, server-rendered pages, and client components, and makes future plan changes (trials, coupons, enterprise accounts) a configuration change rather than a code hunt.

## Principles

1. **Entitlements over tiers.** Code checks capabilities (`can_export_pdf`, `can_use_template_id`), not plan names.
2. **Code-defined plans.** Plan configurations live in a registry so they're versioned with the app. No database plan table that drifts from code.
3. **Stripe is source of truth for billing.** Webhooks update local subscription state. The app never writes to Stripe.
4. **Grace over strictness.** Expired cards get a grace period. Webhook failures don't lock users out permanently. The entitlement service returns generous defaults when Stripe state is ambiguous.
5. **Watermark before block.** Free exports get a subtle watermark rather than a hard block — the user sees the value before being asked to pay.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Feature    │ ──> │  Entitlement     │ ──> │  Plan       │
│   Gate       │     │  Service         │     │  Registry   │
│ (can(user,)) │     │  (runtime check) │     │  (config)   │
└──────────────┘     └──────────────────┘     └─────────────┘
                             │
                             v
                     ┌───────────────┐
                     │  Subscription │
                     │  (DB row)     │
                     └───────┬───────┘
                             │
                     ┌───────┴───────┐
                     │  Stripe       │
                     │  (webhooks)   │
                     └───────────────┘
```

### Data Model

The existing `Subscription` model is extended:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String | PK |
| `userId` | String | FK to User |
| `plan` | Plan enum | `FREE`, `PROFESSIONAL`, `ENTERPRISE` |
| `stripeCustomerId` | String? | Stripe customer reference |
| `stripeSubscriptionId` | String? | Stripe subscription reference (unique) |
| `status` | SubscriptionStatus | `FREE`, `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED` |
| `currentPeriodEnd` | DateTime? | End of current billing period |
| `cancelAtPeriodEnd` | Boolean | Whether cancellation is pending |

Plans are defined in code (`packages/domain/src/entitlements/plans.ts`), not in the database.

### Plan Registry

```typescript
const PLANS = {
  free: {
    label: "Free",
    entitlements: {
      resume_limit: 3,
      templates: ["modern", "minimal"],
      ai_analysis: true,        // basic score + checks
      job_match: false,
      cover_letter: true,
      pdf_export: "watermarked",
      monthly_exports: 5,
      premium_templates: false,
      priority_support: false,
    },
  },
  professional: {
    label: "Professional",
    entitlements: {
      resume_limit: Infinity,
      templates: "all",
      ai_analysis: true,        // full analysis
      job_match: true,
      cover_letter: true,
      pdf_export: "clean",
      monthly_exports: Infinity,
      premium_templates: true,
      priority_support: false,
    },
  },
  enterprise: {
    label: "Enterprise",
    entitlements: {
      resume_limit: Infinity,
      templates: "all",
      ai_analysis: true,
      job_match: true,
      cover_letter: true,
      pdf_export: "clean",
      monthly_exports: Infinity,
      premium_templates: true,
      priority_support: true,
    },
  },
};
```

### Entitlement Service

Located at `apps/web/lib/entitlements.ts`. Exposes:

```typescript
getSubscription(userId): Promise<Subscription>
can(userId, feature, context?): Promise<boolean>
getFeatureValue(userId, feature): Promise<FeatureValue>
requireEntitlement(userId, feature, context?): Response | null
```

The service:
1. Loads the user's subscription (with fallback to FREE defaults)
2. Looks up the plan definition
3. Checks the requested feature against the plan's entitlements
4. Returns boolean or feature value

`requireEntitlement` returns a JSON `403` response object for API routes:

```typescript
const gate = await requireEntitlement(user.id, "pdf_export_clean");
if (gate) return gate; // 403
```

### Stripe Integration

**Products & Prices** are configured in Stripe dashboard, referenced by ID in env:

```
STRIPE_PROFESSIONAL_PRICE_ID="price_xxx"
STRIPE_ENTERPRISE_PRICE_ID="price_yyy"
```

**Checkout flow:**
1. User clicks "Upgrade" on pricing page
2. Server creates Stripe Checkout Session with `?prefilled_promo_code=...`
3. User completes payment on Stripe
4. Stripe redirects to `/dashboard?upgrade=success`
5. Webhook `checkout.session.completed` creates/updates Subscription row

**Webhook flow:**
- `customer.subscription.updated` → update status, plan, period end
- `customer.subscription.deleted` → set status to CANCELED, plan to FREE
- `invoice.payment_failed` → set status to PAST_DUE
- `checkout.session.completed` → create Subscription row

**Customer Portal:**
- A `/api/billing/portal` endpoint creates a Stripe Customer Portal session
- Redirects user to Stripe for plan changes, cancellation, payment methods, invoices

### Watermark Strategy

Free PDF exports include a subtle diagonal watermark "Created with CareerLaunch Studio" in light gray. The watermark is applied server-side during PDF rendering in `packages/rendering/src/pdf.tsx` when `options.watermarked` is true.

The watermark:
- Semi-transparent gray text, rotated ~30 degrees
- Placed across the page as a repeating pattern
- Does not obscure resume content
- Removed entirely at the Professional plan

### Feature Gates by Component

| Component | Free | Professional | Enterprise |
|-----------|------|-------------|------------|
| Resume drafts | 3 | Unlimited | Unlimited |
| Templates | Modern, Minimal | All 4 | All 4 |
| AI analysis | Basic score | Full analysis | Full analysis |
| Job match | — | ✓ | ✓ |
| Cover letter | ✓ | ✓ | ✓ |
| PDF export | Watermarked (5/mo) | Clean (unlimited) | Clean (unlimited) |
| Support | Community | Community | Priority |

### Subscription Lifecycle

```
Registration
    │
    v
FREE ──────────────────────────────────────────┐
    │                                            │
    │  User clicks "Upgrade"                     │
    v                                            │
ACTIVE (Professional / Enterprise)              │
    │                                            │
    ├── Period end, card declined ──> PAST_DUE   │
    │       │                                    │
    │       └── 7-day grace period               │
    │              │                             │
    │              ├── User updates card ──> ACTIVE
    │              └── Grace expires ──> CANCELED │
    │                                            │
    ├── User cancels ──> CANCELED (end of period)│
    │       │                                    │
    │       └── Period end ──> FREE              │
    │                                            │
    └── Admin refund ──> FREE                    │
```

### Failure Handling

- **Webhook delivery failure:** Stripe retries for up to 3 days. The app's subscription status may lag behind Stripe. The entitlement service treats PAST_DUE as degraded (reduced but not zero access) for 3 days, then treats as FREE.
- **Expired card:** Stripe sends `invoice.payment_failed`. Status → PAST_DUE. A "Update payment method" banner appears in the dashboard. After 7 days without resolution, the subscription is canceled.
- **Grace period:** During PAST_DUE, the user retains Professional entitlements for 3 days (configurable via env `PAST_DUE_GRACE_DAYS`), then downgrades to Free-like access except existing resumes remain editable.
- **Concurrent webhook:** Stripe webhooks are idempotent via the Stripe `Idempotency-Key` header. The app stores the Stripe event ID to prevent double-processing.

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/billing/checkout` | Create Stripe Checkout Session |
| `POST /api/billing/portal` | Create Stripe Customer Portal session |
| `POST /api/billing/webhook` | Stripe webhook receiver |
| `GET /api/billing/subscription` | Get current subscription + entitlements |

### Directory Structure

```
apps/web/
  lib/
    entitlements.ts        ← Entitlement service
  app/
    api/
      billing/
        checkout/route.ts  ← Create checkout session
        portal/route.ts    ← Create portal session
        webhook/route.ts   ← Stripe webhook handler
        subscription/route.ts ← Current subscription
    billing/
      page.tsx             ← Pricing/plans page
    account/
      billing/page.tsx     ← Customer portal wrapper (or link)
    dashboard/
      page.tsx             ← Updated with usage indicators
packages/domain/src/
  entitlements/
    plans.ts               ← Plan definitions
    types.ts               ← Entitlement types
    feature-keys.ts        ← Feature key constants
```

### Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PROFESSIONAL_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_PRICE_ID=price_yyy
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
PAST_DUE_GRACE_DAYS=3
```

### Migration Path

For existing users, all current accounts initialize as FREE with the legacy entitlement set. No data migration is needed beyond adding the `plan` and `cancelAtPeriodEnd` columns to Subscription.

### Testing Strategy

- **Unit:** Plan definitions return correct entitlements. `can()` resolves correctly for each plan × feature.
- **Integration:** Webhook signature verification, subscription state transitions, checkout session creation.
- **E2E:** Upgrade flow (mocked Stripe), PDF watermark visible on free, removed on paid, template lock overlay on premium templates, resume limit enforcement.
