import { describe, it, expect } from "vitest";
import { buildCoverLetterContext } from "../../src/cover-letter/context";
import type { ResumeDocument } from "@careerlaunch/domain";

function makeResume(overrides: Partial<ResumeDocument> = {}): ResumeDocument {
  return {
    id: "test",
    title: "Test Resume",
    targetRole: "Software Developer",
    templateId: "modern",
    contact: {
      fullName: "Marc Gregory B. Turno",
      email: "marc@example.com",
      phone: "(555) 000-0000",
      location: "Manila, PH",
      website: "",
    },
    summary: "Full-stack developer with React and Node.js experience.",
    sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    professionalQualities: [],
    projects: [],
    ...overrides,
  };
}

describe("buildCoverLetterContext", () => {
  describe("role/date guard", () => {
    it("uses the first experience role when it is a valid title", () => {
      const resume = makeResume({
        experience: [
          {
            id: "exp-1",
            role: "Senior Frontend Developer",
            company: "Tech Corp",
            location: "Manila",
            start: "2021",
            end: "Present",
            bullets: ["Built React components."],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.currentTitle).toBe("Senior Frontend Developer");
    });

    it("rejects a date string as a role and falls back to targetRole", () => {
      // Simulates a parser that mistakenly put a date range in the role field
      const resume = makeResume({
        targetRole: "Software Developer",
        experience: [
          {
            id: "exp-1",
            role: "Feb 2023 – May 2025",
            company: "Tech Corp",
            location: "Manila",
            start: "2023",
            end: "2025",
            bullets: ["Built features."],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.currentTitle).toBe("Software Developer");
    });

    it("rejects 'January 2020 - Present' as a role and falls back to targetRole", () => {
      const resume = makeResume({
        targetRole: "Frontend Engineer",
        experience: [
          {
            id: "exp-1",
            role: "January 2020 - Present",
            company: "Startup Inc",
            location: "Remote",
            start: "2020",
            end: "Present",
            bullets: ["Built UI components."],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.currentTitle).toBe("Frontend Engineer");
    });

    it("falls back to 'Software Developer' when both role and targetRole are missing/date-like", () => {
      const resume = makeResume({
        targetRole: "",
        experience: [
          {
            id: "exp-1",
            role: "2021-2023",
            company: "Some Co",
            location: "NYC",
            start: "2021",
            end: "2023",
            bullets: ["Worked on things."],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.currentTitle).toBe("Software Developer");
    });

    it("uses targetRole when there are no experience entries", () => {
      const resume = makeResume({
        targetRole: "DevOps Engineer",
        experience: [],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.currentTitle).toBe("DevOps Engineer");
    });
  });

  describe("skill prioritization", () => {
    it("returns max 5 skills, JD-relevant only", () => {
      const resume = makeResume({
        skills: [
          "React",
          "Vue.js",
          "Angular",
          "Python",
          "Django",
          "PostgreSQL",
          "MongoDB",
          "Docker",
          "Kubernetes",
          "AWS",
        ],
      });

      const ctx = buildCoverLetterContext(
        resume,
        undefined,
        "Looking for a React developer with TypeScript and PostgreSQL experience.",
      );

      expect(ctx.topRelevantSkills.length).toBeLessThanOrEqual(5);
      expect(ctx.topRelevantSkills).toContain("React");
      expect(ctx.topRelevantSkills).toContain("PostgreSQL");
    });

    it("returns first 5 skills when no job description is provided", () => {
      const resume = makeResume({
        skills: [
          "React",
          "TypeScript",
          "Node.js",
          "GraphQL",
          "PostgreSQL",
          "Docker",
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.topRelevantSkills).toEqual([
        "React",
        "TypeScript",
        "Node.js",
        "GraphQL",
        "PostgreSQL",
      ]);
    });

    it("does not include entire grouped skills block like 'FRONTEND - HTML, CSS, JS'", () => {
      // This simulates the raw bug where "FRONTEND - HTML, CSS, JavaScript" was dumped as one skill
      const resume = makeResume({
        skills: [
          "FRONTEND - HTML, CSS, JavaScript, TypeScript",
          "BACKEND - Node.js, Python, PostgreSQL",
        ],
      });

      const ctx = buildCoverLetterContext(resume, undefined, "React, TypeScript, Node.js developer");

      // The grouped string itself should never appear
      for (const skill of ctx.topRelevantSkills) {
        expect(skill).not.toMatch(/^(FRONTEND|BACKEND)\s*[-–—:]/i);
      }

      // Individual skills from the groups should appear instead
      expect(ctx.topRelevantSkills.length).toBeGreaterThan(0);
    });

    it("is empty when the resume has no skills", () => {
      const ctx = buildCoverLetterContext(makeResume({ skills: [] }));
      expect(ctx.topRelevantSkills).toEqual([]);
    });
  });

  describe("skill deduplication", () => {
    it("does not repeat the same skill from grouped and flat lists", () => {
      const resume = makeResume({
        skills: [
          "React",
          "TypeScript",
          "FRONTEND - HTML, CSS, JavaScript, TypeScript",
        ],
      });

      const ctx = buildCoverLetterContext(resume, undefined, "React, TypeScript developer");
      const seen = new Set<string>();
      for (const skill of ctx.topRelevantSkills) {
        expect(seen.has(skill)).toBe(false);
        seen.add(skill);
      }
    });
  });

  describe("achievements extraction", () => {
    it("prefers metric-rich bullets", () => {
      const resume = makeResume({
        experience: [
          {
            id: "exp-1",
            role: "Developer",
            company: "Co",
            location: "Manila",
            start: "2020",
            end: "Present",
            bullets: [
              "Improved performance by 40%.",
              "Built new features.",
              "Reduced load time by 2 seconds.",
            ],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.bestAchievements.length).toBeLessThanOrEqual(3);
      // Metric-rich bullets should be first
      expect(ctx.bestAchievements[0]).toMatch(/40%/);
    });

    it("returns at most 3 achievements", () => {
      const resume = makeResume({
        experience: [
          {
            id: "exp-1",
            role: "Developer",
            company: "Co",
            location: "Manila",
            start: "2020",
            end: "Present",
            bullets: [
              "Did A.",
              "Did B.",
              "Did C.",
              "Did D.",
            ],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.bestAchievements.length).toBeLessThanOrEqual(3);
    });

    it("returns empty when no experience exists", () => {
      const ctx = buildCoverLetterContext(makeResume({ experience: [] }));
      expect(ctx.bestAchievements).toEqual([]);
    });
  });

  describe("projects", () => {
    it("returns at most 2 projects, preferring those with bullets", () => {
      const resume = makeResume({
        projects: [
          { id: "p1", name: "Project A", description: "Desc A", bullets: ["Bullet A1"] },
          { id: "p2", name: "Project B", description: "Desc B", bullets: ["Bullet B1", "Bullet B2"] },
          { id: "p3", name: "Project C", description: "Desc C", bullets: [] },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.relevantProjects.length).toBeLessThanOrEqual(2);
    });
  });

  describe("certifications", () => {
    it("returns at most 2 certifications", () => {
      const resume = makeResume({
        certifications: ["AWS Certified", "GCP Certified", "Azure Certified"],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.certifications).toEqual(["AWS Certified", "GCP Certified"]);
    });
  });

  describe("education", () => {
    it("returns the first education entry", () => {
      const resume = makeResume({
        education: [
          { id: "e1", school: "MIT", degree: "B.S. CS", location: "Cambridge", graduation: "2020" },
          { id: "e2", school: "Harvard", degree: "M.S. CS", location: "Boston", graduation: "2022" },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      expect(ctx.education).toBeDefined();
      expect(ctx.education!.school).toBe("MIT");
    });

    it("is undefined when no education exists", () => {
      const ctx = buildCoverLetterContext(makeResume({ education: [] }));
      expect(ctx.education).toBeUndefined();
    });
  });

  describe("years of experience", () => {
    it("calculates from earliest start date", () => {
      const resume = makeResume({
        experience: [
          {
            id: "exp-1",
            role: "Developer",
            company: "Co",
            location: "Manila",
            start: "2020",
            end: "Present",
            bullets: [],
          },
          {
            id: "exp-2",
            role: "Junior Dev",
            company: "Old Co",
            location: "Manila",
            start: "2018",
            end: "2020",
            bullets: [],
          },
        ],
      });

      const ctx = buildCoverLetterContext(resume);
      // Current year is 2026, earliest start is 2018
      expect(ctx.yearsExperience).toBe(8);
    });

    it("is undefined when no experience exists", () => {
      const ctx = buildCoverLetterContext(makeResume({ experience: [] }));
      expect(ctx.yearsExperience).toBeUndefined();
    });
  });
});
