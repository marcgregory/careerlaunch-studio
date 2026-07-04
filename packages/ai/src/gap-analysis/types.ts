/**
 * Types for the Resume Gap Analysis module.
 *
 * Compares the analyzed job against the normalized resume to produce
 * a detailed gap report with match score, missing skills, weak sections,
 * and actionable recommendations.
 */

import type { JobAnalysis } from "../job-analysis/types";
import type { NormalizedResume } from "../analysis/types";

export interface GapAnalysisInput {
  /** Normalized resume from the analysis pipeline */
  resume: NormalizedResume;
  /** Structured job analysis (output of Phase 1) */
  jobAnalysis: JobAnalysis;
  /** Raw job description text for fallback matching */
  jobDescription: string;
}

export interface GapAnalysis {
  /** Overall match score 0–100 */
  matchScore: number;
  /** Skills present in both the resume and the job requirements */
  matchedSkills: string[];
  /** Skills required by the job but absent from the resume */
  missingSkills: string[];
  /** Sections of the resume that are weak relative to the job requirements */
  weakSections: GapWeakSection[];
  /** Actionable recommendations */
  recommendations: GapRecommendation[];
}

export interface GapWeakSection {
  /** Resume section ID (e.g., "summary", "experience", "skills") */
  sectionId: string;
  /** Specific field within the section */
  field: string;
  /** Why this section is weak */
  reason: string;
  /** How important this gap is */
  severity: "critical" | "major" | "medium" | "minor";
}

export type GapRecommendationType =
  | "add_skill"
  | "rewrite_bullet"
  | "rewrite_summary"
  | "reorder_skills";

export interface GapRecommendation {
  /** What kind of change is recommended */
  type: GapRecommendationType;
  /** Resume section this applies to */
  sectionId: string;
  /** Specific entry ID (for bullet rewrites) */
  entryId?: string;
  /** Why this change is recommended */
  reason: string;
}

/** Default safe values returned when gap analysis fails */
export function emptyGapAnalysis(): GapAnalysis {
  return {
    matchScore: 0,
    matchedSkills: [],
    missingSkills: [],
    weakSections: [],
    recommendations: [],
  };
}
