import { describe, it, expect } from "vitest";
import { compare } from "../../src/job-match/compare";
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
      bullets: [
        "Built a CI/CD pipeline that reduced deployment time by 40%.",
        "Led migration from monolith to microservices architecture.",
      ],
      dateRange: { start: "2020", end: "2023" },
    },
  ],
  skills: ["TypeScript", "Python", "PostgreSQL"],
  certifications: ["AWS Certified Developer"],
  projects: [],
};

describe("compare", () => {
  it("identifies present skills from the resume skills list", () => {
    const job = normalizeJobDescription("Need TypeScript and Python");
    const result = compare(SAMPLE_RESUME, job);
    expect(result.presentSkills).toContain("Typescript");
    expect(result.presentSkills).toContain("Python");
  });

  it("identifies missing skills not in the resume", () => {
    const job = normalizeJobDescription("Need React and TypeScript and Docker");
    const result = compare(SAMPLE_RESUME, job);
    expect(result.missingSkills).toContain("React");
    expect(result.missingSkills).toContain("Docker");
    expect(result.presentSkills).toContain("Typescript");
  });

  it("treats skill mentioned in body text as present if not in skills list", () => {
    // SAMPLE_RESUME has "microservices" in a bullet but not in skills
    const job = normalizeJobDescription("Need microservices experience");
    const result = compare(SAMPLE_RESUME, job);
    expect(result.presentSkills).toContain("Microservices");
    // Should generate a suggestion to add it
    expect(result.suggestions.some((s) => s.title.includes("Microservices"))).toBe(true);
  });

  it("generates an add_skill suggestion for each missing skill", () => {
    const job = normalizeJobDescription("Need React and Docker and Kubernetes");
    const result = compare(SAMPLE_RESUME, job);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    for (const s of result.suggestions) {
      expect(s.category).toBe("job-match");
      expect(s.suggestedText).toBeTruthy();
      expect(s.location.sectionId).toBe("skills");
    }
  });

  it("returns empty arrays when JD has no extractable skills", () => {
    const job = normalizeJobDescription("Looking for a great team player");
    const result = compare(SAMPLE_RESUME, job);
    expect(result.presentSkills).toEqual([]);
    expect(result.missingSkills).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it("produces deterministic IDs for suggestions", () => {
    const job = normalizeJobDescription("Need React and react"); // duplicate
    const result = compare(SAMPLE_RESUME, job);
    const ids = result.suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("formats skill names with proper casing", () => {
    const job = normalizeJobDescription("Need CI/CD and A/B testing");
    const result = compare(SAMPLE_RESUME, job);
    for (const s of result.suggestions) {
      expect(s.title).toMatch(/^Add "/);
      expect(s.title).not.toContain('add "ci/cd"'); // not lowercased
    }
  });
});
