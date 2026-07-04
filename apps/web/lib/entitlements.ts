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

/** Default grace period in days before PAST_DUE → FREE treatment. */
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

  // Map Prisma Plan enum → PlanId (lowercase)
  return {
    ...sub,
    plan: sub.plan.toLowerCase() as PlanId,
  };
}

/**
 * Get the effective plan ID for a user, accounting for grace periods.
 */
function getEffectivePlan(sub: PlanRecord): PlanId {
  if (sub.status === "PAST_DUE" && sub.currentPeriodEnd) {
    const graceEnd = new Date(sub.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS);
    if (new Date() < graceEnd) {
      // Still within grace period — keep current plan
      return sub.plan.toLowerCase() as PlanId;
    }
  }

  if (sub.status === "ACTIVE" || sub.status === "TRIALING") {
    return sub.plan.toLowerCase() as PlanId;
  }

  // FREE, CANCELED, or expired PAST_DUE
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

  if (feature === FeatureKeys.TEMPLATES) {
    // For template-specific checks, use canUseTemplate instead
    return effectivePlan !== "free";
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
export async function requireEntitlement(
  userId: string,
  feature: string,
): Promise<Response | null> {
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
 * Get the number of monthly exports used by a user.
 */
export async function getMonthlyExportCount(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await prisma.exportJob.count({
    where: {
      resume: { userId },
      createdAt: { gte: startOfMonth },
      format: "PDF",
    },
  });

  return count;
}

/**
 * Check if a user can export PDF this month (within plan limit).
 */
export async function canExportPdf(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sub = await getSubscription(userId);
  const effectivePlan = getEffectivePlan(sub);
  const monthlyLimit = planGetFeatureValue(effectivePlan, "monthly_exports") as number;

  if (!isFinite(monthlyLimit)) {
    return { allowed: true, remaining: Infinity };
  }

  const used = await getMonthlyExportCount(userId);
  const remaining = Math.max(0, monthlyLimit - used);
  return { allowed: remaining > 0, remaining };
}

/**
 * Get the PDF export kind (watermarked or clean) for a user.
 */
export async function getPdfExportKind(userId: string): Promise<"watermarked" | "clean"> {
  return getFeatureValue(userId, "pdf_export") as Promise<"watermarked" | "clean">;
}
