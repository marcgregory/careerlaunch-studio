import { requireApiUser } from "../../../../lib/auth";
import { getStripe, getBaseUrl } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import { reportError } from "../../../../lib/error-reporting";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription, invoices, and payment methods.
 */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return Response.json(
        { error: "No subscription found. Upgrade first." },
        { status: 400 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getBaseUrl()}/account/billing`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    reportError(error, "billing-portal", { route: "billing-portal" });

    const message = error instanceof Error ? error.message : "Portal error";
    const safeMessage = process.env.NODE_ENV === "production"
      ? "Payment service error. Please try again."
      : message;

    return Response.json({ error: safeMessage }, { status: 500 });
  }
}
