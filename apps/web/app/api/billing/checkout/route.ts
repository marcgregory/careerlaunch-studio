import { requireApiUser } from "../../../../lib/auth";
import { getStripe, getProfessionalPriceId, getEnterprisePriceId, getBaseUrl } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import { reportError } from "../../../../lib/error-reporting";
import { getRequestId } from "../../../../lib/request-id";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the given plan, OR upgrades the
 * existing subscription in-place if the customer already has one.
 *
 * Body: { plan: "professional" | "enterprise" }
 *
 * For first-time subscribers: creates a Checkout Session → redirect to Stripe.
 * For existing subscribers: swaps the price on the current subscription with
 * proration → redirect back to billing with a success message.
 * This prevents creating two active subscriptions and double-billing.
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

  if (plan !== "professional" && plan !== "enterprise") {
    return Response.json(
      { error: "Invalid plan. Must be 'professional' or 'enterprise'." },
      { status: 400 },
    );
  }

  const priceId = plan === "professional" ? getProfessionalPriceId() : getEnterprisePriceId();
  if (!priceId) {
    return Response.json(
      { error: "Payment configuration is not set up yet. Contact support." },
      { status: 500 },
    );
  }

  try {
    // Get or create the Stripe customer
    let subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    let stripeCustomerId = subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;

      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, plan: "FREE", status: "FREE", stripeCustomerId },
        update: { stripeCustomerId },
      });
    }

    // ─── Existing subscriber? Upgrade in-place ──────────────────────────
    // If the user already has a Stripe subscription, update its price
    // with prorations instead of creating a second subscription.
    // This prevents double-billing the customer (the core bug).
    if (subscription?.stripeSubscriptionId && subscription?.status === "ACTIVE") {
      const stripeSub = await getStripe().subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      if (stripeSub.status === "active" || stripeSub.status === "trialing") {
        const items = stripeSub.items as unknown as {
          data: Array<{ id: string; price: Record<string, unknown> }>;
        };

        const itemId = items.data[0]?.id;
        if (!itemId) {
          throw new Error("No subscription items found to update");
        }

        await getStripe().subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: "create_prorations",
          },
        );

        // Update local DB immediately for responsiveness; the
        // customer.subscription.updated webhook will confirm it.
        await prisma.subscription.update({
          where: { userId: user.id },
          data: {
            plan: plan === "enterprise" ? "ENTERPRISE" : "PROFESSIONAL",
          },
        });

        // Redirect back to billing page with success param
        return Response.json({
          url: `${getBaseUrl(request)}/billing?upgrade=completed&plan=${plan}`,
        });
      }
    }

    // ─── First-time subscriber → Checkout Session ──────────────────────
    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getBaseUrl(request)}/billing?checkout=success`,
      cancel_url: `${getBaseUrl(request)}/billing?checkout=canceled`,
      metadata: { userId: user.id, plan },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const requestId = getRequestId(request);
    reportError(error, requestId, { plan, route: "billing-checkout" });

    const message = error instanceof Error ? error.message : "Checkout failed";
    // Don't leak raw Stripe error details to the client in production
    const safeMessage = process.env.NODE_ENV === "production"
      ? "Payment service error. Please try again."
      : message;

    return Response.json({ error: safeMessage }, { status: 500 });
  }
}
