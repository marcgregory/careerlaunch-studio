# Billing Production Smoke Checklist

Run through these flows before marking Sprint 5.5 as complete. Each step should produce the described outcome.

---

## 1. Upgrade flow

| # | Step | Expected |
|---|------|----------|
| 1.1 | Create a new account | Dashboard loads, free plan badge in sidebar |
| 1.2 | Navigate to `/billing` | Three plan cards visible, "Current plan" on Free |
| 1.3 | Click "Upgrade to Professional" | Redirected to Stripe Checkout |
| 1.4 | Complete Checkout using a real test card (`4242 4242 4242 4242`) | Redirected back to `/billing?checkout=success` |
| 1.5 | Wait for post-checkout polling | Page updates to show "Professional" as current plan |
| 1.6 | Navigate to `/account/billing` | Shows "Professional Plan", export quality "Clean" |

## 2. Premium feature access

| # | Step | Expected |
|---|------|----------|
| 2.1 | Go to `/builder` and create a new resume | New draft created |
| 2.2 | Change template to "Executive" or "ATS Classic" | Template applies without warning/block |
| 2.3 | Save the resume | Save succeeds |
| 2.4 | Export the resume as PDF | Download receives clean PDF (no watermark) |
| 2.5 | Run AI analysis | Full analysis runs |

## 3. Usage tracking

| # | Step | Expected |
|---|------|----------|
| 3.1 | Export 2 PDFs | Succeeds |
| 3.2 | Go to `/account/billing` | PDF Exports shows "2 this month" |

## 4. Cancellation

| # | Step | Expected |
|---|------|----------|
| 4.1 | Click "Manage billing" on `/account/billing` | Stripe Customer Portal opens |
| 4.2 | Click "Cancel subscription" in the portal | Cancellation confirmed |
| 4.3 | Return to `/account/billing` | Shows orange banner: "Your subscription will end on {date}" |
| 4.4 | Go to `/billing` | Current plan shows "Current plan — cancels {date}", "Reactivate" button visible |
| 4.5 | Try to create a resume with Executive template | Succeeds (paid access until period end) |
| 4.6 | Export PDF | No watermark (paid access until period end) |

## 5. Reactivation

| # | Step | Expected |
|---|------|----------|
| 5.1 | Click "Reactivate" on `/account/billing` | Stripe Customer Portal opens |
| 5.2 | Reactivate the subscription in Stripe | Confirmation shown |
| 5.3 | Return to `/account/billing` | Cancellation banner disappears |
| 5.4 | Go to `/billing` | "Current plan" badge, no cancellation date |

## 6. Post-cancellation expiration

| # | Step | Expected |
|---|------|----------|
| 6.1 | Manually set `currentPeriodEnd` to a past date in the DB, or wait for period end | — |
| 6.2 | Refresh `/account/billing` | Plan shows Free |
| 6.3 | Export PDF | Watermark present |
| 6.4 | Try to use Executive template | Blocked or limited to Free templates |
| 6.5 | Resume limit check | Count applies to Free limit |

## 7. Webhook resilience

| # | Step | Expected |
|---|------|----------|
| 7.1 | Trigger a `customer.subscription.updated` event in Stripe | Webhook fires, DB updates |
| 7.2 | Re-trigger the same event (or check `ProcessedStripeEvent` table for the event ID) | Second delivery returns 200, DB unchanged |
| 7.3 | Check `ProcessedStripeEvent` table | Event ID present with `createdAt` timestamp |

## 8. Payment failure

| # | Step | Expected |
|---|------|----------|
| 8.1 | Upgrade using Stripe test card `4000 0000 0000 0341` (declined) | Payment fails, shown in Stripe |
| 8.2 | Wait for failed invoice event | DB subscription marked PAST_DUE |
| 8.3 | Check paid features during grace period | Still accessible (PAST_DUE grace = 3 days) |
| 8.4 | After grace period expires (or set `currentPeriodEnd` + `PAST_DUE_GRACE_DAYS=0`) | Fallen to Free entitlements |

## 9. Downgrade from Enterprise → Professional

| # | Step | Expected |
|---|------|----------|
| 9.1 | Upgrade to Enterprise | Enterprise current |
| 9.2 | Navigate to `/billing` | "Change plan" button on Professional card |
| 9.3 | Click "Change plan" | Stripe Customer Portal opens |
| 9.4 | Switch to Professional in Stripe | Confirmation |
| 9.5 | Return to app | Plan updates via webhook to Professional |
| 9.6 | Priority support check | No longer available |

## 10. Enterprise user sees correct UI

| # | Step | Expected |
|---|------|----------|
| 10.1 | Upgrade to Enterprise | Enterprise current |
| 10.2 | Navigate to `/billing` | Enterprise shows "Current plan", Professional shows "Change plan", Free shows "Contact support" |
| 10.3 | Navigate to `/account/billing` | Shows "Enterprise Plan", no upgrade CTA |
