import { requireApiUser } from "../../../../lib/auth";
import {
  centsToMajor,
  getDefaultPaymentMethodSummary,
  getPriceIdForPlan,
  getSubscriptionPeriodEnd,
  isPaidPlan,
  normalizePlan,
  PLAN_RANK,
} from "../../../../lib/billing-stripe";
import { reportError } from "../../../../lib/error-reporting";
import { prisma } from "../../../../lib/prisma";
import { getRequestId } from "../../../../lib/request-id";
import { getStripe } from "../../../../lib/stripe";

type PreviewLine = {
  label: string;
  amount: number;
};

function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function newSubscriptionPreview({
  currentPlan,
  currency,
  nextRenewal,
  plan,
}: {
  currentPlan: string;
  currency: string;
  nextRenewal: number;
  plan: string;
}) {
  return {
    todayCharge: nextRenewal,
    currency,
    currentPlan: planLabel(currentPlan),
    newPlan: planLabel(plan),
    nextRenewal,
    renewalDate: null,
    paymentMethod: null,
    lines: [{ label: `${planLabel(plan)} subscription`, amount: nextRenewal }] satisfies PreviewLine[],
  };
}

/**
 * POST /api/billing/preview-upgrade
 *
 * Returns the Stripe-calculated charge preview before an upgrade is confirmed.
 * Body: { plan: "professional" | "enterprise" }
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan } = body;
  if (!isPaidPlan(plan)) {
    return Response.json(
      { error: "Invalid plan. Must be 'professional' or 'enterprise'." },
      { status: 400 },
    );
  }

  const priceId = getPriceIdForPlan(plan);
  if (!priceId) {
    return Response.json(
      { error: "Payment configuration is not set up yet. Contact support." },
      { status: 500 },
    );
  }

  try {
    const stripe = getStripe();
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const currentPlan = normalizePlan(subscription?.plan);

    if (PLAN_RANK[currentPlan] >= PLAN_RANK[plan]) {
      return Response.json(
        { error: "Preview is only available for upgrades." },
        { status: 400 },
      );
    }

    const price = await stripe.prices.retrieve(priceId);
    const nextRenewal = centsToMajor(price.unit_amount);
    const currency = price.currency.toUpperCase();
    const fallbackPreview = newSubscriptionPreview({ currentPlan, currency, nextRenewal, plan });

    if (
      !subscription?.stripeCustomerId ||
      !subscription.stripeSubscriptionId ||
      (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING")
    ) {
      return Response.json(fallbackPreview);
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );

    if (stripeSubscription.status !== "active" && stripeSubscription.status !== "trialing") {
      return Response.json(fallbackPreview);
    }

    const subscriptionItem = stripeSubscription.items.data[0];
    if (!subscriptionItem?.id) {
      throw new Error("No subscription item found for upgrade preview");
    }

    const prorationDate = Math.floor(Date.now() / 1000);
    const preview = await stripe.invoices.createPreview({
      customer: subscription.stripeCustomerId,
      subscription: subscription.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: subscriptionItem.id, price: priceId }],
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
      },
    });

    let paymentMethod = null;
    try {
      paymentMethod = await getDefaultPaymentMethodSummary(
        stripe,
        stripeSubscription,
        subscription.stripeCustomerId,
      );
    } catch (error) {
      reportError(error, "billing-preview-payment-method", {
        route: "billing-preview-upgrade",
        userId: user.id,
      });
    }

    return Response.json({
      todayCharge: centsToMajor(preview.amount_due),
      currency: preview.currency.toUpperCase(),
      currentPlan: planLabel(currentPlan),
      newPlan: planLabel(plan),
      nextRenewal,
      renewalDate: getSubscriptionPeriodEnd(stripeSubscription),
      paymentMethod,
      lines: preview.lines.data.map((line) => ({
        label: line.description ?? "Billing adjustment",
        amount: centsToMajor(line.amount),
      })) satisfies PreviewLine[],
    });
  } catch (error) {
    const requestId = getRequestId(request);
    reportError(error, requestId, { plan, route: "billing-preview-upgrade" });

    const message = error instanceof Error ? error.message : "Upgrade preview failed";
    const safeMessage = process.env.NODE_ENV === "production"
      ? "Payment service error. Please try again."
      : message;

    return Response.json({ error: safeMessage }, { status: 500 });
  }
}