import { requireApiUser } from "../../../../lib/auth";
import {
  getPriceIdForPlan,
  getSubscriptionPeriodEnd,
  getSubscriptionPeriodEndTimestamp,
  getSubscriptionPeriodStartTimestamp,
  isPaidPlan,
  normalizePlan,
  PLAN_RANK,
} from "../../../../lib/billing-stripe";
import { reportError } from "../../../../lib/error-reporting";
import { prisma } from "../../../../lib/prisma";
import { getRequestId } from "../../../../lib/request-id";
import { getStripe } from "../../../../lib/stripe";

function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/**
 * POST /api/billing/schedule-downgrade
 *
 * Schedules a paid plan downgrade for the next billing period.
 * Body: { plan: "professional" }
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

  const newPriceId = getPriceIdForPlan(plan);
  if (!newPriceId) {
    return Response.json(
      { error: "Payment configuration is not set up yet. Contact support." },
      { status: 500 },
    );
  }

  try {
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const currentPlan = normalizePlan(subscription?.plan);

    if (PLAN_RANK[currentPlan] <= PLAN_RANK[plan]) {
      return Response.json(
        { error: "Downgrade scheduling is only available for lower paid plans." },
        { status: 400 },
      );
    }

    if (!subscription?.stripeSubscriptionId) {
      return Response.json(
        { error: "No active Stripe subscription found." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
      { expand: ["schedule"] },
    );

    if (stripeSubscription.status !== "active" && stripeSubscription.status !== "trialing") {
      return Response.json(
        { error: "Only active subscriptions can be changed." },
        { status: 400 },
      );
    }

    const item = stripeSubscription.items.data[0];
    const currentPeriodStart = getSubscriptionPeriodStartTimestamp(stripeSubscription);
    const currentPeriodEnd = getSubscriptionPeriodEndTimestamp(stripeSubscription);
    if (!item || !currentPeriodStart || !currentPeriodEnd) {
      throw new Error("Subscription is missing item or billing period");
    }

    const existingSchedule = stripeSubscription.schedule;
    const schedule = typeof existingSchedule === "string"
      ? await stripe.subscriptionSchedules.retrieve(existingSchedule)
      : existingSchedule
        ? existingSchedule
        : await stripe.subscriptionSchedules.create({
            from_subscription: subscription.stripeSubscriptionId,
          });

    const currentPhaseStart = schedule.current_phase?.start_date ?? currentPeriodStart;
    const currentPriceId = typeof item.price === "string" ? item.price : item.price.id;
    const quantity = item.quantity ?? 1;

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPriceId, quantity }],
          start_date: currentPhaseStart,
          end_date: currentPeriodEnd,
          proration_behavior: "none",
        },
        {
          items: [{ price: newPriceId, quantity }],
          start_date: currentPeriodEnd,
          proration_behavior: "none",
        },
      ],
      proration_behavior: "none",
      metadata: {
        userId: user.id,
        scheduledPlan: plan,
      },
    });

    return Response.json({
      currentPlan: planLabel(currentPlan),
      scheduledPlan: planLabel(plan),
      effectiveDate: getSubscriptionPeriodEnd(stripeSubscription),
    });
  } catch (error) {
    const requestId = getRequestId(request);
    reportError(error, requestId, { plan, route: "billing-schedule-downgrade" });

    const message = error instanceof Error ? error.message : "Downgrade scheduling failed";
    const safeMessage = process.env.NODE_ENV === "production"
      ? "Payment service error. Please try again."
      : message;

    return Response.json({ error: safeMessage }, { status: 500 });
  }
}