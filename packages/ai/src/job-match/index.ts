import type { NormalizedResume } from "../analysis/types";
import { normalizeJobDescription } from "./normalize-job";
import { compare } from "./compare";
import { analyzeKeywords } from "./keywords";
import { computeMatchScore } from "./score";
import type { JobMatchResult, JobMatchInput } from "./types";
import { getProvider } from "../providers/index";

export type { JobMatchResult, JobMatchInput, NormalizedJob } from "./types";
export { normalizeJobDescription } from "./normalize-job";
export { compare } from "./compare";
export { analyzeKeywords } from "./keywords";
export { computeMatchScore } from "./score";

/**
 * Run the full job-match pipeline.
 *
 * Delegates to the configured AI provider if it supports `matchJob`.
 * Falls back to the deterministic, dictionary-based matcher.
 *
 * The result flows into the existing Review → Diff → Apply pipeline
 * via the returned Suggestion objects.
 */
export async function runJobMatch(
  input: JobMatchInput,
  options?: { providerName?: string },
): Promise<JobMatchResult> {
  // Try the AI provider first (gracefully handles no provider registered)
  try {
    const provider = options?.providerName ? getProvider(options.providerName) : getProvider();

    if (provider.matchJob) {
      try {
        return await provider.matchJob(input.resume, input.jobDescription);
      } catch {
        // Fall through to deterministic matcher on error
      }
    }
  } catch {
    // No provider registered — fall through to deterministic
  }

  // Fallback to dictionary-based matching
  return deterministicRunJobMatch(input);
}

/**
 * Deterministic, dictionary-based job match engine.
 *
 * Uses tokenizer and skill dictionary for comparison.
 * Zero AI calls — used as a fallback when no AI provider supports matchJob.
 * This is the original implementation, preserved for fallback and testing.
 */
export function deterministicRunJobMatch(input: JobMatchInput): JobMatchResult {
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
