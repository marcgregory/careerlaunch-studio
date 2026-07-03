import type { ResumeDocument } from "@careerlaunch/domain";
import type { AppliedChange, ApplyOperation } from "../types";
import { ApplyError } from "../types";

/**
 * Apply a replace_skill operation.
 * Validates that index is within 0..skills.length-1.
 */
export function applyReplaceSkill(
  resume: ResumeDocument,
  op: ApplyOperation & { type: "replace_skill" },
): { updated: ResumeDocument; change: AppliedChange } {
  const { index, skill } = op;

  if (index < 0 || index >= resume.skills.length) {
    throw new ApplyError(
      op,
      `index ${index} out of range for skills (0..${resume.skills.length - 1})`,
    );
  }

  const before = resume.skills[index];
  const newSkills = [...resume.skills];
  newSkills[index] = skill;

  return {
    updated: { ...resume, skills: newSkills },
    change: {
      operation: "replace_skill",
      path: `skills[${index}]`,
      before,
      after: skill,
    },
  };
}

/**
 * Apply an add_skill operation.
 * If index is provided, inserts at that position (must be 0..skills.length).
 * If omitted, appends to the end.
 */
export function applyAddSkill(
  resume: ResumeDocument,
  op: ApplyOperation & { type: "add_skill" },
): { updated: ResumeDocument; change: AppliedChange } {
  const { skill, index } = op;

  const len = resume.skills.length;

  if (index !== undefined && (index < 0 || index > len)) {
    throw new ApplyError(
      op,
      `index ${index} out of range for skills insertion (0..${len})`,
    );
  }

  const insertAt = index ?? len;
  const newSkills = [...resume.skills];
  newSkills.splice(insertAt, 0, skill);

  return {
    updated: { ...resume, skills: newSkills },
    change: {
      operation: "add_skill",
      path: `skills[${insertAt}]`,
      before: null,
      after: skill,
    },
  };
}

/**
 * Apply a remove_skill operation.
 * Validates that index is within 0..skills.length-1.
 */
export function applyRemoveSkill(
  resume: ResumeDocument,
  op: ApplyOperation & { type: "remove_skill" },
): { updated: ResumeDocument; change: AppliedChange } {
  const { index } = op;

  if (index < 0 || index >= resume.skills.length) {
    throw new ApplyError(
      op,
      `index ${index} out of range for skills removal (0..${resume.skills.length - 1})`,
    );
  }

  const before = resume.skills[index];
  const newSkills = [...resume.skills];
  newSkills.splice(index, 1);

  return {
    updated: { ...resume, skills: newSkills },
    change: {
      operation: "remove_skill",
      path: `skills[${index}]`,
      before,
      after: null,
    },
  };
}
