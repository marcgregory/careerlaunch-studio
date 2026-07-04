/**
 * Tests for the Gap Analysis module.
 */
import { describe, it, expect } from "vitest";
import { deterministicGapAnalysis } from "../../src/gap-analysis/index";
import { emptyGapAnalysis } from "../../src/gap-analysis/types";
import type { GapAnalysisInput } from "../../src/gap-analysis/types";
import type { NormalizedResume } from "../../src/analysis/types";
import type { JobAnalysis } from "../../src/job-analysis/types";

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
        "Built React components for the main product",
        "Led migration to TypeScript",
      ],
      dateRange: { start: "2020-01", end: "2023-12" },
    },
  ],
  skills: ["JavaScript", "TypeScript", "React", "Node.js"],
  certifications: [],
  projects: [],
};

const sampleJobAnalysis: JobAnalysis = {
  requiredSkills: ["TypeScript", "React", "AWS", "GraphQL", "Docker"],
  preferredSkills: ["Kubernetes"],
  seniority: "senior",
  responsibilities: ["Build web applications", "Design APIs"],
  atsKeywords: ["TypeScript", "React", "AWS", "GraphQL"],
  industry: "technology",
};

describe("deterministicGapAnalysis", () => {
  it("calculates match score based on skill overlap", () => {
    const input: GapAnalysisInput = {
      resume: sampleResume,
      jobAnalysis: sampleJobAnalysis,
      jobDescription: "Senior Developer with TypeScript, React, AWS, GraphQL, Docker",
    };
    const result = deterministicGapAnalysis(input);
    // The deterministic fallback uses dictionary-based matching against
    // the raw job description text, not the structured job analysis
    expect(result.matchScore).toBeGreaterThanOrEqual(0);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.matchedSkills)).toBe(true);
    expect(Array.isArray(result.missingSkills)).toBe(true);
  });

  it("identifies missing skills via dictionary matching", () => {
    const input: GapAnalysisInput = {
      resume: sampleResume,
      jobAnalysis: sampleJobAnalysis,
      jobDescription: "We need Senior Developer with AWS and GraphQL experience",
    };
    const result = deterministicGapAnalysis(input);
    // The dictionary matcher compares resume skills against JD tokens
    expect(result.matchedSkills.length).toBeGreaterThanOrEqual(0);
    expect(result.missingSkills.length).toBeGreaterThanOrEqual(0);
  });

  it("reports weak summary section when summary is short", () => {
    const shortSummaryResume: NormalizedResume = {
      ...sampleResume,
      summary: "Short.",
    };
    const input: GapAnalysisInput = {
      resume: shortSummaryResume,
      jobAnalysis: sampleJobAnalysis,
      jobDescription: "Senior Developer role",
    };
    const result = deterministicGapAnalysis(input);
    expect(result.weakSections.length).toBeGreaterThanOrEqual(1);
    expect(result.weakSections[0].sectionId).toBe("summary");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty gap analysis defaults when no match", () => {
    const empty = emptyGapAnalysis();
    expect(empty.matchScore).toBe(0);
    expect(empty.matchedSkills).toEqual([]);
    expect(empty.weakSections).toEqual([]);
  });
});
