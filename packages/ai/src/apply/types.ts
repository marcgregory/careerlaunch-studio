/**
 * Discriminated union of all safe apply operations.
 *
 * Each operation describes a single atomic mutation to a ResumeDocument.
 * Operations are validated before being applied; invalid targets throw ApplyError.
 */

export interface ReplaceSummaryOperation {
  type: "replace_summary";
  summary: string;
}

export interface ReplaceBulletOperation {
  type: "replace_bullet";
  /** ID of the experience, project, or education entry */
  entryId: string;
  /** 0-based index into the entry's bullets array */
  bulletIndex: number;
  /** Replacement text */
  text: string;
}

export interface ReplaceSkillOperation {
  type: "replace_skill";
  /** 0-based index into resume.skills */
  index: number;
  /** New skill name */
  skill: string;
}

export interface AddSkillOperation {
  type: "add_skill";
  /** Skill name to add */
  skill: string;
  /**
   * Optional insertion position. Must be 0..skills.length if provided.
   * Defaults to appending at the end.
   */
  index?: number;
}

export interface RemoveSkillOperation {
  type: "remove_skill";
  /** 0-based index into resume.skills */
  index: number;
}

/** All supported apply operations */
export type ApplyOperation =
  | ReplaceSummaryOperation
  | ReplaceBulletOperation
  | ReplaceSkillOperation
  | AddSkillOperation
  | RemoveSkillOperation;

/** A record of one applied change for audit / undo */
export interface AppliedChange {
  operation: ApplyOperation["type"];
  /** Human-readable path like "experience[exp-1].bullets[2]" */
  path: string;
  /** Value before the change (null for adds) */
  before: string | null;
  /** Value after the change (null for removes) */
  after: string | null;
}

export interface ApplyResult {
  updatedResume: import("@careerlaunch/domain").ResumeDocument;
  appliedChanges: AppliedChange[];
}

/**
 * Thrown when an apply operation targets a stale or missing resume element.
 * The caller is expected to catch this, discard the stale suggestions, and
 * re-analyse the current resume if needed.
 */
export class ApplyError extends Error {
  public readonly operation: ApplyOperation;
  public readonly reason: string;

  constructor(operation: ApplyOperation, reason: string) {
    super(`ApplyError: cannot ${operation.type} — ${reason}`);
    this.name = "ApplyError";
    this.operation = operation;
    this.reason = reason;
  }
}
