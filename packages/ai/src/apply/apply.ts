import type { ResumeDocument } from "@careerlaunch/domain";
import type { ApplyOperation, ApplyResult, AppliedChange } from "./types";
import {
  applyReplaceSummary,
  applyReplaceBullet,
  applyReplaceSkill,
  applyAddSkill,
  applyRemoveSkill,
} from "./operations/index";

/**
 * Apply a sequence of operations to a deep copy of the resume.
 *
 * Operations are applied in order, each receiving the result of the previous
 * one. If any operation throws (e.g. stale target), the original resume is
 * unchanged — callers should catch ApplyError and re-analyse the resume.
 *
 * @param resume — the resume to start from (never mutated)
 * @param operations — ordered list of operations to apply
 * @returns the final updated resume and a log of every change
 */
export function applyChanges(
  resume: ResumeDocument,
  operations: ApplyOperation[],
): ApplyResult {
  // Deep copy the resume via JSON roundtrip so we never touch the original.
  // This is safe for the ResumeDocument shape (no Dates, no Maps, no cycles).
  let current: ResumeDocument = JSON.parse(JSON.stringify(resume));
  const appliedChanges: AppliedChange[] = [];

  for (const op of operations) {
    let result: { updated: ResumeDocument; change: AppliedChange };

    switch (op.type) {
      case "replace_summary":
        result = applyReplaceSummary(current, op.summary);
        break;

      case "replace_bullet":
        result = applyReplaceBullet(current, op);
        break;

      case "replace_skill":
        result = applyReplaceSkill(current, op);
        break;

      case "add_skill":
        result = applyAddSkill(current, op);
        break;

      case "remove_skill":
        result = applyRemoveSkill(current, op);
        break;

      default: {
        const _exhaustive: never = op;
        throw new Error(`Unknown operation type: ${(_exhaustive as ApplyOperation).type}`);
      }
    }

    current = result.updated;
    appliedChanges.push(result.change);
  }

  return { updatedResume: current, appliedChanges };
}
