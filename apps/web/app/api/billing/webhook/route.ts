import { getStripe, getProfessionalPriceId, getEnterprisePriceId } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import { reportError } from "../../../../lib/error-reporting";

/**
 * Safely check whether a Stripe event has been processed already.
 * If the ProcessedStripeEvent table doesn't exist (e.g. pending migration),
 * we degrade gracefully — no idempotency until the migration runs.
 */
async function isDuplicateEvent(eventId: string): Promise<boolean> {
  try {
    const alreadyProcessed = await prisma.processedStripeEvent.findUnique({
      where: { id: eventId },
    });
    return alreadyProcessed !== null;
  } catch (err) {
    // P2021 = table not found
    if (err instanceof Error && err.constructor.name === "PrismaClientKnownRequestError") {
      const code = (err as unknown as { code: string }).code;
      if (code === "P2021") {
        console.warn(`[webhook] ProcessedStripeEvent table missing — run 'prisma migrate deploy'. Skipping idempotency check.`);
        return false;
      }
    }
    throw err;
  }
}

/**
 * Safely record a processed event ID. Gracefully handles a missing table.
 */
async function recordProcessedEvent(eventId: string): Promise<void> {
  try {
    await prisma.processedStripeEvent.create({ data: { id: eventId } }).catch(() => {});
  } catch (err) {
    if (err instanceof Error && err.constructor.name === "PrismaClientKnownRequestError") {
      const code = (err as unknown as { code: string }).code;
      if (code === "P2021") {
        console.warn(`[webhook] ProcessedStripeEvent table missing — skipping event record for ${eventId}`);
        return;
      }
    }
    throw err;
  }
}

/**
 * POST /api/billing/webhook
 *
 * Receives Stripe webhook events to keep the local Subscription
 * record in sync with Stripe's billing state.
 *
 * Protected by Stripe webhook signature verification.
 *
 * Handled events:
 *   checkout.session.completed   — via metadata → upsert subscription
 *   customer.subscription.created — via price lookup → upsert
 *   customer.subscription.updated — via price lookup → update
 *   customer.subscription.deleted — mark canceled, reset to FREE
 *   invoice.payment_failed        — mark PAST_DUE
 *
 * Idempotency:
 *   Each event is tracked by its Stripe event ID (evt_xxx) in
 *   ProcessedStripeEvent. Duplicate delivery is silently acked.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    ) as unknown as { id: string; type: string; data: { object: Record<string, unknown> } };
  } catch (err) {
    reportError(err, "webhook", { route: "billing-webhook" });
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const obj = event.data.object;
  const eventType = event.type;
  const eventId = event.id;
  const logMeta = { eventType, eventId, route: "billing-webhook" };

  console.log(`[webhook] received ${eventType}`, { eventId, stripeId: obj.id });

  // ─── Idempotency check ───────────────────────────────────
  // Strip delivers events at least once. Skip events we've already processed.
  if (await isDuplicateEvent(eventId)) {
    console.log(`[webhook] skipping duplicate event ${eventId}`);
    return Response.json({ received: true });
  }

  try {
    switch (eventType) {
      // ─── Checkout Session Completed ───────────────────────────────
      // Fires when the user finishes the Stripe Checkout flow.
      // We learn userId + plan from metadata we set when creating the session.
      case "checkout.session.completed": {
        const sessionId = obj.id as string;
        console.log(`[webhook] processing checkout.session.completed`, {
          sessionId,
          customer: obj.customer,
          subscription: obj.subscription,
        });

        const metadata = obj.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;
        const plan = metadata?.plan;

        if (!userId || !plan) {
          console.warn(`[webhook] checkout.session.completed missing metadata`, { metadata });
          return Response.json({ error: "Missing metadata" }, { status: 400 });
        }

        const planEnum = plan === "enterprise" ? "ENTERPRISE" : "PROFESSIONAL";

        // Fetch the full subscription object from Stripe to get current_period_end
        let currentPeriodEnd: Date | null = null;
        const stripeSubId = obj.subscription as string | undefined;
        if (stripeSubId) {
          try {
            const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId);
            const subData = stripeSub as unknown as { current_period_end?: number };
            currentPeriodEnd = subData.current_period_end
              ? new Date(subData.current_period_end * 1000)
              : null;
          } catch (subErr) {
            console.warn(`[webhook] could not fetch subscription from Stripe`, {
              stripeSubId,
              error: subErr instanceof Error ? subErr.message : String(subErr),
            });
          }
        }

        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: planEnum,
            status: "ACTIVE",
            stripeCustomerId: obj.customer as string,
            stripeSubscriptionId: stripeSubId ?? null,
            currentPeriodEnd,
          },
          update: {
            plan: planEnum,
            status: "ACTIVE",
            stripeCustomerId: obj.customer as string,
            stripeSubscriptionId: stripeSubId ?? null,
            currentPeriodEnd,
          },
        });

        console.log(`[webhook] checkout.session.completed — updated subscription`, {
          userId,
          plan: planEnum,
          stripeSubId,
        });
        break;
      }

      // ─── Customer Subscription Created ────────────────────────────
      // Fires right after subscription.created — we handle it separately
      // so the DB is always in sync even if checkout.session.completed is slow.
      case "customer.subscription.created":
      // ─── Customer Subscription Updated ────────────────────────────
      // Fires on renewals, upgrades, downgrades, cancellations, etc.
      case "customer.subscription.updated": {
        const stripeSubId = obj.id as string;
        const status = mapStripeStatus(obj.status as string);

        // Determine plan from the first line item's price
        const items = obj.items as Record<string, unknown> | undefined;
        const dataArr = items?.data as Array<Record<string, unknown>> | undefined;
        const priceObj = dataArr?.[0]?.price as Record<string, unknown> | undefined;
        const priceId = priceObj?.id as string | undefined;

        // First try metadata on the price object, then fall back to price ID comparison
        let plan: "PROFESSIONAL" | "ENTERPRISE" = "PROFESSIONAL";
        if (priceId) {
          const professionalPriceId = getProfessionalPriceId();
          const enterprisePriceId = getEnterprisePriceId();
          if (priceId === enterprisePriceId) {
            plan = "ENTERPRISE";
          } else if (priceId === professionalPriceId) {
            plan = "PROFESSIONAL";
          } else if (priceObj?.metadata) {
            const priceMeta = priceObj.metadata as Record<string, string>;
            plan = priceMeta.plan === "enterprise" ? "ENTERPRISE" : "PROFESSIONAL";
          }
        }

        const currentPeriodEnd = obj.current_period_end
          ? new Date((obj.current_period_end as number) * 1000)
          : null;

        const cancelAtPeriodEnd = (obj.cancel_at_period_end as boolean) ?? false;

        console.log(`[webhook] processing subscription event`, {
          eventType,
          stripeSubId,
          plan,
          status,
          priceId,
        });

        // If we know the userId (from checkout.session.completed that already ran),
        // also set up the missing stripeCustomerId link.
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSubId },
          data: {
            plan,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd,
          },
        });

        break;
      }

      // ─── Customer Subscription Deleted ────────────────────────────
      case "customer.subscription.deleted": {
        const deletedSubId = obj.id as string;
        console.log(`[webhook] processing customer.subscription.deleted`, { deletedSubId });

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

      // ─── Invoice Payment Failed ───────────────────────────────────
      case "invoice.payment_failed": {
        const invoiceSubId = obj.subscription as string;

        if (invoiceSubId) {
          console.log(`[webhook] processing invoice.payment_failed`, { invoiceSubId });
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoiceSubId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        console.log(`[webhook] unhandled event type: ${eventType}`);
        break;
    }

    // Record the event ID for idempotency.
    // Gracefully handles a missing ProcessedStripeEvent table.
    await recordProcessedEvent(eventId);

    return Response.json({ received: true });
  } catch (err) {
    reportError(err, "webhook", logMeta);
    console.error(`[webhook] handler failed for ${eventType}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
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
