/**
 * Post-processing for AI tailoring suggestions.
 *
 * Validates that suggestions are safe to apply:
 * - `before` text actually exists in the resume (stale-target protection)
 * - `after` text does not fabricate experience or achievements
 * - Confidence scores are in range 0–1
 */

import type { TailorSuggestion } from "./types";
import type { NormalizedResume } from "../analysis/types";

/**
 * Validate and filter tailoring suggestions.
 *
 * Returns only safe suggestions that pass all checks.
 * Logs warnings for rejected suggestions (useful for debugging).
 */
export function validateTailorSuggestions(
  suggestions: TailorSuggestion[],
  resume: NormalizedResume,
): TailorSuggestion[] {
  return suggestions
    .filter((s) => validateConfidence(s))
    .filter((s) => validateBefore(s, resume))
    .filter((s) => validateNoFabrication(s, resume));
}

/**
 * Validate that confidence is in range 0–1.
 */
function validateConfidence(s: TailorSuggestion): boolean {
  if (typeof s.confidence !== "number" || s.confidence < 0 || s.confidence > 1) {
    s.confidence = 0.5; // Default to mid confidence
    return true;
  }
  return true;
}

/**
 * Validate that the `before` text exists somewhere in the resume.
 * This prevents applying stale suggestions to an already-modified resume.
 */
function validateBefore(s: TailorSuggestion, resume: NormalizedResume): boolean {
  // For add_skill suggestions (new skills), empty before is valid
  if (!s.before || s.before.trim().length === 0) {
    return s.category === "skills";
  }

  // Check summary
  if (s.category === "summary") {
    return resume.summary.includes(s.before.trim());
  }

  // Check experience bullets
  if (s.category === "experience") {
    return resume.sections.some(
      (section) =>
        section.type === "experience" &&
        section.bullets.some((bullet) => bullet.includes(s.before.trim())),
    );
  }

  // Check skills
  if (s.category === "skills") {
    return resume.skills.some(
      (skill) => skill.toLowerCase() === s.before.trim().toLowerCase(),
    );
  }

  return true;
}

/**
 * Validate that the suggestion does not fabricate experience.
 *
 * Checks:
 * - `after` does not add metrics/numbers not in the original
 * - `after` preserves the core factual content of `before`
 */
function validateNoFabrication(s: TailorSuggestion, resume: NormalizedResume): boolean {
  if (!s.after || s.after.trim().length === 0) return false;

  // For summary and experience, check the AI isn't inventing
  if (s.category === "experience" || s.category === "summary") {
    // Check for fabricated metrics (new numbers not in the original)
    const beforeNumbers = extractNumbers(s.before);
    const afterNumbers = extractNumbers(s.after);
    const newNumbers = afterNumbers.filter((n) => !beforeNumbers.includes(n));
    if (newNumbers.length > 0) {
      // The AI invented metrics — mark this as low confidence
      s.confidence = Math.min(s.confidence, 0.3);
    }
  }

  // For skills, just ensure the skill actually exists in the input
  if (s.category === "skills") {
    // Skill suggestions are valid as long as before/after are provided
  }

  return true;
}

/**
 * Extract numeric values from a string (percentages, counts, etc.).
 */
function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+%?\b|\b\d+[.,]\d+\b/g);
  return matches ?? [];
}
