import type { Suggestion } from "../suggestion/types";

/** Input to the job-match engine */
export interface JobMatchInput {
  /** Normalized resume from the existing analysis pipeline */
  resume: import("../analysis/types").NormalizedResume;
  /** Raw job description text pasted by the user */
  jobDescription: string;
}

/** A normalized, tokenized job description */
export interface NormalizedJob {
  /** Lowercase tokens with punctuation stripped */
  tokens: string[];
  /** Skills extracted from the JD via dictionary matching */
  skills: string[];
  /** Experience-level indicators (years, seniority keywords) */
  experience: string[];
}

/** Result of comparing a resume to a job description */
export interface JobMatchResult {
  /** Match score 0–100, or null if no skills were extracted from the JD */
  matchScore: number | null;
  /** Skills in the JD that the resume is missing */
  missingSkills: string[];
  /** Skills in the JD that the resume already has */
  presentSkills: string[];
  /** Actionable suggestions for missing skills */
  suggestions: Suggestion[];
}
