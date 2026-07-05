import { describe, it, expect } from "vitest";
import { computeOverallScore, computeCategoryScores } from "../../src/scoring/index.js";
import type { Suggestion } from "../../src/suggestion/types.js";

const makeSuggestion = (overrides: Partial<Suggestion>): Suggestion => ({
  id: "test-1",
  category: "experience",
  severity: "medium",
  title: "Test suggestion",
  reason: "Testing",
  targetText: null,
  suggestedText: null,
  location: { sectionId: "experience" },
  confidence: 1,
  source: "static",
  ...overrides,
});

const minimalResume = {
  contact: { fullName: "A", email: "a@b.com", phone: "555", location: "NYC", website: "" },
  summary: "Test.",
  sections: [],
  skills: ["A", "B"],
  certifications: [],
  projects: [],
};

describe("computeOverallScore", () => {
  it("returns 100 for no suggestions", () => {
    const score = computeOverallScore([], minimalResume);
    expect(score).toBe(100);
  });

  it("reduces score for critical suggestions", () => {
    const suggestions = [makeSuggestion({ severity: "critical" })];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(85); // 100 - 15
  });

  it("reduces score for major suggestions", () => {
    const suggestions = [makeSuggestion({ severity: "major" })];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(92); // 100 - 8
  });

  it("reduces score for medium suggestions", () => {
    const suggestions = [makeSuggestion({ severity: "medium" })];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(95); // 100 - 5
  });

  it("reduces score for minor suggestions", () => {
    const suggestions = [makeSuggestion({ severity: "minor" })];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(98); // 100 - 2
  });

  it("info suggestions do not affect score", () => {
    const suggestions = [makeSuggestion({ severity: "info" })];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(100);
  });

  it("handles mixed severities", () => {
    const suggestions = [
      makeSuggestion({ severity: "critical" }),
      makeSuggestion({ severity: "major", id: "test-2" }),
      makeSuggestion({ severity: "medium", id: "test-3" }),
    ];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(72); // 100 - 15 - 8 - 5
  });

  it("handles many minor suggestions gracefully", () => {
    const suggestions = [
      makeSuggestion({ severity: "minor", id: "t1" }),
      makeSuggestion({ severity: "minor", id: "t2" }),
      makeSuggestion({ severity: "minor", id: "t3" }),
      makeSuggestion({ severity: "info", id: "t4" }),
      makeSuggestion({ severity: "info", id: "t5" }),
    ];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(94); // 100 - 3*2 - 2*0
  });

  it("floors at 30", () => {
    const suggestions = [
      makeSuggestion({ severity: "critical", id: "t1" }),
      makeSuggestion({ severity: "critical", id: "t2" }),
      makeSuggestion({ severity: "critical", id: "t3" }),
      makeSuggestion({ severity: "critical", id: "t4" }),
      makeSuggestion({ severity: "critical", id: "t5" }),
      makeSuggestion({ severity: "critical", id: "t6" }),
    ];
    const score = computeOverallScore(suggestions, minimalResume);
    expect(score).toBe(30); // floor at 30
  });
});

describe("computeCategoryScores", () => {
  it("returns all expected categories", () => {
    const scores = computeCategoryScores([], minimalResume);
    const expectedCats = ["summary", "experience", "skills", "contact", "impact", "grammar", "ats", "keywords", "completeness"];
    for (const cat of expectedCats) {
      expect(scores).toHaveProperty(cat);
    }
    expect(Object.keys(scores)).toHaveLength(expectedCats.length);
  });

  it("computes category-specific scores", () => {
    const suggestions = [
      makeSuggestion({ category: "experience", severity: "critical" }),
      makeSuggestion({ category: "summary", severity: "major", id: "t2" }),
    ];
    const scores = computeCategoryScores(suggestions, minimalResume);
    expect(scores.experience).toBe(85); // 100 - 15
    expect(scores.summary).toBe(92); // 100 - 8
    expect(scores.skills).toBe(100); // no suggestions
  });
});
