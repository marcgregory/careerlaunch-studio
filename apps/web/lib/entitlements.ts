import { prisma } from "./prisma";
import {
  can as planCan,
  getFeatureValue as planGetFeatureValue,
  getEntitlements,
  getResumeLimit,
  canUseTemplate,
  type PlanId,
  type PlanRecord,
  type FeatureValue,
  type Entitlements,
  type TemplateAccess,
  FeatureKeys,
} from "@careerlaunch/domain";

export type { PlanRecord, Entitlements, FeatureValue };

export { FeatureKeys };

/** Default grace period in days before expired PAST_DUE subscriptions use free entitlements. */
const PAST_DUE_GRACE_MS = (parseInt(process.env.PAST_DUE_GRACE_DAYS || "3", 10)) * 24 * 60 * 60 * 1000;

/**
 * Get the user's subscription record, creating a FREE default if none exists.
 */
export async function getSubscription(userId: string): Promise<PlanRecord> {
  let sub = await prisma.subscription.findUnique({ where: { userId } });

  if (!sub) {
    sub = await prisma.subscription.create({
      data: { userId, plan: "FREE", status: "FREE" },
    });
  }

  return {
    ...sub,
    plan: sub.plan.toLowerCase() as PlanId,
  };
}

/**
 * Get the effective plan ID for a user, accounting for payment grace periods.
 */
function getEffectivePlan(sub: PlanRecord): PlanId {
  if (sub.status === "PAST_DUE" && sub.currentPeriodEnd) {
    const graceEnd = new Date(sub.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS);
    if (new Date() < graceEnd) {
      return sub.plan;
    }
  }

  if (sub.status === "ACTIVE" || sub.status === "TRIALING" || sub.status === "FREE") {
    return sub.plan;
  }

  return "free";
}

/**
 * Check if a user can perform a given feature.
 */
export async function can(userId: string, feature: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  const effectivePlan = getEffectivePlan(sub);

  if (feature === FeatureKeys.RESUME_LIMIT) {
    const limit = getResumeLimit(effectivePlan);
    if (!isFinite(limit)) return true;
    const count = await prisma.resumeDocument.count({ where: { userId } });
    return count < limit;
  }

  return planCan(effectivePlan, feature);
}

/**
 * Check if a user can access a specific template.
 */
export async function canUseTemplateByUser(userId: string, templateId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  const effectivePlan = getEffectivePlan(sub);
  return canUseTemplate(effectivePlan, templateId);
}

/**
 * Get the resolved feature value for a user.
 */
export async function getFeatureValue(userId: string, feature: string): Promise<FeatureValue> {
  const sub = await getSubscription(userId);
  const effectivePlan = getEffectivePlan(sub);

  if (feature === FeatureKeys.RESUME_LIMIT) {
    return getResumeLimit(effectivePlan);
  }

  if (feature === FeatureKeys.TEMPLATES) {
    return planGetFeatureValue(effectivePlan, feature) as TemplateAccess;
  }

  return planGetFeatureValue(effectivePlan, feature) as FeatureValue;
}

/**
 * For API routes: returns a 403 Response if the user lacks an entitlement,
 * or null if they can proceed.
 */
export async function requireEntitlement(userId: string, feature: string): Promise<Response | null> {
  const allowed = await can(userId, feature);
  if (!allowed) {
    return Response.json(
      {
        error: "This feature requires a paid plan.",
        feature,
        upgradeUrl: "/billing",
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Get the full entitlements object for a user.
 */
export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const sub = await getSubscription(userId);
  const effectivePlan = getEffectivePlan(sub);
  return getEntitlements(effectivePlan);
}

/**
 * Get the number of monthly PDF exports used by a user.
 */
export async function getMonthlyExportCount(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return prisma.exportJob.count({
    where: {
      resume: { userId },
      createdAt: { gte: startOfMonth },
      format: "PDF",
    },
  });
}

/**
 * Check if a user can export PDF this month under the plan's export limit.
 */
export async function canExportPdf(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const monthlyLimit = await getFeatureValue(userId, FeatureKeys.MONTHLY_EXPORTS) as number;

  if (!isFinite(monthlyLimit)) {
    return { allowed: true, remaining: Infinity };
  }

  const used = await getMonthlyExportCount(userId);
  const remaining = Math.max(0, monthlyLimit - used);
  return { allowed: remaining > 0, remaining };
}

/**
 * Check whether the user can export without a watermark.
 */
export async function canExportCleanPdf(userId: string): Promise<boolean> {
  return can(userId, FeatureKeys.EXPORT_CLEAN_PDF);
}

/**
 * Get the PDF export kind (watermarked or clean) for a user.
 */
export async function getPdfExportKind(userId: string): Promise<"watermarked" | "clean"> {
  return getFeatureValue(userId, FeatureKeys.PDF_EXPORT) as Promise<"watermarked" | "clean">;
}
