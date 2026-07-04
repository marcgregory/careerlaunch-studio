import { requireApiUser } from "../../../../lib/auth";
import { getStripe, getBaseUrl } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription, invoices, and payment methods.
 */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (response) return response;

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
}
