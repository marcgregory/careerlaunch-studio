import { describe, it, expect } from "vitest";
import { generateCoverLetter, deterministicGenerateCoverLetter } from "../../src/cover-letter/generate";
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
  it("generates a cover letter body from resume data", async () => {
    const result = await generateCoverLetter({ resume: sampleResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(100);
    expect(result.salutation).toBe("Dear Hiring Manager,");
    expect(result.closing).toBe("Sincerely,");
  });

  it("includes the target role in the body", async () => {
    const result = await generateCoverLetter({ resume: sampleResume });

    expect(result.body).toContain("Customer Success Manager");
  });

  it("uses first-person voice throughout the body", async () => {
    const result = await generateCoverLetter({ resume: sampleResume });

    // Cover letters use first-person ("I")
    expect(result.body).toContain("I am");
    expect(result.body).toContain("my");
  });

  it("references relevant skills from the resume (max 5, not the full list)", async () => {
    const result = await generateCoverLetter({ resume: sampleResume });

    // Should reference some skills, but not dump the entire raw skills array
    const hasSomeSkills = ["Customer onboarding", "CRM documentation", "Process improvement", "Team training"]
      .some((skill) => result.body.includes(skill));
    expect(hasSomeSkills).toBe(true);
  });

  it("references job description when provided", async () => {
    const result = await generateCoverLetter({
      resume: sampleResume,
      jobDescription: "Looking for a CSM with SaaS experience.",
    });

    expect(result.body).toContain("posting");
  });

  it("handles resume with no experience gracefully", async () => {
    const noExpResume: ResumeDocument = {
      ...sampleResume,
      experience: [],
    };
    const result = await generateCoverLetter({ resume: noExpResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(50);
  });

  it("handles resume with no skills gracefully", async () => {
    const noSkillsResume: ResumeDocument = {
      ...sampleResume,
      skills: [],
    };
    const result = await generateCoverLetter({ resume: noSkillsResume });

    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(50);
  });

  it("produces multiple paragraphs separated by double newlines", async () => {
    const result = await generateCoverLetter({ resume: sampleResume });

    const paragraphs = result.body.split("\n\n").filter(Boolean);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("deterministicGenerateCoverLetter (no AI)", () => {
  it("does not include raw grouped skill prefix like 'FRONTEND -'", () => {
    const resumeWithGrouped: ResumeDocument = {
      ...sampleResume,
      targetRole: "Frontend Developer",
      skills: [
        "FRONTEND - React, TypeScript, CSS, HTML",
        "BACKEND - Node.js, Express",
        "CLOUD - AWS, Docker",
      ],
    };

    const result = deterministicGenerateCoverLetter({ resume: resumeWithGrouped });

    // The grouped labels should not appear in the output
    expect(result.body).not.toMatch(/FRONTEND\s*-/i);
    expect(result.body).not.toMatch(/BACKEND\s*-/i);
    expect(result.body).not.toMatch(/CLOUD\s*-/i);
  });

  it("does not use a date string as a job title", () => {
    const resumeWithDateRole: ResumeDocument = {
      ...sampleResume,
      targetRole: "Frontend Engineer",
      experience: [
        {
          id: "exp-1",
          role: "Feb 2023 – May 2025",
          company: "Some Corp",
          location: "NYC",
          start: "2023",
          end: "2025",
          bullets: ["Built React components."],
        },
      ],
    };

    const result = deterministicGenerateCoverLetter({ resume: resumeWithDateRole });

    // The date string should not appear as a job title
    expect(result.body).not.toContain("Feb 2023");
    expect(result.body).not.toContain("May 2025");
    // The target role should be used instead
    expect(result.body).toContain("Frontend Engineer");
  });

  it("does not repeat the same skill list twice in the body", () => {
    const result = deterministicGenerateCoverLetter({ resume: sampleResume });

    // Extract the skills used in the letter
    const skillsUsed = sampleResume.skills.filter((s) => result.body.includes(s));

    // Each skill should appear at most once
    for (const skill of skillsUsed) {
      const matches = result.body.match(new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
      expect(matches?.length).toBe(1);
    }
  });

  it("uses JD-relevant skills only when a job description is provided", () => {
    const resumeWithManySkills: ResumeDocument = {
      ...sampleResume,
      targetRole: "Frontend Developer",
      skills: [
        "React",
        "Vue.js",
        "Python",
        "Django",
        "PostgreSQL",
        "Docker",
        "Kubernetes",
        "Figma",
      ],
    };

    const result = deterministicGenerateCoverLetter({
      resume: resumeWithManySkills,
      jobDescription: "Looking for a React developer with TypeScript skills.",
    });

    // Should mention React and not dump irrelevant skills like Kubernetes or Figma
    expect(result.body).toContain("React");
  });

  it("works when role is missing (falls back to targetRole)", () => {
    const resumeNoRole: ResumeDocument = {
      ...sampleResume,
      targetRole: "Backend Developer",
      experience: [
        {
          id: "exp-1",
          role: "", // Empty role
          company: "Tech Co",
          location: "Remote",
          start: "2020",
          end: "Present",
          bullets: ["Built APIs."],
        },
      ],
    };

    const result = deterministicGenerateCoverLetter({ resume: resumeNoRole });

    expect(result.body).toContain("Backend Developer");
  });

  it("produces a letter matching the expected style (no raw tech lists)", () => {
    const devResume: ResumeDocument = {
      ...sampleResume,
      targetRole: "Software Developer",
      contact: {
        ...sampleResume.contact,
        fullName: "Marc Gregory B. Turno",
      },
      skills: [
        "React",
        "TypeScript",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "Python",
        "Docker",
        "AWS",
        "GraphQL",
      ],
      experience: [
        {
          id: "exp-1",
          role: "Frontend Developer",
          company: "Volenday Philippines Incorporated",
          location: "Manila",
          start: "2022",
          end: "Present",
          bullets: [
            "Developed and debugged React and Next.js features in an Agile environment.",
            "Collaborated with design teams to implement high-fidelity interfaces.",
            "Reduced page load time by 35% through performance optimization.",
          ],
        },
      ],
      projects: [
        {
          id: "proj-1",
          name: "SaaS Platform",
          description: "Full-stack SaaS application",
          bullets: [
            "Built with React, TypeScript, Node.js, and PostgreSQL.",
            "Deployed using modern CI/CD and cloud infrastructure.",
          ],
        },
      ],
    };

    const result = deterministicGenerateCoverLetter({
      resume: devResume,
      jobDescription: "Software Developer needed for React and Next.js frontend work.",
    });

    // Verify quality characteristics
    expect(result.salutation).toBe("Dear Hiring Manager,");

    // Should not dump all 9 skills
    expect(result.body).not.toContain("Python");
    expect(result.body).not.toContain("GraphQL");

    // Should reference the JD-relevant skills
    expect(result.body).toContain("React");
    expect(result.body).toContain("Next.js");

    // Should reference the company
    expect(result.body).toContain("Volenday");

    // Should reference metric-rich achievement
    expect(result.body).toContain("35%");
  });
});
