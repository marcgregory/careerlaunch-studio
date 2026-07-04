import type { PlanDefinition, PlanId, Entitlements, TemplateAccess } from "./types";

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Free",
    entitlements: {
      resume_limit: 3,
      templates: { kind: "list", templateIds: ["modern", "minimal"] },
      ai_analysis: true,
      job_match: false,
      cover_letter: true,
      pdf_export: "watermarked",
      monthly_exports: 5,
      premium_templates: false,
      priority_support: false,
    },
  },
  professional: {
    id: "professional",
    label: "Professional",
    entitlements: {
      resume_limit: Infinity,
      templates: { kind: "all" },
      ai_analysis: true,
      job_match: true,
      cover_letter: true,
      pdf_export: "clean",
      monthly_exports: Infinity,
      premium_templates: true,
      priority_support: false,
    },
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    entitlements: {
      resume_limit: Infinity,
      templates: { kind: "all" },
      ai_analysis: true,
      job_match: true,
      cover_letter: true,
      pdf_export: "clean",
      monthly_exports: Infinity,
      premium_templates: true,
      priority_support: true,
    },
  },
};

export function getPlan(planId: PlanId): PlanDefinition {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}

export function getEntitlements(planId: PlanId): Entitlements {
  return getPlan(planId).entitlements;
}

/**
 * Check whether a specific feature resolves to a truthy value for a plan.
 * Works for boolean features.
 */
export function can(planId: PlanId, feature: string): boolean {
  const entitlements = getEntitlements(planId);
  const value = entitlements[feature as keyof Entitlements];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "object" && value !== null) return true;
  return Boolean(value);
}

/**
 * Get the raw feature value for a plan.
 */
export function getFeatureValue(planId: PlanId, feature: string): unknown {
  const entitlements = getEntitlements(planId);
  return entitlements[feature as keyof Entitlements];
}

/**
 * Get all plan definitions (for the pricing page).
 */
export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLANS);
}

/**
 * Check if a user on the given plan can access a specific template.
 */
export function canUseTemplate(planId: PlanId, templateId: string): boolean {
  const access = getEntitlements(planId).templates;
  if (access.kind === "all") return true;
  return access.templateIds.includes(templateId);
}

/**
 * Get the effective resume limit for a plan.
 */
export function getResumeLimit(planId: PlanId): number {
  return getEntitlements(planId).resume_limit;
}
