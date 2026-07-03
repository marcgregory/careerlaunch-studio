import { describe, it, expect } from "vitest";
import { analyzeKeywords } from "../../src/job-match/keywords";
import { normalizeJobDescription } from "../../src/job-match/normalize-job";
import type { NormalizedResume } from "../../src/analysis/types";

const SAMPLE_RESUME: NormalizedResume = {
  contact: {
    fullName: "Jane Smith",
    email: "jane@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    website: "",
  },
  summary: "Full-stack engineer with experience building web applications.",
  sections: [
    {
      id: "exp-1",
      type: "experience",
      role: "Senior Developer",
      company: "Acme Corp",
      bullets: ["Built scalable web applications with React and Node.js."],
      dateRange: { start: "2020", end: "2023" },
    },
  ],
  skills: ["React", "Node.js", "TypeScript", "Python"],
  certifications: [],
  projects: [],
};

describe("analyzeKeywords", () => {
  it("returns total tokens from the job description", () => {
    const job = normalizeJobDescription("Looking for a React developer");
    const result = analyzeKeywords(SAMPLE_RESUME, job);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("finds overlapping tokens between resume and JD", () => {
    const job = normalizeJobDescription("Need React experience");
    const result = analyzeKeywords(SAMPLE_RESUME, job);
    expect(result.overlapTokens).toContain("react");
  });

  it("computes overlap ratio", () => {
    const job = normalizeJobDescription("React TypeScript Python Docker");
    const result = analyzeKeywords(SAMPLE_RESUME, job);
    // 3 of 4 tokens overlap
    expect(result.overlapRatio).toBeGreaterThanOrEqual(0.5);
  });

  it("returns zero overlap for completely different content", () => {
    const job = normalizeJobDescription("Marketing campaign management social media strategy");
    const result = analyzeKeywords(SAMPLE_RESUME, job);
    expect(result.overlapRatio).toBe(0);
  });
});
