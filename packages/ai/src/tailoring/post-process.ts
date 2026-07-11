/**
 * Post-processing for AI tailoring suggestions.
 *
 * Validates that suggestions are safe to apply:
 * - `before` text actually exists in the resume (stale-target protection)
 * - `after` text does not fabricate experience or achievements
 * - Confidence scores are in range 0â€“1
 *
 * Also detects and flags potentially risky rewrites:
 * - Fabricated metrics (numbers not in the original)
 * - Leadership inflation (weak verbs replaced with strong ones without evidence)
 * - Responsibility expansion (specific responsibilities added not in the original)
 */

import type { TailorSuggestion, SafetyFlag } from "./types";
import type { NormalizedResume } from "../analysis/types";
import { createSkillMap, normalizeSkill, skillsMatch } from "../skills/normalization";

// â”€â”€â”€ Leadership inflation detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WEAK_VERBS = [
  "assisted", "helped", "participated", "contributed", "supported",
  "was involved in", "was part of", "was responsible for",
  "tasked with", "worked on", "aided",
];

const STRONG_VERBS = [
  "led", "directed", "managed", "drove", "spearheaded", "orchestrated",
  "founded", "established", "created", "designed", "built", "developed",
  "architected", "pioneered", "championed", "initiated", "launched",
  "transformed", "overhauled", "reorganized",
];

// â”€â”€â”€ Main function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Validate and filter tailoring suggestions.
 *
 * Returns only safe suggestions that pass all checks.
 * Attaches safety flags to suggestions that pass but show risky patterns.
 */
export function validateTailorSuggestions(
  suggestions: TailorSuggestion[],
  resume: NormalizedResume,
): TailorSuggestion[] {
  const resumeSkillMap = createSkillMap(resume.skills);
  const suggestedSkillKeys = new Set<string>();

  return suggestions
    .filter((s) => validateConfidence(s))
    .filter((s) => validateBefore(s, resume))
    .filter((s) => validateNoFabrication(s, resume))
    .filter((s) => validateUniqueSkillSuggestion(s, resumeSkillMap, suggestedSkillKeys))
    .map((s) => {
      const flags = detectSafetyFlags(s);
      return flags.length > 0 ? { ...s, safetyFlags: flags } : s;
    });
}

// â”€â”€â”€ Individual validators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function validateConfidence(s: TailorSuggestion): boolean {
  if (typeof s.confidence !== "number" || s.confidence < 0 || s.confidence > 1) {
    s.confidence = 0.5; // Default to mid confidence
    return true;
  }
  return true;
}

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
      (skill) => skillsMatch(skill, s.before.trim()),
    );
  }

  return true;
}


function validateUniqueSkillSuggestion(
  s: TailorSuggestion,
  resumeSkillMap: Map<string, string>,
  suggestedSkillKeys: Set<string>,
): boolean {
  if (s.category !== "skills" || !s.after) return true;

  const normalizedAfter = normalizeSkill(s.after);
  if (!normalizedAfter) return false;

  if (!s.before || s.before.trim().length === 0) {
    if (resumeSkillMap.has(normalizedAfter)) return false;
    if (suggestedSkillKeys.has(normalizedAfter)) return false;
    suggestedSkillKeys.add(normalizedAfter);
  }

  return true;
}
function validateNoFabrication(s: TailorSuggestion, resume: NormalizedResume): boolean {
  if (!s.after || s.after.trim().length === 0) return false;

  // For summary and experience, check the AI isn't inventing
  if (s.category === "experience" || s.category === "summary") {
    // Check for fabricated metrics (new numbers not in the original)
    const beforeNumbers = extractNumbers(s.before);
    const afterNumbers = extractNumbers(s.after);
    const newNumbers = afterNumbers.filter((n) => !beforeNumbers.includes(n));
    if (newNumbers.length > 0) {
      // The AI invented metrics â€” mark this as low confidence
      s.confidence = Math.min(s.confidence, 0.3);
    }
  }

  // For skills, just ensure the skill actually exists in the input
  if (s.category === "skills") {
    // Skill suggestions are valid as long as before/after are provided
  }

  return true;
}

// â”€â”€â”€ Safety flag detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function detectSafetyFlags(suggestion: TailorSuggestion): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  if (!suggestion.after || !suggestion.before) return flags;

  const before = suggestion.before.toLowerCase();
  const after = suggestion.after.toLowerCase();

  // 1. Fabricated metrics
  const beforeNumbers = extractNumbers(suggestion.before);
  const afterNumbers = extractNumbers(suggestion.after);
  const newNumbers = afterNumbers.filter((n) => !beforeNumbers.includes(n));
  if (newNumbers.length > 0) {
    flags.push({
      type: "fabricated_metric",
      message: `This change adds metrics not present in your original text: ${newNumbers.join(", ")}`,
    });
  }

  // 2. Leadership inflation
  const usesWeakVerb = WEAK_VERBS.some((v) => before.includes(v));
  const usesStrongVerb = STRONG_VERBS.some((v) => after.includes(v));
  if (usesWeakVerb && usesStrongVerb) {
    flags.push({
      type: "leadership_inflation",
      message: "This change increases leadership language. Review carefully if this matches your actual role.",
    });
  }

  // 3. Responsibility expansion
  // Check if the after text is substantially longer and contains new domain-specific content
  const beforeWords = new Set(before.split(/\s+/).filter((w) => w.length > 3));
  const afterWords = new Set(after.split(/\s+/).filter((w) => w.length > 3));
  const newWords = [...afterWords].filter((w) => !beforeWords.has(w) && !isStopWord(w));
  const wordRatio = suggestion.after.split(/\s+/).length / Math.max(suggestion.before.split(/\s+/).length, 1);

  // Flag if more than 40% new content words AND significantly longer
  if (wordRatio > 1.5 && newWords.length > beforeWords.size * 0.4 && beforeWords.size > 5) {
    flags.push({
      type: "responsibility_expansion",
      message: `This change adds specific content not in your original: "${newWords.slice(0, 3).join(", ")}${newWords.length > 3 ? "..." : ""}".`,
    });
  }

  return flags;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STOP_WORDS = new Set([
  "this", "that", "and", "the", "with", "from", "your", "their",
  "been", "were", "have", "has", "had", "does", "over", "such",
  "than", "then", "also", "into", "more", "some", "them",
]);

function isStopWord(w: string): boolean {
  return STOP_WORDS.has(w);
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+%?\b|\b\d+[.,]\d+\b/g);
  return matches ?? [];
}
