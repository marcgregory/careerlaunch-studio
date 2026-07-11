import { describe, expect, it } from "vitest";
import { defaultSectionOrder } from "@careerlaunch/domain";
import { fromStoredResume, normalizeResume, parseResumePayload, toStoredResume } from "../resume-store";

describe("resume-store section order normalization", () => {
  it("deduplicates repeated sections so Projects renders once", () => {
    const sectionOrder = [
      "summary",
      "experience",
      "projects",
      "references",
      "projects",
      "education",
    ];

    const normalized = parseResumePayload({
      id: "resume-1",
      title: "Nurse Resume",
      targetRole: "Registered Nurse",
      templateId: "modern",
      sectionOrder,
      contact: {},
      summary: "Compassionate registered nurse.",
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      professionalQualities: [],
      projects: [
        {
          id: "project-1",
          name: "Hospital Fall Prevention Initiative",
          description: "Reduced inpatient falls by 18%.",
          bullets: [],
        },
      ],
      references: [],
    });

    expect(normalized.sectionOrder.filter((section) => section === "projects")).toHaveLength(1);
    expect(normalized.sectionOrder.slice(0, 5)).toEqual([
      "summary",
      "experience",
      "projects",
      "references",
      "education",
    ]);
    expect(normalized.sectionOrder).toEqual([...new Set(normalized.sectionOrder)]);
    expect(normalized.sectionOrder).toEqual(expect.arrayContaining(defaultSectionOrder));
  });

  it("normalizes duplicate sections when loading stored resumes", () => {
    const resume = fromStoredResume({
      id: "stored-resume-1",
      title: "Stored Nurse Resume",
      targetRole: null,
      body: {
        sectionOrder: ["projects", "references", "projects"],
        projects: [
          {
            id: "project-1",
            name: "Electronic Medication Tracking",
            description: "Improved medication documentation accuracy by 21%.",
            bullets: [],
          },
        ],
      },
    });

    expect(resume.sectionOrder.filter((section) => section === "projects")).toHaveLength(1);
    expect(resume.sectionOrder[0]).toBe("projects");
    expect(resume.sectionOrder[1]).toBe("references");
  });
});
describe("resume-store canonical import normalization", () => {
  it("repairs stored mojibake once and stores achievements as separate items", () => {
    const badEmDash = "\u00e2\u20ac\u201d";
    const badMiddleDot = "\u00c2\u00b7";

    const resume = normalizeResume({
      id: "nurse-import",
      title: "Nurse Import",
      targetRole: "Registered Nurse",
      templateId: "modern",
      contact: { fullName: "Taylor Nurse", email: "taylor@example.com", phone: "555-0100", location: "Austin, TX", website: "", linkedin: "", github: "" },
      summary: `Patient safety ${badEmDash} clinical quality`,
      achievements: [`Nurse of the Year (2023)${badEmDash}Patient Safety Excellence Award (2022)${badEmDash}Clinical Leadership Recognition (2021)`],
      skills: Array.from({ length: 16 }, (_, index) => `Skill ${index + 1}`),
      references: [
        {
          id: "ref-1",
          name: "Michael Lewis, RN",
          title: "Nurse Manager",
          company: "St. Mary's Medical Center",
          phone: `+1 (555) 440-1987 ${badMiddleDot} direct`,
          email: "mlewis@stmarys.org",
          relationship: "",
        },
      ],
    });

    expect(resume.achievements).toEqual([
      "Nurse of the Year (2023)",
      "Patient Safety Excellence Award (2022)",
      "Clinical Leadership Recognition (2021)",
    ]);
    expect(resume.skills).toHaveLength(16);
    expect(resume.references[0]?.phone).toContain("\u00b7");

    const serialized = JSON.stringify(toStoredResume(resume));
    expect(serialized).toContain("\u2014");
    expect(serialized).toContain("\u00b7");
    expect(serialized).not.toContain(badEmDash);
    expect(serialized).not.toContain(badMiddleDot);
  });
});

describe("resume-store license consistency", () => {
  it("persists the same normalized license object used by import preview and builder", () => {
    const resume = normalizeResume({
      id: "license-import",
      title: "License Import",
      templateId: "modern",
      licenses: [
        {
          id: "license-1",
          name: "Registered Nurse (RN)",
          issuingAuthority: "Texas Board of Nursing",
          licenseNumber: "RN12345678",
          expirationDate: "",
        },
      ],
    });

    const stored = toStoredResume(resume);
    expect(stored.licenses).toHaveLength(1);
    expect(stored.licenses[0]).toEqual(
      expect.objectContaining({
        name: "Registered Nurse (RN)",
        issuingAuthority: "Texas Board of Nursing",
        licenseNumber: "RN12345678",
      }),
    );
    expect(JSON.stringify(stored)).not.toContain("License Number: istered");
  });
});
describe("resume-store experience bullet normalization", () => {
  it("repairs orphan and embedded bullet artifacts before builder rendering", () => {
    const resume = normalizeResume({
      id: "bullet-import",
      title: "Bullet Import",
      templateId: "modern",
      experience: [
        {
          id: "exp-1",
          role: "Developer",
          company: "Example Co",
          location: "",
          start: "2021",
          end: "Present",
          bullets: [
            "Participated in daily stand-ups and feature estimation meetings to ensure project",
            "timelines were met.",
            "Installed and maintained computer systems and secured company data through",
            "network security measures.",
            "\u00e2\u2014\u008f Managed IT procurement and deployment of equipment and software.",
          ],
        },
      ],
    });

    expect(resume.experience[0]?.bullets).toEqual([
      "Participated in daily stand-ups and feature estimation meetings to ensure project timelines were met.",
      "Installed and maintained computer systems and secured company data through network security measures.",
      "Managed IT procurement and deployment of equipment and software.",
    ]);
  });
});