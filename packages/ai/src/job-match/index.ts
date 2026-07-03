import type { NormalizedResume } from "../analysis/types";
import { normalizeJobDescription } from "./normalize-job";
import { compare } from "./compare";
import { analyzeKeywords } from "./keywords";
import { computeMatchScore } from "./score";
import type { JobMatchResult, JobMatchInput } from "./types";

export type { JobMatchResult, JobMatchInput, NormalizedJob } from "./types";
export { normalizeJobDescription } from "./normalize-job";
export { compare } from "./compare";
export { analyzeKeywords } from "./keywords";
export { computeMatchScore } from "./score";

/**
 * Run the full job-match pipeline.
 *
 * Steps:
 * 1. Normalize the job description text → structured tokens + skill list
 * 2. Compare the resume to the job's required skills
 * 3. Compute a match score
 * 4. Return the score, skill lists, and actionable suggestions
 *
 * The result flows into the existing Review → Diff → Apply pipeline
 * via the returned Suggestion objects.
 */
export function runJobMatch(input: JobMatchInput): JobMatchResult {
  const { resume, jobDescription } = input;

  // Step 1: Normalize
  const normalizedJob = normalizeJobDescription(jobDescription);

  // Step 2: Compare
  const comparison = compare(resume, normalizedJob);

  // Step 3: Score
  const matchScore = computeMatchScore(
    comparison.presentSkills,
    comparison.missingSkills,
  );

  // Analyze keyword overlap (metadata for future UI enrichment)
  const kw = analyzeKeywords(resume, normalizedJob);

  return {
    matchScore,
    missingSkills: comparison.missingSkills,
    presentSkills: comparison.presentSkills,
    suggestions: comparison.suggestions,
  };

  // `kw` is available for future dashboard enrichment (keyword overlap display)
}
