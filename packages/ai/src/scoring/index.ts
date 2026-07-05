import type { Suggestion, SuggestionSeverity } from "../suggestion/types";
import type { NormalizedResume } from "../analysis/types";

/**
 * Weights for computing overall score from suggestion severity counts.
 *
 * A "perfect" resume (no suggestions of any type) scores 100.
 * Each suggestion reduces the score based on its severity.
 */
const SEVERITY_PENALTIES: Record<SuggestionSeverity, number> = {
  critical: 15,
  major: 8,
  medium: 5,
  minor: 2,
  info: 0,
};

const MAX_POINTS = 100;

/**
 * Compute an overall resume health score (0–100) based on the suggestion set
 * and basic resume characteristics.
 */
export function computeOverallScore(
  suggestions: Suggestion[],
  resume: NormalizedResume,
): number {
  // Penalty from suggestions
  const penalty = suggestions.reduce((total, s) => {
    return total + SEVERITY_PENALTIES[s.severity];
  }, 0);

  // Base score, floored at 30 (every resume gets at least 30)
  const baseScore = Math.max(30, MAX_POINTS - penalty);

  // Round to integer
  return Math.round(baseScore);
}

/**
 * Break down the score by category for the Health Dashboard.
 */
export function computeCategoryScores(
  suggestions: Suggestion[],
  resume: NormalizedResume,
): Record<string, number> {
  const categories = [
    "summary",
    "experience",
    "skills",
    "contact",
    "impact",
    "grammar",
    "ats",
    "keywords",
    "completeness",
  ];

  const scores: Record<string, number> = {};

  for (const cat of categories) {
    const catSuggestions = suggestions.filter((s) => s.category === cat);
    const penalty = catSuggestions.reduce(
      (total, s) => total + SEVERITY_PENALTIES[s.severity],
      0,
    );
    scores[cat] = Math.max(30, MAX_POINTS - penalty);
  }

  return scores;
}
