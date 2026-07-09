import { describe, expect, it } from "vitest";
import { defaultSectionOrder } from "@careerlaunch/domain";
import { fromStoredResume, parseResumePayload } from "../resume-store";

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