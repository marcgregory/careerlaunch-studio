import { describe, it, expect } from "vitest";
import { sampleResume } from "@careerlaunch/domain";
import { applyChanges, ApplyError } from "../../src/apply/index.js";
import type { ResumeDocument } from "@careerlaunch/domain";
import type {
  ApplyOperation,
} from "../../src/apply/index.js";

// ─── Helpers ───────────────────────────────────────────────────────

function cloneResume(r: ResumeDocument): ResumeDocument {
  return JSON.parse(JSON.stringify(r));
}

// ─── replace_summary ───────────────────────────────────────────────

describe("replace_summary", () => {
  it("replaces the summary and records the change", () => {
    const original = cloneResume(sampleResume);
    const newSummary = "A completely new summary with relevant keywords.";

    const { updatedResume, appliedChanges } = applyChanges(original, [
      { type: "replace_summary", summary: newSummary },
    ]);

    expect(updatedResume.summary).toBe(newSummary);
    expect(appliedChanges).toHaveLength(1);
    expect(appliedChanges[0]).toEqual({
      operation: "replace_summary",
      path: "summary",
      before: sampleResume.summary,
      after: newSummary,
    });
  });

  it("accepts an empty summary", () => {
    const original = cloneResume(sampleResume);
    const { updatedResume } = applyChanges(original, [
      { type: "replace_summary", summary: "" },
    ]);

    expect(updatedResume.summary).toBe("");
  });
});

// ─── replace_bullet ────────────────────────────────────────────────

describe("replace_bullet", () => {
  it("replaces a bullet in an experience entry", () => {
    const original = cloneResume(sampleResume);
    const entryId = sampleResume.experience[0].id;
    const newText = "Completely rewritten bullet with metric.";

    const { updatedResume, appliedChanges } = applyChanges(original, [
      {
        type: "replace_bullet",
        entryId,
        bulletIndex: 0,
        text: newText,
      },
    ]);

    const updatedExp = updatedResume.experience.find((e) => e.id === entryId);
    expect(updatedExp?.bullets[0]).toBe(newText);

    expect(appliedChanges).toHaveLength(1);
    expect(appliedChanges[0]).toEqual({
      operation: "replace_bullet",
      path: `experience[${entryId}].bullets[0]`,
      before: sampleResume.experience[0].bullets[0],
      after: newText,
    });
  });

  it("replaces a bullet in a project entry", () => {
    const original = cloneResume(sampleResume);
    const entryId = sampleResume.projects[0].id;
    const newText = "Replaced project bullet.";

    const { updatedResume } = applyChanges(original, [
      {
        type: "replace_bullet",
        entryId,
        bulletIndex: 0,
        text: newText,
      },
    ]);

    const updatedProj = updatedResume.projects.find((p) => p.id === entryId);
    expect(updatedProj?.bullets[0]).toBe(newText);
  });

  it("does not mutate other entries when replacing a bullet", () => {
    const original = cloneResume(sampleResume);
    const entryId = sampleResume.experience[0].id;

    const { updatedResume } = applyChanges(original, [
      {
        type: "replace_bullet",
        entryId,
        bulletIndex: 0,
        text: "Changed.",
      },
    ]);

    // Second experience entry unchanged
    expect(updatedResume.experience[1].bullets).toEqual(
      sampleResume.experience[1].bullets,
    );
    // Projects unchanged
    expect(updatedResume.projects).toEqual(sampleResume.projects);
  });
});

// ─── Stale target: replace_bullet ──────────────────────────────────

describe("stale target failure", () => {
  it("throws ApplyError when entryId is not found in experience or projects", () => {
    const original = cloneResume(sampleResume);

    const op: ApplyOperation = {
      type: "replace_bullet",
      entryId: "exp-stale",
      bulletIndex: 0,
      text: "Should not apply.",
    };

    expect(() => applyChanges(original, [op])).toThrow(ApplyError);
    expect(() => applyChanges(original, [op])).toThrow(
      'entryId "exp-stale" not found',
    );
  });

  it("does not change the resume when a stale target throws", () => {
    const original = cloneResume(sampleResume);
    const snapshot = JSON.stringify(original);

    const op: ApplyOperation = {
      type: "replace_bullet",
      entryId: "no-such-entry",
      bulletIndex: 0,
      text: "Should never appear.",
    };

    try {
      applyChanges(original, [op]);
    } catch {
      // expected
    }

    // Resume is unchanged
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("throws ApplyError when bulletIndex is out of range", () => {
    const original = cloneResume(sampleResume);
    const entryId = sampleResume.experience[0].id;

    const op: ApplyOperation = {
      type: "replace_bullet",
      entryId,
      bulletIndex: 999,
      text: "Out of bounds.",
    };

    expect(() => applyChanges(original, [op])).toThrow(ApplyError);
    expect(() => applyChanges(original, [op])).toThrow("bulletIndex 999 out of range");
  });

  it("throws ApplyError when bulletIndex is negative", () => {
    const original = cloneResume(sampleResume);
    const entryId = sampleResume.experience[0].id;

    expect(() =>
      applyChanges(original, [
        { type: "replace_bullet", entryId, bulletIndex: -1, text: "Neg." },
      ]),
    ).toThrow(ApplyError);
  });
});

// ─── replace_skill ─────────────────────────────────────────────────

describe("replace_skill", () => {
  it("replaces a skill at a valid index", () => {
    const original = cloneResume(sampleResume);
    const newSkill = "Customer success management";

    const { updatedResume, appliedChanges } = applyChanges(original, [
      { type: "replace_skill", index: 0, skill: newSkill },
    ]);

    expect(updatedResume.skills[0]).toBe(newSkill);
    expect(updatedResume.skills).toHaveLength(sampleResume.skills.length);
    expect(appliedChanges[0]).toEqual({
      operation: "replace_skill",
      path: "skills[0]",
      before: sampleResume.skills[0],
      after: newSkill,
    });
  });

  it("throws ApplyError when index is out of range", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "replace_skill", index: 999, skill: "Nope" },
      ]),
    ).toThrow(ApplyError);
  });

  it("throws ApplyError when index is negative", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "replace_skill", index: -1, skill: "Nope" },
      ]),
    ).toThrow(ApplyError);
  });
});

// ─── add_skill ─────────────────────────────────────────────────────

describe("add_skill", () => {
  it("appends a skill when no index is given", () => {
    const original = cloneResume(sampleResume);
    const newSkill = "Public speaking";

    const { updatedResume, appliedChanges } = applyChanges(original, [
      { type: "add_skill", skill: newSkill },
    ]);

    expect(updatedResume.skills).toHaveLength(sampleResume.skills.length + 1);
    expect(updatedResume.skills[updatedResume.skills.length - 1]).toBe(newSkill);
    expect(appliedChanges[0]).toEqual({
      operation: "add_skill",
      path: `skills[${sampleResume.skills.length}]`,
      before: null,
      after: newSkill,
    });
  });

  it("inserts a skill at a specified index", () => {
    const original = cloneResume(sampleResume);
    const newSkill = "Public speaking";

    const { updatedResume } = applyChanges(original, [
      { type: "add_skill", skill: newSkill, index: 2 },
    ]);

    expect(updatedResume.skills).toHaveLength(sampleResume.skills.length + 1);
    expect(updatedResume.skills[2]).toBe(newSkill);
    // Elements after index shifted
    expect(updatedResume.skills[3]).toBe(sampleResume.skills[2]);
  });

  it("inserts at the beginning when index is 0", () => {
    const original = cloneResume(sampleResume);
    const newSkill = "Leadership";

    const { updatedResume } = applyChanges(original, [
      { type: "add_skill", skill: newSkill, index: 0 },
    ]);

    expect(updatedResume.skills[0]).toBe(newSkill);
    expect(updatedResume.skills[1]).toBe(sampleResume.skills[0]);
  });

  it("inserts at the end when index equals length", () => {
    const original = cloneResume(sampleResume);
    const len = original.skills.length;
    const newSkill = "Networking";

    const { updatedResume } = applyChanges(original, [
      { type: "add_skill", skill: newSkill, index: len },
    ]);

    expect(updatedResume.skills[updatedResume.skills.length - 1]).toBe(newSkill);
  });

  it("throws ApplyError when index exceeds skills.length", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "add_skill", skill: "Nope", index: 999 },
      ]),
    ).toThrow(ApplyError);
  });

  it("throws ApplyError when index is negative", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "add_skill", skill: "Nope", index: -1 },
      ]),
    ).toThrow(ApplyError);
  });
});

// ─── remove_skill ──────────────────────────────────────────────────

describe("remove_skill", () => {
  it("removes a skill at a valid index", () => {
    const original = cloneResume(sampleResume);
    const removedSkill = sampleResume.skills[0];
    const skillsAfter = sampleResume.skills.slice(1);

    const { updatedResume, appliedChanges } = applyChanges(original, [
      { type: "remove_skill", index: 0 },
    ]);

    expect(updatedResume.skills).toEqual(skillsAfter);
    expect(appliedChanges[0]).toEqual({
      operation: "remove_skill",
      path: "skills[0]",
      before: removedSkill,
      after: null,
    });
  });

  it("throws ApplyError when index is out of range", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "remove_skill", index: 999 },
      ]),
    ).toThrow(ApplyError);
  });

  it("throws ApplyError when index is negative", () => {
    const original = cloneResume(sampleResume);

    expect(() =>
      applyChanges(original, [
        { type: "remove_skill", index: -1 },
      ]),
    ).toThrow(ApplyError);
  });
});

// ─── Immutability ──────────────────────────────────────────────────

describe("immutability", () => {
  it("does not mutate the original resume after replace_summary", () => {
    const original = cloneResume(sampleResume);
    const snapshot = JSON.stringify(original);

    applyChanges(original, [
      { type: "replace_summary", summary: "Brand new summary." },
    ]);

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("does not mutate the original resume after any skill operation", () => {
    const original = cloneResume(sampleResume);
    const snapshot = JSON.stringify(original);

    applyChanges(original, [
      { type: "replace_skill", index: 0, skill: "X" },
      { type: "add_skill", skill: "Y" },
      { type: "remove_skill", index: 1 },
    ]);

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("deep copies nested arrays", () => {
    const original = cloneResume(sampleResume);
    const originalBullets = original.experience[0].bullets;

    applyChanges(original, [
      {
        type: "replace_bullet",
        entryId: original.experience[0].id,
        bulletIndex: 0,
        text: "Modified.",
      },
    ]);

    // Original bullets array should still be intact
    expect(original.experience[0].bullets).toEqual(originalBullets);
  });
});

// ─── Multi-operation composition ───────────────────────────────────

describe("multi-operation composition", () => {
  it("applies multiple operations in order", () => {
    const original = cloneResume(sampleResume);
    const newSummary = "Multi-op summary.";
    const newBullet = "Multi-op bullet replacement.";
    const entryId = sampleResume.experience[0].id;

    const { updatedResume, appliedChanges } = applyChanges(original, [
      { type: "replace_summary", summary: newSummary },
      {
        type: "replace_bullet",
        entryId,
        bulletIndex: 1,
        text: newBullet,
      },
    ]);

    expect(updatedResume.summary).toBe(newSummary);
    expect(
      updatedResume.experience.find((e) => e.id === entryId)!.bullets[1],
    ).toBe(newBullet);
    expect(appliedChanges).toHaveLength(2);
  });

  it("each operation sees the result of the previous one", () => {
    const original = cloneResume(sampleResume);
    const skillName = "Leadership";

    const { updatedResume } = applyChanges(original, [
      { type: "add_skill", skill: skillName }, // appends
      { type: "remove_skill", index: 0 }, // removes first, which is NOT skillName
    ]);

    // The first original skill should be gone, and skillName should be last
    expect(updatedResume.skills).not.toContain(sampleResume.skills[0]);
    expect(updatedResume.skills).toContain(skillName);
    expect(updatedResume.skills[updatedResume.skills.length - 1]).toBe(skillName);
  });

  it("stops on first failure and does not apply subsequent operations", () => {
    const original = cloneResume(sampleResume);
    const newSummary = "Should not be applied.";

    expect(() =>
      applyChanges(original, [
        {
          type: "replace_bullet",
          entryId: "missing-entry",
          bulletIndex: 0,
          text: "Fails.",
        },
        { type: "replace_summary", summary: newSummary },
      ]),
    ).toThrow(ApplyError);

    // Summary should be unchanged
    expect(original.summary).toBe(sampleResume.summary);
  });
});
