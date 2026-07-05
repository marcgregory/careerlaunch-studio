import type { ResumeDocument } from "@careerlaunch/domain";

export interface CoverLetterInput {
  resume: ResumeDocument;
  jobDescription?: string;
}

export interface GeneratedCoverLetter {
  body: string;
  salutation?: string;
  closing?: string;
}

/**
 * Curated context extracted from a resume for cover letter generation.
 *
 * The LLM receives this instead of the full raw resume dump. This prevents:
 * - Raw skills sections being dumped into the prompt
 * - Date strings parsed as job titles
 * - Repetition of the same technology list across paragraphs
 * - Weak job-description relevance
 */
export interface CoverLetterContext {
  /** Target role from the resume, or derived from experience */
  targetRole: string;
  /** Estimated years of professional experience */
  yearsExperience?: number;
  /** Current or most recent job title (safe — not a date string) */
  currentTitle: string;
  /** Current or most recent employer name */
  currentEmployer?: string;
  /** Top skills most relevant to the job description (max 5) */
  topRelevantSkills: string[];
  /** Projects with the most detail (max 2) */
  relevantProjects: Array<{
    name: string;
    description: string;
    bullets: string[];
  }>;
  /** Best achievement bullets across all experience (max 3) */
  bestAchievements: string[];
  /** Most recent education entry */
  education?: {
    school: string;
    degree: string;
    graduation: string;
  };
  /** Certifications (max 2) */
  certifications: string[];
}
