import { getAllPlans } from "@careerlaunch/domain";
import { requireApiUser } from "../../../../lib/auth";
import { getDefaultPaymentMethodSummary, type InvoiceSummary, summarizeInvoice } from "../../../../lib/billing-stripe";
import { getMonthlyExportCount, getPdfExportKind, getSubscription } from "../../../../lib/entitlements";
import { reportError } from "../../../../lib/error-reporting";
import { getStripe } from "../../../../lib/stripe";

/**
 * GET /api/billing/subscription
 *
 * Returns the current user's subscription status, plan details,
 * and available plans for upgrade comparison.
 */
export async function GET() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const sub = await getSubscription(user.id);
  const planId = sub.plan.toLowerCase();
  const pdfExportKind = await getPdfExportKind(user.id);
  const monthlyExportsUsed = await getMonthlyExportCount(user.id);
  let paymentMethod = null;
  let invoices: InvoiceSummary[] = [];

  if (sub.stripeCustomerId) {
    try {
      const stripe = getStripe();
      const stripeSub = sub.stripeSubscriptionId
        ? await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
        : null;
      const invoiceList = await stripe.invoices.list({
        customer: sub.stripeCustomerId,
        limit: 5,
      });

      paymentMethod = await getDefaultPaymentMethodSummary(stripe, stripeSub, sub.stripeCustomerId);
      invoices = invoiceList.data.map(summarizeInvoice);
    } catch (error) {
      reportError(error, "billing-subscription-stripe-summary", {
        route: "billing-subscription",
        userId: user.id,
      });
    }
  }

  const plans = getAllPlans().map((plan) => ({
    id: plan.id,
    label: plan.label,
    entitlements: plan.entitlements,
    isCurrent: plan.id === planId,
  }));

  return Response.json({
    currentPlan: planId,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    pdfExportKind,
    monthlyExportsUsed,
    paymentMethod,
    invoices,
    plans,
  });
}