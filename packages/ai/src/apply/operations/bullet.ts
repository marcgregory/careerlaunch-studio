import type { ResumeDocument } from "@careerlaunch/domain";
import type { AppliedChange, ApplyOperation } from "../types";
import { ApplyError } from "../types";

/**
 * Apply a replace_bullet operation.
 *
 * Searches for the entryId across experience and projects arrays.
 * Throws ApplyError if the entry is not found or bulletIndex is out of range.
 */
export function applyReplaceBullet(
  resume: ResumeDocument,
  op: ApplyOperation & { type: "replace_bullet" },
): { updated: ResumeDocument; change: AppliedChange } {
  const { entryId, bulletIndex, text } = op;

  // Try experience first
  const expIndex = resume.experience.findIndex((e) => e.id === entryId);
  if (expIndex !== -1) {
    const entry = resume.experience[expIndex];
    if (bulletIndex < 0 || bulletIndex >= entry.bullets.length) {
      throw new ApplyError(
        op,
        `bulletIndex ${bulletIndex} out of range for experience[${entryId}] (0..${entry.bullets.length - 1})`,
      );
    }

    const before = entry.bullets[bulletIndex];
    const newBullets = [...entry.bullets];
    newBullets[bulletIndex] = text;

    const newEntry = { ...entry, bullets: newBullets };
    const newExperience = [...resume.experience];
    newExperience[expIndex] = newEntry;

    return {
      updated: { ...resume, experience: newExperience },
      change: {
        operation: "replace_bullet",
        path: `experience[${entryId}].bullets[${bulletIndex}]`,
        before,
        after: text,
      },
    };
  }

  // Try projects next
  const projIndex = resume.projects.findIndex((p) => p.id === entryId);
  if (projIndex !== -1) {
    const entry = resume.projects[projIndex];
    if (bulletIndex < 0 || bulletIndex >= entry.bullets.length) {
      throw new ApplyError(
        op,
        `bulletIndex ${bulletIndex} out of range for projects[${entryId}] (0..${entry.bullets.length - 1})`,
      );
    }

    const before = entry.bullets[bulletIndex];
    const newBullets = [...entry.bullets];
    newBullets[bulletIndex] = text;

    const newEntry = { ...entry, bullets: newBullets };
    const newProjects = [...resume.projects];
    newProjects[projIndex] = newEntry;

    return {
      updated: { ...resume, projects: newProjects },
      change: {
        operation: "replace_bullet",
        path: `projects[${entryId}].bullets[${bulletIndex}]`,
        before,
        after: text,
      },
    };
  }

  // Not found anywhere
  throw new ApplyError(op, `entryId "${entryId}" not found in experience or projects`);
}
