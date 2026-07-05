import { describe, it, expect } from "vitest";
import { mergeRecovery, needsAICoverageRecovery } from "../../src/import/recovery";
import type { ParseResult, SectionCoverageItem } from "../../src/import/text-parser";
import type { RecoveryResult } from "../../src/import/recovery";

/* ------------------------------------------------------------------ */
/*  Helper factories                                                    */
/* ------------------------------------------------------------------ */

function makeCoverageItem(
  sectionId: string,
  ratio: number,
  parsedWordCount = Math.round(100 * ratio),
  originalWordCount = 100,
): SectionCoverageItem {
  const status =
    ratio >= 0.8 ? "good" as const
    : ratio >= 0.4 ? "partial" as const
    : ratio >= 0.1 ? "poor" as const
    : "missing" as const;

  return {
    sectionId,
    originalWordCount,
    parsedWordCount,
    ratio,
    status,
  };
}

function makeParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    parsed: {
      contact: { fullName: "John Doe", email: "john@example.com", phone: "", location: "", website: "" },
      summary: "",
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      professionalQualities: [],
      projects: [],
    },
    confidence: 50,
    confidenceBySection: {},
    importQuality: "fair",
    warnings: [],
    unparsedContent: {},
    coverage: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  needsAICoverageRecovery                                            */
/* ------------------------------------------------------------------ */

describe("needsAICoverageRecovery", () => {
  it("should return true when experience coverage is below 80%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.21),
      makeCoverageItem("education", 0.95),
    ];
    expect(needsAICoverageRecovery(coverage)).toBe(true);
  });

  it("should return true when education coverage is below 80%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.95),
      makeCoverageItem("education", 0.24),
    ];
    expect(needsAICoverageRecovery(coverage)).toBe(true);
  });

  it("should return true when projects coverage is below 80%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.95),
      makeCoverageItem("education", 0.95),
      makeCoverageItem("projects", 0.0),
    ];
    expect(needsAICoverageRecovery(coverage)).toBe(true);
  });

  it("should return false when all critical sections are at or above 80%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.95),
      makeCoverageItem("education", 0.92),
      makeCoverageItem("skills", 0.88),
    ];
    expect(needsAICoverageRecovery(coverage)).toBe(false);
  });

  it("should return false when non-critical sections have low coverage", () => {
    const coverage = [
      makeCoverageItem("experience", 0.95),
      makeCoverageItem("education", 0.92),
      makeCoverageItem("summary", 0.1), // summary is not in CRITICAL_SECTIONS
    ];
    expect(needsAICoverageRecovery(coverage)).toBe(false);
  });

  it("should return false for empty coverage", () => {
    expect(needsAICoverageRecovery([])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  mergeRecovery                                                      */
/* ------------------------------------------------------------------ */

describe("mergeRecovery", () => {
  it("should use AI recovered experience when parser coverage is low", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Marc Turno", email: "marc@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [], // Parser found nothing
        education: [],
        skills: ["TypeScript"],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.21, 3, 50),
        makeCoverageItem("education", 0.95, 20, 21),
        makeCoverageItem("skills", 0.95, 5, 5),
      ],
    });

    const aiRecovery: RecoveryResult = {
      experience: [
        {
          role: "Software Developer",
          company: "Volenday Philippines Inc.",
          start: "Feb 2023",
          end: "May 2025",
          bullets: [
            "Developed features using React and TypeScript.",
            "Built and debugged RESTful APIs.",
          ],
        },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.aiRecovered).toBe(true);
    expect(merged.recoveredSections).toContain("experience");
    expect(merged.parsed.experience).toHaveLength(1);
    expect(merged.parsed.experience![0].role).toBe("Software Developer");
    expect(merged.parsed.experience![0].company).toBe("Volenday Philippines Inc.");
    expect(merged.parsed.experience![0].bullets).toHaveLength(2);
  });

  it("should keep parser experience when coverage is high", () => {
    const parserExperience = [
      {
        id: "import-exp-1",
        role: "Developer",
        company: "Acme Inc",
        location: "",
        start: "2020",
        end: "Present",
        bullets: ["Built things."],
      },
    ];

    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test User", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: parserExperience,
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 15, 16),
        makeCoverageItem("education", 0.0, 0, 10),
      ],
    });

    const aiRecovery: RecoveryResult = {
      experience: [
        {
          role: "Something Else",
          company: "Other Co",
          start: "2018",
          end: "2020",
          bullets: ["Did stuff."],
        },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Experience coverage is 95%, so parser version should be kept
    expect(merged.recoveredSections).not.toContain("experience");
    expect(merged.parsed.experience).toHaveLength(1);
    expect(merged.parsed.experience![0].role).toBe("Developer");
  });

  it("should merge AI education when parser coverage is low", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [],
        education: [], // Parser found nothing
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 1.0, 10, 10),
        makeCoverageItem("education", 0.24, 3, 15),
      ],
    });

    const aiRecovery: RecoveryResult = {
      education: [
        {
          school: "University of Santo Tomas",
          degree: "Bachelor of Science in Information Technology",
          graduation: "2019",
        },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.aiRecovered).toBe(true);
    expect(merged.recoveredSections).toContain("education");
    expect(merged.parsed.education).toHaveLength(1);
    expect(merged.parsed.education![0].school).toBe("University of Santo Tomas");
    expect(merged.parsed.education![0].degree).toBe("Bachelor of Science in Information Technology");
    expect(merged.parsed.education![0].graduation).toBe("2019");
  });

  it("should preserve contact info from parser always", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Marc Gregory Turno", email: "marc@email.com", phone: "+63 912 345 6789", location: "Manila", website: "linkedin.com/in/marcturno" },
        summary: "",
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.0, 0, 50),
      ],
    });

    const aiRecovery: RecoveryResult = {
      experience: [
        { role: "Dev", company: "Co", start: "2020", end: "Present", bullets: ["Worked"] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.parsed.contact?.fullName).toBe("Marc Gregory Turno");
    expect(merged.parsed.contact?.email).toBe("marc@email.com");
    expect(merged.parsed.contact?.phone).toBe("+63 912 345 6789");
  });

  it("should deduplicate experience entries from AI and parser", () => {
    const parserExperience = [
      {
        id: "import-exp-1",
        role: "Developer",
        company: "Acme Inc",
        location: "",
        start: "2020",
        end: "Present",
        bullets: ["Built things."],
      },
    ];

    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: parserExperience,
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.3, 5, 50),
        makeCoverageItem("education", 0.0, 0, 10),
      ],
    });

    const aiRecovery: RecoveryResult = {
      experience: [
        // Same entry as parser (should be deduplicated)
        { role: "Developer", company: "Acme Inc", start: "2020", end: "Present", bullets: ["Built things."] },
        // New entry (should be added)
        { role: "Junior Dev", company: "Startup XYZ", start: "2018", end: "2019", bullets: ["Helped out."] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.parsed.experience).toHaveLength(2);
    expect(merged.parsed.experience![0].role).toBe("Developer");
    expect(merged.parsed.experience![1].role).toBe("Junior Dev");
  });

  it("should return aiRecovered=false when no recovery data applied", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "My summary.",
        experience: [
          { id: "exp-1", role: "Dev", company: "Acme", location: "", start: "2020", end: "Present", bullets: ["Work."] },
        ],
        education: [],
        skills: ["JavaScript"],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("education", 0.0, 0, 10),
        makeCoverageItem("skills", 0.9, 5, 5),
      ],
    });

    const aiRecovery: RecoveryResult = {};

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.aiRecovered).toBe(false);
    expect(merged.recoveredSections).toHaveLength(0);
  });

  it("should merge AI projects when parser coverage is low", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [
          { id: "exp-1", role: "Dev", company: "Acme", location: "", start: "2020", end: "Present", bullets: ["Work"] },
        ],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [], // Parser found nothing
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("projects", 0.0, 0, 20),
      ],
    });

    const aiRecovery: RecoveryResult = {
      projects: [
        {
          name: "CareerLaunch Studio",
          bullets: [
            "Full-stack SaaS platform for resume creation.",
            "Built with Next.js and PostgreSQL.",
          ],
        },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.recoveredSections).toContain("projects");
    expect(merged.parsed.projects).toHaveLength(1);
    expect(merged.parsed.projects![0].name).toBe("CareerLaunch Studio");
    expect(merged.parsed.projects![0].bullets).toHaveLength(2);
  });

  it("should use AI summary when parser coverage is low", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "Versatile dev.", // Very short — low coverage
        experience: [
          { id: "exp-1", role: "Dev", company: "Acme", location: "", start: "2020", end: "Present", bullets: ["Work"] },
        ],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("summary", 0.3, 3, 20), // Low coverage
      ],
    });

    const aiRecovery: RecoveryResult = {
      summary: "Versatile developer with expertise spanning frontend, backend, and cloud infrastructure. Experienced in building full-stack applications and AI-powered tools.",
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.recoveredSections).toContain("summary");
    expect(merged.parsed.summary).toContain("full-stack applications");
  });

  it("should handle empty AI recovery gracefully (fallback to parser)", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "Original summary.",
        experience: [
          { id: "exp-1", role: "Dev", company: "Acme", location: "", start: "2020", end: "Present", bullets: ["Work"] },
        ],
        education: [
          { id: "edu-1", school: "State U", degree: "BS", location: "", graduation: "2020" },
        ],
        skills: ["JavaScript"],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.3, 5, 50),
        makeCoverageItem("education", 0.3, 4, 20),
      ],
    });

    // Empty recovery — all AI sections are undefined
    const aiRecovery: RecoveryResult = {};

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Fallback to parser output unchanged
    expect(merged.aiRecovered).toBe(false);
    expect(merged.parsed.experience).toHaveLength(1);
    expect(merged.parsed.education).toHaveLength(1);
    expect(merged.parsed.summary).toBe("Original summary.");
    expect(merged.parsed.skills).toContain("JavaScript");
  });
});
