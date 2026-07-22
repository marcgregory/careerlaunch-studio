import { getAllPlans } from "@careerlaunch/domain";
import { requireApiUser } from "../../../../lib/auth";
import { getDefaultPaymentMethodSummary, getSubscriptionPeriodEnd, type InvoiceSummary, summarizeInvoice } from "../../../../lib/billing-stripe";
import { getMonthlyExportCount, getPdfExportKind, getSubscription } from "../../../../lib/entitlements";
import { reportError } from "../../../../lib/error-reporting";
import { getStripe } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";

type ScheduledChange = {
  plan: string;
  effectiveDate: string | null;
} | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function timestampToIso(value: unknown): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getScheduledChange(stripeSub: unknown): ScheduledChange {
  const subscription = asRecord(stripeSub);
  const schedule = asRecord(subscription?.schedule);
  if (!schedule) return null;

  const metadata = asRecord(schedule.metadata);
  const scheduledPlan = typeof metadata?.scheduledPlan === "string"
    ? metadata.scheduledPlan
    : null;
  if (!scheduledPlan) return null;

  const currentPhase = asRecord(schedule.current_phase);
  const effectiveDate = timestampToIso(currentPhase?.end_date);

  return {
    plan: scheduledPlan,
    effectiveDate,
  };
}

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
  let scheduledChange: ScheduledChange = null;
  let livePeriodEnd: string | null = null;

  if (sub.stripeCustomerId) {
    try {
      const stripe = getStripe();
      const stripeSub = sub.stripeSubscriptionId
        ? await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, { expand: ["schedule"] })
        : null;
      const invoiceList = await stripe.invoices.list({
        customer: sub.stripeCustomerId,
        limit: 5,
      });

      scheduledChange = getScheduledChange(stripeSub);
      paymentMethod = await getDefaultPaymentMethodSummary(stripe, stripeSub, sub.stripeCustomerId);
      invoices = invoiceList.data.map(summarizeInvoice);

      if (stripeSub) {
        const liveEndIso = getSubscriptionPeriodEnd(stripeSub);
        if (liveEndIso && (!sub.currentPeriodEnd || sub.currentPeriodEnd.toISOString() !== liveEndIso)) {
          prisma.subscription.update({
            where: { userId: user.id },
            data: { currentPeriodEnd: new Date(liveEndIso) },
          }).catch(() => {});
        }
        livePeriodEnd = liveEndIso;
      }
    } catch (error) {
      reportError(error, "billing-subscription-stripe-summary", {
        route: "billing-subscription",
        userId: user.id,
      });
    }
  }

  const effectivePeriodEnd = livePeriodEnd ?? (sub.currentPeriodEnd?.toISOString() ?? null);

  const plans = getAllPlans().map((plan) => ({
    id: plan.id,
    label: plan.label,
    entitlements: plan.entitlements,
    isCurrent: plan.id === planId,
  }));

  return Response.json({
    currentPlan: planId,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: effectivePeriodEnd,
    pdfExportKind,
    monthlyExportsUsed,
    paymentMethod,
    invoices,
    scheduledChange,
    plans,
  });
}