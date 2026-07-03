import type { Suggestion } from "@careerlaunch/ai";
import type { ApplyOperation } from "@careerlaunch/ai";

/**
 * Convert a single Suggestion into one or more ApplyOperations.
 *
 * Returns null if the suggestion cannot be mapped to a known safe operation.
 * The caller can then skip the suggestion (keep it pending) rather than
 * sending an invalid payload to the API.
 */
export function suggestionToOperation(
  suggestion: Suggestion,
): ApplyOperation[] | null {
  if (!suggestion.suggestedText) return null;

  const { category, location, suggestedText } = suggestion;
  const { sectionId, entryId, field } = location;

  // ── Summary ────────────────────────────────────────────────────
  if (category === "summary") {
    return [{ type: "replace_summary", summary: suggestedText }];
  }

  // ── Experience / Project bullets ───────────────────────────────
  if (
    (category === "experience" || category === "impact") &&
    entryId &&
    field &&
    /^bullets\[(\d+)\]$/.test(field)
  ) {
    const bulletIndex = parseInt(field.match(/^bullets\[(\d+)\]$/)![1], 10);
    return [
      {
        type: "replace_bullet",
        entryId,
        bulletIndex,
        text: suggestedText,
      },
    ];
  }

  // ── Skills ─────────────────────────────────────────────────────
  if (category === "skills" && entryId) {
    // entryId acts as the skill string; use replace_skill
    // We don't have the index here — only the skill text.
    // This case requires the caller to provide index context.
    return null;
  }

  if (category === "skills" && field && /^skills\[(\d+)\]$/.test(field)) {
    const index = parseInt(field.match(/^skills\[(\d+)\]$/)![1], 10);
    return [{ type: "replace_skill", index, skill: suggestedText }];
  }

  // ── Education (no safe operation currently) ────────────────────
  // ── Contact (no safe operation currently) ──────────────────────
  // ── ATS / Grammar / Formatting / Completeness (no safe op) ─────

  return null;
}
