import { describe, it, expect } from "vitest";
import { generateCoverLetter } from "../../src/cover-letter/generate";
import type { CoverLetterInput } from "../../src/cover-letter/types";
import type { ResumeDocument } from "@careerlaunch/domain";

const sampleResume: ResumeDocument = {
  id: "test",
  title: "Test Resume",
  targetRole: "Customer Success Manager",
  templateId: "modern",
  contact: {
    fullName: "Jordan Lee",
    email: "jordan@example.com",
    phone: "(555) 000-0000",
    location: "Austin, TX",
    website: "",
  },
  summary: "Customer-focused professional with 6 years of experience.",
  sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
  experience: [
    {
      id: "exp-1",
      role: "Operations Lead",
      company: "Northstar Market",
      location: "Austin, TX",
      start: "2021",
      end: "Present",
      bullets: [
        "Improved weekly customer issue resolution time by 28%.",
        "Trained 18 team members on service recovery.",
      ],
    },
  ],
  education: [
    {
      id: "edu-1",
      school: "Texas State University",
      degree: "B.A. Communication Studies",
      location: "San Marcos, TX",
      graduation: "2018",
    },
  ],
  skills: ["Customer onboarding", "CRM documentation", "Process improvement", "Team training"],
  certifications: [],
  projects: [],
};

describe("generateCoverLetter", () => {
  it("generates a cover letter body from resume data", () => {
    const result = generateCoverLetter({ resume: sampleResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(100);
    expect(result.salutation).toBe("Dear Hiring Manager,");
    expect(result.closing).toBe("Sincerely,");
  });

  it("includes the target role in the body", () => {
    const result = generateCoverLetter({ resume: sampleResume });

    expect(result.body).toContain("Customer Success Manager");
  });

  it("uses first-person voice throughout the body", () => {
    const result = generateCoverLetter({ resume: sampleResume });

    // Cover letters use first-person ("I") — the applicant's name goes in the signature
    expect(result.body).toContain("my experience");
    expect(result.body).toContain("I am confident");
    expect(result.body).toContain("I thrive");
  });

  it("references skills from the resume", () => {
    const result = generateCoverLetter({ resume: sampleResume });

    expect(result.body).toContain("Customer onboarding");
    expect(result.body).toContain("CRM documentation");
  });

  it("references job description when provided", () => {
    const result = generateCoverLetter({
      resume: sampleResume,
      jobDescription: "Looking for a CSM with SaaS experience.",
    });

    expect(result.body).toContain("recent posting");
  });

  it("handles resume with no experience gracefully", () => {
    const noExpResume: ResumeDocument = {
      ...sampleResume,
      experience: [],
    };
    const result = generateCoverLetter({ resume: noExpResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(50);
  });

  it("handles resume with no skills gracefully", () => {
    const noSkillsResume: ResumeDocument = {
      ...sampleResume,
      skills: [],
    };
    const result = generateCoverLetter({ resume: noSkillsResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(50);
  });

  it("produces multiple paragraphs separated by double newlines", () => {
    const result = generateCoverLetter({ resume: sampleResume });

    const paragraphs = result.body.split("\n\n").filter(Boolean);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});
