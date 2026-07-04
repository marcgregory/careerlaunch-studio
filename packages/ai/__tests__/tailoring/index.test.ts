/**
 * Tests for the Tailoring and Post-Process modules.
 */
import { describe, it, expect } from "vitest";
import { deterministicTailor } from "../../src/tailoring/index";
import { validateTailorSuggestions } from "../../src/tailoring/post-process";
import type { TailoringInput, TailorSuggestion } from "../../src/tailoring/types";
import type { NormalizedResume } from "../../src/analysis/types";
import type { JobAnalysis } from "../../src/job-analysis/types";
import type { GapAnalysis } from "../../src/gap-analysis/types";

const sampleResume: NormalizedResume = {
  contact: {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "555-0100",
    location: "New York",
    website: "",
  },
  summary: "Experienced software engineer with 5 years in full-stack development.",
  sections: [
    {
      id: "exp-1",
      type: "experience",
      role: "Software Engineer",
      company: "Tech Co",
      bullets: [
        "Built React components for the main product using TypeScript",
      ],
      dateRange: { start: "2020-01", end: "2023-12" },
    },
  ],
  skills: ["JavaScript", "TypeScript", "React", "Node.js"],
  certifications: [],
  projects: [],
};

const sampleJobAnalysis: JobAnalysis = {
  requiredSkills: ["TypeScript", "React", "AWS", "GraphQL"],
  preferredSkills: ["Docker"],
  seniority: "senior",
  responsibilities: ["Build web applications"],
  atsKeywords: ["TypeScript", "React", "AWS"],
  industry: "technology",
};

const sampleGapAnalysis: GapAnalysis = {
  matchScore: 50,
  matchedSkills: ["TypeScript", "React"],
  missingSkills: ["AWS", "GraphQL"],
  weakSections: [],
  recommendations: [
    { type: "add_skill", sectionId: "skills", reason: "Add AWS" },
    { type: "add_skill", sectionId: "skills", reason: "Add GraphQL" },
  ],
};

describe("deterministicTailor", () => {
  it("generates skill-add suggestions for missing skills", () => {
    const input: TailoringInput = {
      resume: sampleResume,
      jobAnalysis: sampleJobAnalysis,
      gapAnalysis: sampleGapAnalysis,
    };
    const result = deterministicTailor(input);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((s) => s.category === "skills")).toBe(true);
  });

  it("includes summary suggestion when summary is short", () => {
    const shortSummaryResume: NormalizedResume = {
      ...sampleResume,
      summary: "Short.",
    };
    const input: TailoringInput = {
      resume: shortSummaryResume,
      jobAnalysis: sampleJobAnalysis,
      gapAnalysis: { ...sampleGapAnalysis, matchScore: 30 },
    };
    const result = deterministicTailor(input);
    expect(result.some((s) => s.category === "summary")).toBe(true);
  });

  it("produces suggestions with required fields", () => {
    const input: TailoringInput = {
      resume: sampleResume,
      jobAnalysis: sampleJobAnalysis,
      gapAnalysis: sampleGapAnalysis,
    };
    const result = deterministicTailor(input);
    for (const s of result) {
      expect(s.id).toBeTruthy();
      expect(s.category).toMatch(/^(summary|experience|skills)$/);
      expect(typeof s.confidence).toBe("number");
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("validateTailorSuggestions", () => {
  it("passes valid suggestions through", () => {
    const suggestions: TailorSuggestion[] = [
      {
        id: "skills:add-0:skills",
        category: "skills",
        location: { sectionId: "skills" },
        before: "",
        after: "AWS",
        reason: "Add AWS to match requirements.",
        confidence: 0.9,
        severity: "major",
      },
    ];
    const result = validateTailorSuggestions(suggestions, sampleResume);
    expect(result.length).toBe(1);
    expect(result[0].confidence).toBe(0.9);
  });

  it("rejects suggestions with empty before text for summary", () => {
    const suggestions: TailorSuggestion[] = [
      {
        id: "summary:tailor:summary",
        category: "summary",
        location: { sectionId: "summary" },
        before: "",
        after: "New improved summary.",
        reason: "Update summary.",
        confidence: 0.8,
        severity: "medium",
      },
    ];
    const result = validateTailorSuggestions(suggestions, sampleResume);
    expect(result.length).toBe(0);
  });

  it("passes valid summary suggestions that match resume content", () => {
    const suggestions: TailorSuggestion[] = [
      {
        id: "summary:tailor:summary",
        category: "summary",
        location: { sectionId: "summary" },
        before: "Experienced software engineer with 5 years in full-stack development.",
        after: "Innovative software engineer with 5 years of full-stack expertise.",
        reason: "Improved impact language.",
        confidence: 0.8,
        severity: "medium",
      },
    ];
    const result = validateTailorSuggestions(suggestions, sampleResume);
    expect(result.length).toBe(1);
  });

  it("caps confidence when fabricated metrics are detected", () => {
    const suggestions: TailorSuggestion[] = [
      {
        id: "experience:rewrite:exp-1",
        category: "experience",
        location: {
          sectionId: "exp-1",
          entryId: "exp-1",
          field: "bullets[0]",
        },
        before: "Built React components for the main product using TypeScript",
        after: "Built React components for the main product using TypeScript, improving performance by 40%",
        reason: "Add impact metric.",
        confidence: 0.9,
        severity: "minor",
      },
    ];
    const result = validateTailorSuggestions(suggestions, sampleResume);
    expect(result.length).toBe(1);
    expect(result[0].confidence).toBeLessThanOrEqual(0.3);
  });
});
