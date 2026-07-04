/**
 * Entitlement types for the billing & entitlement system.
 *
 * Plans define a set of feature values. Features are checked at runtime
 * via `can(userId, feature)` or `getFeatureValue(userId, feature)`.
 */

export type PlanId = "free" | "professional" | "enterprise";

export type TemplateAccess =
  | { kind: "all" }
  | { kind: "list"; templateIds: string[] };

export type PdfExportKind = "watermarked" | "clean";

export type FeatureValue = boolean | number | string | TemplateAccess | PdfExportKind;

export type Entitlements = {
  resume_limit: number;
  templates: TemplateAccess;
  ai_analysis: boolean;
  job_match: boolean;
  cover_letter: boolean;
  pdf_export: PdfExportKind;
  monthly_exports: number;
  premium_templates: boolean;
  priority_support: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  label: string;
  entitlements: Entitlements;
};

export type PlanRecord = {
  id: string;
  userId: string;
  plan: PlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: "FREE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Feature keys used for entitlement checks across the app.
 * Every feature gate should use one of these constants.
 */
export const FeatureKeys = {
  /** Maximum number of resume drafts allowed */
  RESUME_LIMIT: "resume_limit",
  /** Template IDs the user can use */
  TEMPLATES: "templates",
  /** Whether AI analysis is available */
  AI_ANALYSIS: "ai_analysis",
  /** Whether job match is available */
  JOB_MATCH: "job_match",
  /** Whether cover letter builder is available */
  COVER_LETTER: "cover_letter",
  /** Whether PDF export is watermarked or clean */
  PDF_EXPORT: "pdf_export",
  /** Number of exports allowed per month */
  MONTHLY_EXPORTS: "monthly_exports",
  /** Whether premium templates are unlocked */
  PREMIUM_TEMPLATES: "premium_templates",
  /** Whether priority support is available */
  PRIORITY_SUPPORT: "priority_support",
} as const;
