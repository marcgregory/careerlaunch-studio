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
  it("returns no critical suggestions for a complete resume", () => {
    const resume = makeMinimalResume();
    const suggestions = runStaticAnalysis(resume);
    const critical = suggestions.filter((s) => s.severity === "critical");
    expect(critical).toHaveLength(0);
  });

  it("flags missing email as critical", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "", phone: "(555) 123-4567", location: "SF", website: "" },
    });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "contact-email")).toBe(true);
    const email = suggestions.find((s) => s.id === "contact-email")!;
    expect(email.severity).toBe("critical");
    expect(email.source).toBe("static");
  });

  it("flags missing phone as critical", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "j@j.com", phone: "", location: "SF", website: "" },
    });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "contact-phone")).toBe(true);
  });

  it("flags invalid email format", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "not-an-email", phone: "(555) 123-4567", location: "SF", website: "" },
    });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "contact-email-invalid")).toBe(true);
  });

  it("flags missing summary as critical", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "summary-missing")).toBe(true);
  });

  it("flags a too-short summary", () => {
    const resume = makeMinimalResume({ summary: "Short." });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "summary-too-short")).toBe(true);
  });

  it("does not flag a good-length summary", () => {
    const resume = makeMinimalResume({
      summary: "Senior engineer with 8 years of experience building scalable web applications and leading cross-functional teams to deliver high-impact products. Proven track record of driving engineering excellence and mentoring junior developers.",
    });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "summary-too-short")).toBe(false);
    expect(suggestions.some((s) => s.id === "summary-too-long")).toBe(false);
  });

  it("flags no experience entries as critical", () => {
    const resume = makeMinimalResume({ sections: [] });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "exp-missing")).toBe(true);
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
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "exp-empty-exp-1")).toBe(true);
  });

  it("flags experience with no metrics", () => {
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
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "exp-metrics-exp-1")).toBe(true);
  });

  it("does not flag metrics when bullets contain numbers", () => {
    const resume = makeMinimalResume();
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "exp-metrics-exp-1")).toBe(false);
  });

  it("flags missing skills", () => {
    const resume = makeMinimalResume({ skills: [] });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "skills-missing")).toBe(true);
  });

  it("flags too few skills", () => {
    const resume = makeMinimalResume({ skills: ["TypeScript"] });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "skills-few")).toBe(true);
  });

  it("flags too many skills", () => {
    const longSkills = Array.from({ length: 25 }, (_, i) => `Skill ${i + 1}`);
    const resume = makeMinimalResume({ skills: longSkills });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "skills-many")).toBe(true);
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
    const suggestions = runStaticAnalysis(noEduResume);
    expect(suggestions.some((s) => s.id === "edu-missing")).toBe(true);
  });

  it("detects missing location as minor", () => {
    const resume = makeMinimalResume({
      contact: { fullName: "Jane Smith", email: "j@j.com", phone: "(555) 123-4567", location: "", website: "" },
    });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "contact-location-missing")).toBe(true);
    const loc = suggestions.find((s) => s.id === "contact-location-missing")!;
    expect(loc.severity).toBe("minor");
  });

  it("suggests adding projects when none exist", () => {
    const resume = makeMinimalResume({ projects: [] });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "projects-missing")).toBe(true);
  });

  it("reports certifications as info when present", () => {
    const resume = makeMinimalResume({ certifications: ["AWS Certified"] });
    const suggestions = runStaticAnalysis(resume);
    expect(suggestions.some((s) => s.id === "certifications-present")).toBe(true);
    const cert = suggestions.find((s) => s.id === "certifications-present")!;
    expect(cert.severity).toBe("info");
  });

  it("all suggestions have source = 'static'", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStaticAnalysis(resume);
    for (const s of suggestions) {
      expect(s.source).toBe("static");
      expect(s.confidence).toBe(1);
    }
  });

  it("all suggestions have unique ids", () => {
    const resume = makeMinimalResume({ summary: "" });
    const suggestions = runStaticAnalysis(resume);
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
