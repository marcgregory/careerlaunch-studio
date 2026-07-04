/**
 * AI Resume Tailoring — Phase 3 of the pipeline.
 *
 * Generates targeted rewrite suggestions for Professional Summary,
 * Experience bullets, and Skills section based on gap analysis results.
 *
 * Delegates to the AI provider if available, falls back to
 * skill-add-only suggestions.
 */

import type { TailoringInput, TailorSuggestion } from "./types";
import { emptyTailorResult } from "./types";
import { getProvider } from "../providers/index";
import { validateTailorSuggestions } from "./post-process";
import { suggestionId } from "../suggestion/types";

export type { TailoringInput, TailorSuggestion } from "./types";
export { validateTailorSuggestions } from "./post-process";

/**
 * Run AI resume tailoring — generate rewrite suggestions.
 *
 * Delegates to the configured AI provider if it supports `tailorResume`.
 * Falls back to deterministic skill-add suggestions.
 */
export async function runTailoring(
  input: TailoringInput,
  options?: { providerName?: string },
): Promise<TailorSuggestion[]> {
  // Try the AI provider first
  try {
    const provider = options?.providerName
      ? getProvider(options.providerName)
      : getProvider();

    if (provider.tailorResume) {
      try {
        const suggestions = await provider.tailorResume(input);
        return validateTailorSuggestions(suggestions, input.resume);
      } catch {
        // Fall through to deterministic
      }
    }
  } catch {
    // No provider registered — fall through to deterministic
  }

  return deterministicTailor(input);
}

/**
 * Deterministic fallback for resume tailoring.
 *
 * Generates only skill-add suggestions based on the gap analysis.
 * No summary or bullet rewrites in fallback mode.
 */
export function deterministicTailor(input: TailoringInput): TailorSuggestion[] {
  const suggestions: TailorSuggestion[] = [];
  const { resume, gapAnalysis } = input;

  // Add missing skills as add_skill suggestions
  for (let i = 0; i < gapAnalysis.missingSkills.length; i++) {
    const skill = gapAnalysis.missingSkills[i];
    suggestions.push({
      id: suggestionId("skills", `tailor-add-${i}`, "skills"),
      category: "skills",
      location: { sectionId: "skills" },
      before: "",
      after: skill,
      reason: `Add "${skill}" to better match the job requirements.`,
      confidence: 0.9,
      severity: "major",
    });
  }

  // Check if summary needs a rewrite
  if (!resume.summary || resume.summary.trim().length < 60) {
    suggestions.push({
      id: suggestionId("summary", "tailor-expand", "summary"),
      category: "summary",
      location: { sectionId: "summary" },
      before: resume.summary || "",
      after: resume.summary || "",
      reason: "Professional summary should highlight skills relevant to this role.",
      confidence: 0.5,
      severity: "medium",
    });
  }

  return suggestions;
}
