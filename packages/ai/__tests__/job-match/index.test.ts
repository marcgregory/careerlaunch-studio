import { describe, it, expect } from "vitest";
import { runJobMatch } from "../../src/job-match/index";
import type { NormalizedResume } from "../../src/analysis/types";

const SAMPLE_RESUME: NormalizedResume = {
  contact: {
    fullName: "Jane Smith",
    email: "jane@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    website: "",
  },
  summary: "Full-stack engineer building web applications.",
  sections: [
    {
      id: "exp-1",
      type: "experience",
      role: "Developer",
      company: "Co",
      bullets: ["Built apps with React."],
      dateRange: { start: "2020", end: "2023" },
    },
  ],
  skills: ["React", "TypeScript", "Python"],
  certifications: [],
  projects: [],
};

describe("runJobMatch integration", () => {
  it("returns a complete result for a matching JD", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Looking for a React developer with TypeScript experience.",
    });

    expect(result.matchScore).toBeGreaterThan(0);
    expect(Array.isArray(result.presentSkills)).toBe(true);
    expect(Array.isArray(result.missingSkills)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it("returns present skills that match", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Need React and Python skills.",
    });

    expect(result.presentSkills).toContain("React");
    expect(result.presentSkills).toContain("Python");
  });

  it("returns missing skills not in resume", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Need React, Docker, and Kubernetes.",
    });

    expect(result.missingSkills).toContain("Docker");
    expect(result.missingSkills).toContain("Kubernetes");
  });

  it("returns null score when no skills extracted from JD", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Looking for a great team player with synergistic paradigm-shifting skills.",
    });

    expect(result.matchScore).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it("all suggestions have category job-match", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Need React, Docker, and Kubernetes.",
    });

    for (const s of result.suggestions) {
      expect(s.category).toBe("job-match");
    }
  });

  it("all suggestions have a suggestedText for add_skill operation", () => {
    const result = runJobMatch({
      resume: SAMPLE_RESUME,
      jobDescription: "Need React, Docker, and Kubernetes.",
    });

    for (const s of result.suggestions) {
      expect(s.suggestedText).toBeTruthy();
      expect(typeof s.suggestedText).toBe("string");
    }
  });
});
