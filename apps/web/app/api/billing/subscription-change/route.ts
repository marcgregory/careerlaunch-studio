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

type SubscriptionChangeAction = "schedule_downgrade" | "cancel_scheduled_downgrade";

type SubscriptionChangeBody = {
  action?: SubscriptionChangeAction;
  plan?: string;
};

function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function isSubscriptionChangeAction(action: unknown): action is SubscriptionChangeAction {
  return action === "schedule_downgrade" || action === "cancel_scheduled_downgrade";
}

/**
 * POST /api/billing/subscription-change
 *
 * Applies subscription lifecycle changes that should happen through Stripe.
 * Body: { action: "schedule_downgrade", plan: "professional" }
 * Body: { action: "cancel_scheduled_downgrade" }
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  let body: SubscriptionChangeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, plan } = body;
  if (!isSubscriptionChangeAction(action)) {
    return Response.json(
      { error: "Invalid action." },
      { status: 400 },
    );
  }

  try {
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!subscription?.stripeSubscriptionId) {
      return Response.json(
        { error: "No active Stripe subscription found." },
        { status: 400 },
      );
    }

    const currentPlan = normalizePlan(subscription.plan);
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

    if (action === "cancel_scheduled_downgrade") {
      const existingSchedule = stripeSubscription.schedule;
      if (!existingSchedule) {
        return Response.json(
          { error: "No scheduled downgrade found." },
          { status: 400 },
        );
      }

      const schedule = typeof existingSchedule === "string"
        ? await stripe.subscriptionSchedules.retrieve(existingSchedule)
        : existingSchedule;

      if (!schedule.metadata?.scheduledPlan) {
        return Response.json(
          { error: "No scheduled downgrade found." },
          { status: 400 },
        );
      }

      await stripe.subscriptionSchedules.release(schedule.id);

      return Response.json({
        currentPlan: planLabel(currentPlan),
        renewalDate: getSubscriptionPeriodEnd(stripeSubscription),
      });
    }

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

    if (PLAN_RANK[currentPlan] <= PLAN_RANK[plan]) {
      return Response.json(
        { error: "Downgrade scheduling is only available for lower paid plans." },
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
    reportError(error, requestId, { action, plan, route: "billing-subscription-change" });

    const message = error instanceof Error ? error.message : "Subscription change failed";
    const safeMessage = process.env.NODE_ENV === "production"
      ? "Payment service error. Please try again."
      : message;

    return Response.json({ error: safeMessage }, { status: 500 });
  }
}
