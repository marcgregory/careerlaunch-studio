/**
 * Types for the AI Job Analysis module.
 *
 * Analyzes a raw job description to extract structured information
 * that feeds into the gap analysis and tailoring phases.
 */

export interface JobAnalysis {
  /** Skills the job explicitly requires (must-haves) */
  requiredSkills: string[];
  /** Skills the job prefers (nice-to-haves) */
  preferredSkills: string[];
  /** Inferred seniority level */
  seniority: "entry" | "mid" | "senior" | "lead" | "executive" | "unknown";
  /** Key responsibilities extracted from the JD */
  responsibilities: string[];
  /** Industry-specific ATS keywords and phrases */
  atsKeywords: string[];
  /** Inferred industry (null if not determinable) */
  industry: string | null;
}

export interface JobAnalysisInput {
  /** Raw job description text pasted by the user */
  jobDescription: string;
}

/** Default safe values returned when analysis fails */
export function emptyJobAnalysis(): JobAnalysis {
  return {
    requiredSkills: [],
    preferredSkills: [],
    seniority: "unknown",
    responsibilities: [],
    atsKeywords: [],
    industry: null,
  };
}
