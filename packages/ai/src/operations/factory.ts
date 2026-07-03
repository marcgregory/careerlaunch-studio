import type { Suggestion } from "../suggestion/types";
import type { ApplyOperation } from "../apply/types";
import type { NormalizedResume } from "../analysis/types";

/**
 * Convert a single Suggestion into one or more ApplyOperations.
 *
 * This is the single canonical mapping from AI suggestions to domain
 * operations. Every caller (web, API, future providers) must use this
 * factory rather than re-implementing the mapping logic.
 *
 * The `resume` parameter provides context for operations that need to know
 * the current state of the resume (e.g. add_skill needs the skills array
 * to determine insertion position).
 *
 * Returns null if the suggestion cannot be mapped to a known safe operation.
 * The caller can then skip the suggestion (keep it pending) rather than
 * sending an invalid payload to the apply engine.
 */
export function createOperations(
  suggestion: Suggestion,
  resume: NormalizedResume,
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

  // ── Skills — replace ──────────────────────────────────────────
  if (category === "skills" && field && /^skills\[(\d+)\]$/.test(field)) {
    const index = parseInt(field.match(/^skills\[(\d+)\]$/)![1], 10);
    return [{ type: "replace_skill", index, skill: suggestedText }];
  }

  // entryId-only skills are not supported (need index context)
  if (category === "skills" && entryId && !field) {
    return null;
  }

  // ── Skills — add (job-match suggestions) ──────────────────────
  if (category === "job-match") {
    // job-match suggestions add missing skills to the resume
    return [{ type: "add_skill", skill: suggestedText }];
  }

  // ── Future operation types will be added here ───────────────────
  // - keyword_injection   → add/replace skills
  // - rewrite_experience  → replace multiple bullets
  // - normalize_dates     → update date ranges

  return null;
}

/**
 * @deprecated Use `createOperations(suggestion, resume)` instead.
 * Kept for backwards compatibility — delegates to createOperations
 * with a dummy empty resume.
 */
export function suggestionToOperation(
  suggestion: Suggestion,
): ApplyOperation[] | null {
  const emptyResume: NormalizedResume = {
    contact: { fullName: "", email: "", phone: "", location: "", website: "" },
    summary: "",
    sections: [],
    skills: [],
    certifications: [],
    projects: [],
  };
  return createOperations(suggestion, emptyResume);
}
