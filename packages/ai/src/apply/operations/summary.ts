import type { ResumeDocument } from "@careerlaunch/domain";
import type { AppliedChange } from "../types";

/**
 * Apply a replace_summary operation.
 *
 * Returns the new summary value and a change record. Does not mutate the
 * original resume — the caller owns the shallow copy.
 */
export function applyReplaceSummary(
  resume: ResumeDocument,
  summary: string,
): { updated: ResumeDocument; change: AppliedChange } {
  const before = resume.summary;

  const updated: ResumeDocument = {
    ...resume,
    summary,
  };

  return {
    updated,
    change: {
      operation: "replace_summary",
      path: "summary",
      before,
      after: summary,
    },
  };
}
