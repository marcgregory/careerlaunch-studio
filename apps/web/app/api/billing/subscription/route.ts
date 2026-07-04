import { requireApiUser } from "../../../../lib/auth";
import { getSubscription, getPdfExportKind, getMonthlyExportCount } from "../../../../lib/entitlements";
import { getAllPlans } from "@careerlaunch/domain";

/**
 * GET /api/billing/subscription
 *
 * Returns the current user's subscription status, plan details,
 * and available plans for upgrade comparison.
 */
export async function GET() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const planId = (await getSubscription(user.id)).plan.toLowerCase();
  const pdfExportKind = await getPdfExportKind(user.id);
  const monthlyExportsUsed = await getMonthlyExportCount(user.id);

  const plans = getAllPlans().map((plan) => ({
    id: plan.id,
    label: plan.label,
    entitlements: plan.entitlements,
    isCurrent: plan.id === planId,
  }));

  return Response.json({
    currentPlan: planId,
    pdfExportKind,
    monthlyExportsUsed,
    plans,
  });
}
