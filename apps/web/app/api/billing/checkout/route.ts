import { requireApiUser } from "../../../../lib/auth";
import { getStripe, getProfessionalPriceId, getEnterprisePriceId, getBaseUrl } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import { reportError } from "../../../../lib/error-reporting";
import { getRequestId } from "../../../../lib/request-id";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the given plan.
 *
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

    // Create checkout session
    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getBaseUrl()}/billing?checkout=success`,
      cancel_url: `${getBaseUrl()}/billing?checkout=canceled`,
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
