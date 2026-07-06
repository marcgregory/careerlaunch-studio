import { describe, it, expect } from "vitest";
import { runStaticAnalysis } from "../../src/analysis/static.js";
import type { NormalizedResume } from "../../src/analysis/types.js";

function makeMinimalResume(overrides?: Partial<NormalizedResume>): NormalizedResume {
  return {
    contact: {
      fullName: "Jane Smith",
      email: "jane@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      website: "",
    },
    summary: "Experienced software engineer with 5 years building web applications.",
    sections: [
      {
        id: "exp-1",
        type: "experience",
        role: "Senior Developer",
        company: "Acme Corp",
        bullets: ["Built a CI/CD pipeline that reduced deployment time by 40%."],
        dateRange: { start: "2020", end: "2023" },
      },
      {
        id: "edu-1",
        type: "education",
        school: "State University",
        degree: "B.S. Computer Science",
        bullets: [],
        dateRange: { start: "2016", end: "2020" },
      },
    ],
    skills: ["TypeScript", "React", "Node.js", "Docker", "PostgreSQL", "AWS"],
    certifications: ["AWS Certified Developer"],
    projects: [],
    ...overrides,
  };
}

describe("runStaticAnalysis", () => {
  function runStatic(resume: NormalizedResume) {
    return runStaticAnalysis(resume).suggestions;
  }

  it("returns no critical suggestions for a complete resume", () => {
    const resume = makeMinimalResume();
    const suggestions = runStatic(resume);
    const critical = suggestions.filter((s) => s.severity === "critical");
    expect(critical).toHaveLength(0);
  });

  it("flags missing email as critical", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "", phone: "(555) 123-4567", location: "SF", website: "" },
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "contact:missing-email:contact")).toBe(true);
    const email = suggestions.find((s) => s.id === "contact:missing-email:contact")!;
    expect(email.severity).toBe("critical");
    expect(email.source).toBe("static");
  });

  it("flags missing phone as critical", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "j@j.com", phone: "", location: "SF", website: "" },
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "contact:missing-phone:contact")).toBe(true);
  });

  it("flags invalid email format", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "not-an-email", phone: "(555) 123-4567", location: "SF", website: "" },
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "contact:email-invalid:contact")).toBe(true);
  });

  it("flags missing summary as critical", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "summary:missing:summary")).toBe(true);
  });

  it("flags a too-short summary", () => {
    const resume = makeMinimalResume({ summary: "Short." });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "summary:too-short:summary")).toBe(true);
  });

  it("does not flag a good-length summary", () => {
    const resume = makeMinimalResume({
      summary: "Senior engineer with 8 years of experience building scalable web applications and leading cross-functional teams to deliver high-impact products. Proven track record of driving engineering excellence and mentoring junior developers.",
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "summary:too-short:summary")).toBe(false);
    expect(suggestions.some((s) => s.id === "summary:too-long:summary")).toBe(false);
  });

  it("flags no experience entries as critical", () => {
    const resume = makeMinimalResume({ sections: [] });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "experience:missing:experience")).toBe(true);
  });

  it("flags experience entries with no bullet points", () => {
    const resume = makeMinimalResume({
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Developer",
          company: "Co",
          bullets: [],
          dateRange: { start: "2020", end: "2023" },
        },
      ],
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "experience:empty:exp-1")).toBe(true);
  });

  it("flags experience with no metrics and weak verbs as major", () => {
    const resume = makeMinimalResume({
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Developer",
          company: "Co",
          bullets: ["Worked on the frontend team developing new features."],
          dateRange: { start: "2020", end: "2023" },
        },
      ],
    });
    const suggestions = runStatic(resume);
    const noMetrics = suggestions.find((s) => s.id === "impact:no-metrics:exp-1");
    expect(noMetrics).toBeDefined();
    expect(noMetrics!.severity).toBe("major");
  });

  it("flags experience with no metrics but strong verbs as minor", () => {
    const resume = makeMinimalResume({
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Developer",
          company: "Co",
          bullets: ["Developed new features for the frontend team."],
          dateRange: { start: "2020", end: "2023" },
        },
      ],
    });
    const suggestions = runStatic(resume);
    const noMetrics = suggestions.find((s) => s.id === "impact:no-metrics:exp-1");
    expect(noMetrics).toBeDefined();
    expect(noMetrics!.severity).toBe("minor");
  });

  it("does not flag metrics when bullets contain numbers", () => {
    const resume = makeMinimalResume();
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "impact:no-metrics:exp-1")).toBe(false);
  });

  it("regression: strong action bullets without numbers are minor, not major", () => {
    const resume = makeMinimalResume({
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Ahamatic Junior Software Engineer",
          company: "Co",
          bullets: [
            "Developed features in an Agile environment and managed code via Git.",
            "Built and debugged React and Next.js applications.",
            "Collaborated with design teams to implement high-fidelity UIs.",
            "Produced clean, efficient, well-documented code.",
            "Participated in code reviews and mentored junior developers.",
          ],
          dateRange: { start: "2021", end: "2024" },
        },
      ],
    });
    const suggestions = runStatic(resume);
    const noMetrics = suggestions.find((s) => s.id === "impact:no-metrics:exp-1");
    expect(noMetrics).toBeDefined();
    expect(noMetrics!.severity).toBe("minor");
    expect(noMetrics!.title).toContain("Consider adding measurable impact");
    expect(noMetrics!.reason).toContain("Do not invent numbers");
  });

  it("flags missing skills", () => {
    const resume = makeMinimalResume({ skills: [] });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "skills:missing:skills")).toBe(true);
  });

  it("flags too few skills", () => {
    const resume = makeMinimalResume({ skills: ["TypeScript"] });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "skills:too-few:skills")).toBe(true);
  });

  it("flags too many skills", () => {
    const longSkills = Array.from({ length: 25 }, (_, i) => `Skill ${i + 1}`);
    const resume = makeMinimalResume({ skills: longSkills });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "skills:too-many:skills")).toBe(true);
  });

  it("flags missing education", () => {
    const resume = makeMinimalResume({ sections: [] });
    // Adding experience separately from education
    const noEduResume: NormalizedResume = {
      ...resume,
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Developer",
          company: "Co",
          bullets: ["Did stuff."],
          dateRange: { start: "2020", end: "2023" },
        },
      ],
    };
    const suggestions = runStatic(noEduResume);
    expect(suggestions.some((s) => s.id === "education:missing:education")).toBe(true);
  });

  it("detects missing location as minor", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "j@j.com", phone: "(555) 123-4567", location: "", website: "" },
    });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "contact:location-missing:contact")).toBe(true);
    const loc = suggestions.find((s) => s.id === "contact:location-missing:contact")!;
    expect(loc.severity).toBe("minor");
  });

  it("suggests adding projects when none exist", () => {
    const resume = makeMinimalResume({ projects: [] });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "completeness:projects-missing:projects")).toBe(true);
  });

  it("does not report certifications as a suggestion (moved to statistics)", () => {
    const resume = makeMinimalResume({ certifications: ["AWS Certified"] });
    const suggestions = runStatic(resume);
    expect(suggestions.some((s) => s.id === "completeness:certifications:certifications")).toBe(false);
  });

  it("includes resume statistics", () => {
    const result = runStaticAnalysis(makeMinimalResume());
    expect(result.statistics).toEqual({
      skills: 6,
      certifications: 1,
      projects: 0,
      experienceEntries: 1,
      educationEntries: 1,
      bulletPoints: 1,
    });
  });

  it("all suggestions have source = 'static'", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStatic(resume);
    for (const s of suggestions) {
      expect(s.source).toBe("static");
      expect(s.confidence).toBe(1);
    }
  });

  it("all suggestions have unique ids", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStatic(resume);
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no measurable results suggestion (weak verbs) includes coaching in reason instead of suggestedText", () => {
    const resume = makeMinimalResume({
      sections: [
        {
          id: "exp-1",
          type: "experience",
          role: "Developer",
          company: "Co",
          bullets: ["Worked on the frontend team developing new features."],
          dateRange: { start: "2020", end: "2023" },
        },
      ],
    });
    const suggestions = runStatic(resume);
    const noMetrics = suggestions.find((s) => s.id === "impact:no-metrics:exp-1");
    expect(noMetrics).toBeDefined();
    expect(noMetrics!.suggestedText).toBeNull();
    expect(noMetrics!.reason).toContain("15+ React components");
    expect(noMetrics!.reason).toContain("Reduced page load");
  });
});
