/**
 * Types for the AI Resume Tailoring module.
 *
 * Generates targeted rewrite suggestions for resume sections
 * based on the gap analysis. Every suggestion includes before/after
 * text, a reason, and a confidence score.
 */

import type { SuggestionLocation } from "../suggestion/types";
import type { NormalizedResume } from "../analysis/types";
import type { GapAnalysis } from "../gap-analysis/types";
import type { JobAnalysis } from "../job-analysis/types";

export interface TailoringInput {
  /** Normalized resume */
  resume: NormalizedResume;
  /** Job analysis output (Phase 1) */
  jobAnalysis: JobAnalysis;
  /** Gap analysis output (Phase 2) */
  gapAnalysis: GapAnalysis;
}

// ─── Safety Flag Types ───────────────────────────────────────────────────

export type SafetyFlagType =
  | "fabricated_metric"
  | "leadership_inflation"
  | "responsibility_expansion";

export interface SafetyFlag {
  type: SafetyFlagType;
  message: string;
}

export interface TailorSuggestion {
  /** Stable ID for deduplication */
  id: string;
  /** Which section this targets */
  category: "summary" | "experience" | "skills";
  /** Location within the resume */
  location: SuggestionLocation;
  /** Current text in the resume */
  before: string;
  /** AI-suggested replacement */
  after: string;
  /** Why this change helps */
  reason: string;
  /** How confident the AI is (0–1) */
  confidence: number;
  /** Severity level */
  severity: "critical" | "major" | "medium" | "minor" | "info";
  /** Safety flags — set when the post-processor detects potential fabrications */
  safetyFlags?: SafetyFlag[];
}

/** Default empty result */
export function emptyTailorResult(): TailorSuggestion[] {
  return [];
}
