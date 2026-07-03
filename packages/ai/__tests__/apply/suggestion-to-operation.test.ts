import { describe, it, expect } from "vitest";
import { createOperations, suggestionToOperation } from "../../src/operations/factory.js";
import type { Suggestion } from "../../src/suggestion/types.js";

/** Minimal resume stub for createOperations tests */
const MINIMAL_RESUME = {
  contact: { fullName: "", email: "", phone: "", location: "", website: "" },
  summary: "",
  sections: [],
  skills: [],
  certifications: [],
  projects: [],
};

function makeSuggestion(overrides: Partial<Suggestion>): Suggestion {
  return {
    id: "test:sug:test-sug-1",
    category: "summary",
    severity: "major",
    title: "Test suggestion",
    reason: "This is a test suggestion for unit testing.",
    targetText: "Old text",
    suggestedText: "New improved text",
    confidence: 0.95,
    source: "ai",
    location: { sectionId: "summary" },
    ...overrides,
  };
}

// ─── Null / Missing suggestedText ─────────────────────────────────

describe("suggestionToOperation", () => {
  describe("null / empty suggestedText", () => {
    it("returns null when suggestedText is null", () => {
      expect(suggestionToOperation(makeSuggestion({ suggestedText: null }))).toBeNull();
    });

    it("returns null when suggestedText is empty string", () => {
      expect(suggestionToOperation(makeSuggestion({ suggestedText: "" }))).toBeNull();
    });
  });

  // ─── Summary ─────────────────────────────────────────────────────

  describe("summary category", () => {
    it("returns a replace_summary operation", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "summary",
          suggestedText: "A brand new professional summary.",
        }),
      );

      expect(result).toEqual([
        { type: "replace_summary", summary: "A brand new professional summary." },
      ]);
    });

    it("ignores entryId and field — summary is a top-level field", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "summary",
          location: { sectionId: "summary", entryId: "exp-1", field: "bullets[0]" },
          suggestedText: "New summary text.",
        }),
      );

      expect(result).toEqual([
        { type: "replace_summary", summary: "New summary text." },
      ]);
    });
  });

  // ─── Experience / Impact bullets ─────────────────────────────────

  describe("experience / impact bullets", () => {
    it("maps experience category with bullets[N] to replace_bullet", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "experience",
          location: { sectionId: "experience", entryId: "exp-1", field: "bullets[2]" },
          suggestedText: "Improved customer satisfaction by 25%.",
        }),
      );

      expect(result).toEqual([
        { type: "replace_bullet", entryId: "exp-1", bulletIndex: 2, text: "Improved customer satisfaction by 25%." },
      ]);
    });

    it("maps impact category with bullets[N] to replace_bullet", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "impact",
          location: { sectionId: "experience", entryId: "exp-1", field: "bullets[0]" },
          suggestedText: "Increased revenue by $500K.",
        }),
      );

      expect(result).toEqual([
        { type: "replace_bullet", entryId: "exp-1", bulletIndex: 0, text: "Increased revenue by $500K." },
      ]);
    });

    it("handles double-digit bullet indices", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "experience",
          location: { sectionId: "experience", entryId: "exp-2", field: "bullets[10]" },
          suggestedText: "Bullet ten.",
        }),
      );

      expect(result).toEqual([
        { type: "replace_bullet", entryId: "exp-2", bulletIndex: 10, text: "Bullet ten." },
      ]);
    });

    it("returns null when experience has no entryId", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "experience",
          location: { sectionId: "experience" },
          suggestedText: "Some text",
        }),
      );

      expect(result).toBeNull();
    });

    it("returns null when field does not match bullets[N] pattern", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "experience",
          location: { sectionId: "experience", entryId: "exp-1", field: "company" },
          suggestedText: "Some text",
        }),
      );

      expect(result).toBeNull();
    });
  });

  // ─── Skills ──────────────────────────────────────────────────────

  describe("skills category", () => {
    it("maps skills[N] field to replace_skill operation", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "skills",
          location: { sectionId: "skills", field: "skills[3]" },
          suggestedText: "Customer success management",
        }),
      );

      expect(result).toEqual([
        { type: "replace_skill", index: 3, skill: "Customer success management" },
      ]);
    });

    it("returns null when skills has only entryId (no field index)", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "skills",
          location: { sectionId: "skills", entryId: "some-skill" },
          suggestedText: "Replacement skill",
        }),
      );

      expect(result).toBeNull();
    });

    it("returns null for skills with no field at all", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "skills",
          location: { sectionId: "skills" },
          suggestedText: "New skill text",
        }),
      );

      expect(result).toBeNull();
    });
  });

  // ─── Unsupported categories ──────────────────────────────────────

  describe("unsupported categories return null", () => {
    const unsupported = [
      "education", "contact", "formatting", "ats", "grammar", "completeness", "keywords",
    ] as const;

    for (const cat of unsupported) {
      it(`returns null for ${cat}`, () => {
        const sug = makeSuggestion({ category: cat as Suggestion["category"], suggestedText: "Fix this." });
        expect(suggestionToOperation(sug)).toBeNull();
      });
    }
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("preserves suggested text with special characters", () => {
      const specialText = "Led $2M project — 40% under budget (Q3 FY24)";
      const result = suggestionToOperation(
        makeSuggestion({ category: "summary", suggestedText: specialText }),
      );

      expect(result).toEqual([{ type: "replace_summary", summary: specialText }]);
    });

    it("handles single-digit index at boundary (bulletIndex 0)", () => {
      const result = suggestionToOperation(
        makeSuggestion({
          category: "experience",
          location: { sectionId: "experience", entryId: "exp-1", field: "bullets[0]" },
          suggestedText:  "First bullet."
        }),
      );

      expect(result![0]).toMatchObject({ type: "replace_bullet", bulletIndex: 0 });
    });
  });

  // ─── createOperations: job-match → add_skill ─────────────────────

  describe("createOperations with job-match category", () => {
    it("maps job-match category to add_skill operation", () => {
      const result = createOperations(
        makeSuggestion({
          category: "job-match",
          location: { sectionId: "skills" },
          suggestedText: "React",
        }),
        MINIMAL_RESUME,
      );

      expect(result).toEqual([
        { type: "add_skill", skill: "React" },
      ]);
    });

    it("returns add_skill even when resume has an empty skills list", () => {
      const result = createOperations(
        makeSuggestion({
          category: "job-match",
          location: { sectionId: "skills" },
          suggestedText: "TypeScript",
        }),
        MINIMAL_RESUME,
      );

      expect(result).toEqual([
        { type: "add_skill", skill: "TypeScript" },
      ]);
    });

    it("returns add_skill with multi-word skill names", () => {
      const result = createOperations(
        makeSuggestion({
          category: "job-match",
          location: { sectionId: "skills" },
          suggestedText: "Machine Learning",
        }),
        MINIMAL_RESUME,
      );

      expect(result).toEqual([
        { type: "add_skill", skill: "Machine Learning" },
      ]);
    });

    it("returns null for job-match with null suggestedText", () => {
      const result = createOperations(
        makeSuggestion({
          category: "job-match",
          suggestedText: null,
        }),
        MINIMAL_RESUME,
      );

      expect(result).toBeNull();
    });
  });
});
