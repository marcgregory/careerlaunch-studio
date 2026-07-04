import { getStripe } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import { reportError } from "../../../../lib/error-reporting";

/**
 * POST /api/billing/webhook
 *
 * Receives Stripe webhook events to keep the local Subscription
 * record in sync with Stripe's billing state.
 *
 * Protected by Stripe webhook signature verification.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let rawEvent: { type: string; data: { object: Record<string, unknown> } };
  try {
    rawEvent = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    ) as unknown as { type: string; data: { object: Record<string, unknown> } };
  } catch (err) {
    reportError(err, "webhook", { route: "billing-webhook" });
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const obj = rawEvent.data.object;

  try {
    switch (rawEvent.type) {
      case "checkout.session.completed": {
        const metadata = obj.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;
        const plan = metadata?.plan;

        if (!userId || !plan) {
          return Response.json({ error: "Missing metadata" }, { status: 400 });
        }

        const planEnum = plan === "enterprise" ? "ENTERPRISE" : "PROFESSIONAL";

        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: planEnum,
            status: "ACTIVE",
            stripeCustomerId: obj.customer as string,
            stripeSubscriptionId: obj.subscription as string,
          },
          update: {
            plan: planEnum,
            status: "ACTIVE",
            stripeCustomerId: obj.customer as string,
            stripeSubscriptionId: obj.subscription as string,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const stripeSubId = obj.id as string;
        const items = obj.items as Record<string, unknown>;
        const dataArr = items.data as Array<Record<string, unknown>> | undefined;
        const priceMeta = dataArr?.[0]?.price as Record<string, unknown> | undefined;
        const pricePlanMeta = priceMeta?.metadata as Record<string, string> | undefined;
        const plan = pricePlanMeta?.plan === "enterprise" ? "ENTERPRISE" : "PROFESSIONAL";

        const status = mapStripeStatus(obj.status as string);
        const currentPeriodEnd = obj.current_period_end
          ? new Date((obj.current_period_end as number) * 1000)
          : null;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSubId },
          data: {
            plan,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd: (obj.cancel_at_period_end as boolean) ?? false,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSubId = obj.id as string;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: deletedSubId },
          data: {
            status: "CANCELED",
            plan: "FREE",
            currentPeriodEnd: obj.current_period_end
              ? new Date((obj.current_period_end as number) * 1000)
              : null,
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoiceSubId = obj.subscription as string;

        if (invoiceSubId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoiceSubId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        // Unhandled event type — no action needed
        break;
    }
  } catch (err) {
    reportError(err, "webhook", { type: rawEvent.type, route: "billing-webhook" });
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}

function mapStripeStatus(
  status: string,
): "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "FREE" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "trialing":
      return "TRIALING";
    default:
      return "FREE";
  }
}
