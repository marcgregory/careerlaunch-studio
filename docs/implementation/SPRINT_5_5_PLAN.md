# Sprint 5.5 — Billing Stabilization

**Goal:** Finish the paid-flow edge cases. No new features. Production-safe billing.

## Current State Summary

| Area | Status |
|---|---|
| CTA logic on `/billing` | Rank-based comparison works for basic cases, but "Downgrade" is a dead `<span>` (contact support text) rather than an actionable redirect to the billing portal. |
| Cancellation state | `cancelAtPeriodEnd` is stored in the DB via webhooks, but nowhere in the UI does the user see their cancellation date or status. |
| Webhook idempotency | Zero protection. Duplicate events (common in Stripe production) will double-process and could produce race conditions. |
| Billing portal | Works for paid users. Not reachable from the pricing page downgrade path. |
| Stripe tests | None in `apps/web`. Only `packages/domain` entitlement tests exist (14 tests). |
| Production smoke | No documented flow to verify a full paid-user lifecycle. |

---

## Item 1 — Fix billing CTA logic

**Problem:** The pricing page `PLAN_RANK` comparison works for upgrade/downgrade detection, but the downgrade path shows inert text ("Downgrade (contact support)") instead of an actionable flow. Paid users should be able to change plans via the Stripe Customer Portal.

**Changes:**

### 1a — Pricing page: make downgrade CTA open the billing portal

File: `apps/web/app/billing/page.tsx`

- Replace the inert `<span>` for `currentRank > cardRank` with a `<button>` that calls `POST /api/billing/portal`.
- If the user does not have a `stripeCustomerId` (no paid history), fall back to showing "Contact support" text.
- Add a `portalLoading` state (similar to `upgrading`).
- Loading state shows a spinner; error state shows the error message in the error banner.

### 1b — Pricing page: query `cancelAtPeriodEnd` for correct badge text

File: `apps/web/app/api/billing/subscription/route.ts`

- Include `cancelAtPeriodEnd` and `currentPeriodEnd` in the API response.
- Add `cancelAtPeriodEnd` and `currentPeriodEnd` to the `SubscriptionData` type on the billing page.

### 1c — Pricing page: show "Current plan (cancels on Aug 4)" for canceling users

File: `apps/web/app/billing/page.tsx`

- When `isCurrent && cancelAtPeriodEnd`, show "Current plan — cancels on {date}" instead of just "Current plan".

---

## Item 2 — Handle cancellation state

**Problem:** When a user cancels via the Stripe Portal, the webhook sets `cancelAtPeriodEnd: true` and records `currentPeriodEnd`, but the user sees no indication of their cancellation status in the app. They should know their plan is active until period end.

### 2a — Account billing page: show cancellation banner

File: `apps/web/app/account/billing/page.tsx`

- Fetch `cancelAtPeriodEnd` and `currentPeriodEnd` from `/api/billing/subscription`.
- If `cancelAtPeriodEnd === true`, show a banner:
  > "Your subscription will end on {formatted date}. You'll retain paid access until then."
- Include a "Reactivate" button that opens the Stripe Customer Portal (portal route already exists).

### 2b — Subscription API: expose cancellation fields

File: `apps/web/app/api/billing/subscription/route.ts`

- Add `cancelAtPeriodEnd` and `currentPeriodEnd` to the response JSON.

### 2c — Entitlement service: honor grace period for canceled subscriptions

File: `apps/web/lib/entitlements.ts`, function `getEffectivePlan()`

- Currently `CANCELED` falls through to return `"free"`. But canceled subscriptions still have access until `currentPeriodEnd`.
- Update: if `status === "CANCELED"` and `currentPeriodEnd > now()`, return the subscription's plan (not free).
- Only fall through to `"free"` when `currentPeriodEnd` is past (or null).

---

## Item 3 — Webhook idempotency

**Problem:** Stripe can deliver the same event multiple times (at-least-once delivery). The current webhook handler re-processes every event, which can double-write, produce stale overwrites, or cause race conditions between events arriving out of order.

### 3a — Add `ProcessedEvent` model

File: `prisma/schema.prisma`

```prisma
model ProcessedStripeEvent {
  id        String   @id
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

The `id` is the Stripe event ID (e.g., `evt_xxx`). Use `createdAt` for TTL cleanup.

### 3b — Add idempotency check to webhook handler

File: `apps/web/app/api/billing/webhook/route.ts`

- At the top of the `try` block, after parsing the event, check if `event.id` already exists in `ProcessedStripeEvent`.
- If found, return `{ received: true }` immediately (already processed).
- After processing each event, insert the event ID into `ProcessedStripeEvent`.
- Use `create` with error handling for race conditions (two deliveries at once).

### 3c — Add migration

```bash
npx prisma migrate dev --name add_processed_stripe_events
```

---

## Item 4 — Billing portal improvements

**Problem:** The billing portal is only reachable from `/account/billing`. Downgrade paths from the pricing page are dead ends.

### 4a — Portal route: allow free users with `stripeCustomerId`

File: `apps/web/app/api/billing/portal/route.ts`

- Currently returns 400 if `!subscription?.stripeCustomerId`.
- Keep that guard but also add a clearer message. Users who have previously subscribed (and have a `stripeCustomerId`) should be able to access the portal to resubscribe.
- Add a check: if the user has a `stripeCustomerId` but no subscription row, still let them portal (create a minimal subscription row).

Actually, this is already handled — `getSubscription` on the checkout route creates a row. The portal route already warns if there's no `stripeCustomerId`. This is correct since free users without a Stripe customer have nothing to manage.

Instead, create a portal helper for the CTA flow:

### 4b — Shared portal action for pricing page downgrade

The pricing page `handleUpgrade` function already calls `POST /api/billing/checkout`. Add a `handleDowngrade` equivalent that calls `POST /api/billing/portal` and redirects to the resulting URL.

---

## Item 5 — Stripe test suite

**Problem:** Zero tests for the billing API routes.

### 5a — Add Vitest config to web workspace

File: `apps/web/vitest.config.ts`

A minimal Vitest config that includes the `stripe` mock and test setup.

File: `apps/web/vitest.setup.ts`

Mock `stripe` module globally.

### 5b — Write unit tests for subscription API

Test `GET /api/billing/subscription`:
- Returns current plan, pdf export kind, monthly export count for a free user.
- Returns correct plan for a paid user.

### 5c — Write unit tests for checkout API

Test `POST /api/billing/checkout`:
- Rejects invalid plan names (400).
- Creates a Stripe customer if none exists.
- Creates Checkout Session with correct metadata.
- Handles Stripe errors gracefully (500 with safe message).

### 5d — Write unit tests for webhook handler

Test `POST /api/billing/webhook`:
- Rejects missing signature (400).
- Rejects invalid signature (401).
- Processes `checkout.session.completed`: upserts subscription with correct plan.
- Processes `customer.subscription.updated`: updates plan, status, period end.
- Processes `customer.subscription.deleted`: marks canceled.
- Processes `invoice.payment_failed`: marks PAST_DUE.
- **Idempotency**: second delivery of the same event ID is skipped.
- Unhandled event types return 200 (graceful ack).

### 5e — Write unit tests for portal API

Test `POST /api/billing/portal`:
- Returns 400 for user without stripeCustomerId.
- Creates Portal Session and returns URL.
- Handles Stripe errors gracefully.

### 5f — Add domain test for new CANCELED grace period logic

File: `packages/domain/src/entitlements/plans.test.ts`

The new `getEffectivePlan` logic is in `apps/web/lib/entitlements.ts`, but we can add tests for the conceptual behavior.

Better: add integration tests in `apps/web` for the entitlement layer.

---

## Item 6 — Production smoke checklist

File: `docs/implementation/BILLING_SMOKE_CHECKLIST.md`

Document the manual smoke test flow:

1. **Upgrade flow:** Create a free account → navigate to `/billing` → click "Upgrade to Professional" → complete Stripe Checkout → redirect back to `/billing?checkout=success` → see plan change reflected.
2. **Premium feature access:** After upgrade → create a resume with a premium template (Executive, ATS Classic) → verify it saves → export PDF → verify no watermark.
3. **Usage tracking:** Verify monthly export count increments on the account billing page.
4. **Cancellation:** Go to Stripe Customer Portal → cancel subscription → return to app → see "Cancels on {date}" banner → verify paid access (premium templates, clean PDF) still works.
5. **Post-cancellation access:** Before period end, verify all paid features still work. Verify no double-charge on next invoice.
6. **Expiration:** After period end (can test by setting past `currentPeriodEnd` in DB), verify user is on Free entitlements (watermarked PDF, limited templates, export limit).
7. **Re-subscription:** Go to `/billing` → upgrade again → verify plan reactivates.
8. **Payment failure:** Use Stripe test card `4000000000000341` (declined) → verify status becomes PAST_DUE → verify grace period retains paid access → verify forced to free after grace.
9. **Webhook resilience:** Simulate duplicate Stripe event delivery → verify DB is not corrupted.

---

## Files Changed

| File | Change |
|---|---|
| `docs/implementation/SPRINT_5_5_PLAN.md` | New — this plan |
| `apps/web/app/billing/page.tsx` | Downgrade CTA → portal; cancellation badge; cancelAtPeriodEnd state |
| `apps/web/app/api/billing/subscription/route.ts` | Expose cancelAtPeriodEnd + currentPeriodEnd |
| `apps/web/app/account/billing/page.tsx` | Cancellation banner with reactivate button |
| `apps/web/lib/entitlements.ts` | CANCELED grace period in getEffectivePlan |
| `prisma/schema.prisma` | Add ProcessedStripeEvent model |
| `prisma/migrations/` | Add migration for ProcessedStripeEvent |
| `apps/web/app/api/billing/webhook/route.ts` | Idempotency check + event ID tracking |
| `apps/web/vitest.config.ts` | New — Vitest config |
| `apps/web/vitest.setup.ts` | New — test setup with Stripe mocks |
| `apps/web/app/api/billing/__tests__/subscription.test.ts` | New — subscription API tests |
| `apps/web/app/api/billing/__tests__/checkout.test.ts` | New — checkout API tests |
| `apps/web/app/api/billing/__tests__/webhook.test.ts` | New — webhook handler tests |
| `apps/web/app/api/billing/__tests__/portal.test.ts` | New — portal API tests |
| `apps/web/app/api/billing/__tests__/entitlements.test.ts` | New — entitlement integration tests |
| `docs/implementation/BILLING_SMOKE_CHECKLIST.md` | New — smoke test checklist |
| `docs/implementation/ROADMAP.md` | Update |
| `docs/implementation/PROJECT_STATUS.md` | Update |

## Order of Implementation

1. Webhook idempotency (Item 3) — foundational so tests can safely use the handler
2. Entitlement CANCELED grace period (Item 2c) — fixes a logic bug before we test
3. Subscription API expose fields (Item 2b) — needed by both UIs
4. Account billing cancellation banner (Item 2a) — uses data from 2b+3
5. Pricing page CTA fixes (Item 1) — uses portal + data from 2b
6. Test suite (Item 5) — uses all the fixed code
7. Smoke checklist (Item 6) — document last
8. Documentation updates

## Definition of Done

- [ ] Pricing page CTAs work for all plan combinations (Free→Pro, Free→Ent, Pro→Free via portal, Pro→Ent, Ent→Pro via portal, Ent→Current)
- [ ] Cancellation state is visible on the account billing page
- [ ] Canceled subscriptions retain paid access until period end
- [ ] Webhook handler skips duplicate events (by Stripe event ID)
- [ ] `ProcessedStripeEvent` table created and new migration applied
- [ ] Billing portal accessible from both pricing page and account billing page
- [ ] Test suite covers checkout, subscription, webhook (incl. idempotency), and portal routes
- [ ] Smoke checklist written
- [ ] TypeScript passes across all workspaces
- [ ] Build passes
- [ ] `ROADMAP.md` updated
- [ ] `PROJECT_STATUS.md` updated
