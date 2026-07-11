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

  it("should replace parser experience entries with AI entries", () => {
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
        // Same role/company as parser but now AI entry replaces parser entirely
        { role: "Developer", company: "Acme Inc", start: "2020", end: "Present", bullets: ["Built things."] },
        // New entry from AI
        { role: "Junior Dev", company: "Startup XYZ", start: "2018", end: "2019", bullets: ["Helped out."] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // With replace semantics, only AI entries survive (both)
    expect(merged.parsed.experience).toHaveLength(2);
    expect(merged.parsed.experience![0].role).toBe("Developer");
    expect(merged.parsed.experience![1].role).toBe("Junior Dev");
    // Parser entries are not included; all entries have AI-generated IDs
    expect(merged.parsed.experience![0].id).toMatch(/^import-exp-recovered-/);
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

  it("should replace all parser experience entries including fragments with AI entries", () => {
    // Fragment entry: no company, no bullets, no dates (parser artifact)
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [
          { id: "exp-fragment", role: "timelines were met.", company: "", location: "", start: "", end: "", bullets: [] },
          { id: "exp-real", role: "Software Engineer", company: "RealCo", location: "", start: "2020", end: "2023", bullets: ["Built stuff."] },
        ],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.3, 5, 50),
      ],
    });

    const aiRecovery: RecoveryResult = {
      experience: [
        // AI found a different entry not captured by parser
        { role: "Junior Developer", company: "PreviousCo", start: "2018", end: "2020", bullets: ["Learned things."] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // With replace semantics, only the AI entry survives (parser entries are gone)
    expect(merged.parsed.experience).toHaveLength(1);
    expect(merged.parsed.experience![0].role).toBe("Junior Developer");
    // The orphan fragment "timelines were met." is gone
    expect(merged.parsed.experience!.every((e) => e.company.length > 0)).toBe(true);
  });

  it("should replace parser education entries with AI entries", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [],
        education: [
          { id: "edu-1", school: "Cagayan de Oro College - PHINMA", degree: "BS in Computer Engineering", location: "", graduation: "2015" },
        ],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 1.0, 10, 10),
        makeCoverageItem("education", 0.3, 5, 30),
      ],
    });

    const aiRecovery: RecoveryResult = {
      education: [
        { school: "Cagayan de Oro College - PHINMA", degree: "BS in Computer Engineering", graduation: "2015" },
        { school: "Some Other University", degree: "MBA", graduation: "2020" },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // With replace semantics, AI entries are the only source
    expect(merged.parsed.education).toHaveLength(2);
    expect(merged.parsed.education![0].degree).toBe("BS in Computer Engineering");
    expect(merged.parsed.education![0].school).toBe("Cagayan de Oro College - PHINMA");
    expect(merged.parsed.education![1].school).toBe("Some Other University");
  });

  it("should merge AI categorized skills when parser coverage is low", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [
          { id: "exp-1", role: "Dev", company: "Acme", location: "", start: "2020", end: "Present", bullets: ["Work"] },
        ],
        education: [],
        skills: ["Node", "React"],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("skills", 0.3, 3, 20),
      ],
    });

    const aiRecovery: RecoveryResult = {
      skills: [
        { category: "Frontend", items: ["React", "TypeScript"] },
        { category: "Backend", items: ["Node.js", "PostgreSQL"] },
        { category: "Cloud & Tools", items: ["Docker", "AWS"] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    expect(merged.recoveredSections).toContain("skills");
    expect(merged.aiRecovered).toBe(true);
    // Skills should contain clean atomic items WITHOUT category prefixes
    expect(merged.parsed.skills).toContain("React");
    expect(merged.parsed.skills).toContain("TypeScript");
    expect(merged.parsed.skills).toContain("Node.js");
    expect(merged.parsed.skills).toContain("PostgreSQL");
    expect(merged.parsed.skills).toContain("Docker");
    expect(merged.parsed.skills).toContain("AWS");
    // No prefix-formatted skill names
    expect(merged.parsed.skills).not.toContain("Frontend: React");
    expect(merged.parsed.skills).not.toContain("Backend: Node.js");
    expect(merged.parsed.skills).not.toContain("Cloud & Tools: Docker");
    // Each expected skill appears exactly once (no duplicates)
    expect(merged.parsed.skills.filter((s) => s === "React")).toHaveLength(1);
    expect(merged.parsed.skills).toHaveLength(6);
  });

  /* ---------------------------------------------------------------- */
  /*  Guardrail Tests                                                  */
  /* ---------------------------------------------------------------- */

  it("should NOT apply AI certifications when the LLM returns empty array (guardrail: no empty sections)", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "Works hard.",
        experience: [],
        education: [],
        skills: [],
        certifications: ["Some cert"], // Parser found something (wouldn't trigger recovery check otherwise)
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("education", 0.95, 10, 10),
        makeCoverageItem("certifications", 0.0, 0, 10),
      ],
    });

    // LLM returns empty certifications (section absent from original)
    const aiRecovery: RecoveryResult = {
      certifications: [],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Certifications should NOT have been added to recovered sections
    // because the LLM returned an empty list
    expect(merged.recoveredSections).not.toContain("certifications");
  });

  it("should NOT apply AI recovery for experience when LLM returns empty list (guardrail: no empty sections)", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
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
      experience: [],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Empty experience array from LLM should not trigger recovery
    expect(merged.recoveredSections).not.toContain("experience");
    expect(merged.aiRecovered).toBe(false);
  });

  it("should NOT apply AI recovery when LLM returns professionalQualities empty list (guardrail: no empty sections)", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("experience", 0.95, 10, 10),
        makeCoverageItem("professionalQualities", 0.0, 0, 15),
      ],
    });

    const aiRecovery: RecoveryResult = {
      professionalQualities: [],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Empty professionalQualities from LLM should not trigger recovery
    expect(merged.recoveredSections).not.toContain("professionalQualities");
  });

  it("should strip residual category prefixes from LLM skill items (guardrail: no broken skills)", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [
        makeCoverageItem("skills", 0.0, 0, 20),
      ],
    });

    // LLM sometimes embeds category prefix in item names despite instructions
    const aiRecovery: RecoveryResult = {
      skills: [
        { category: "Testing", items: ["Testing: libraries", "Testing: frameworks"] },
        { category: "Frontend", items: ["Frontend: React", "TypeScript"] },
      ],
    };

    const merged = mergeRecovery(parserResult, aiRecovery);

    // Items should NOT contain category prefix — they must be clean atomic names
    expect(merged.parsed.skills).toContain("libraries");
    expect(merged.parsed.skills).toContain("frameworks");
    expect(merged.parsed.skills).toContain("React");
    expect(merged.parsed.skills).toContain("TypeScript");
    // No residual prefix forms
    expect(merged.parsed.skills).not.toContain("Testing: libraries");
    expect(merged.parsed.skills).not.toContain("Testing: frameworks");
    expect(merged.parsed.skills).not.toContain("Frontend: React");
    // "TypeScript" has no colon prefix, stays as-is
    expect(merged.parsed.skills).toHaveLength(4);
  });
});

describe("mergeRecovery bullet normalization", () => {
  it("normalizes recovered experience bullets before returning merged data", () => {
    const parserResult = makeParseResult({
      parsed: {
        contact: { fullName: "Test", email: "test@example.com", phone: "", location: "", website: "" },
        summary: "",
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        professionalQualities: [],
        projects: [],
      },
      coverage: [makeCoverageItem("experience", 0.2, 4, 40)],
    });

    const merged = mergeRecovery(parserResult, {
      experience: [
        {
          role: "Developer",
          company: "Example Co",
          start: "2021",
          end: "Present",
          bullets: [
            "Participated in daily stand-ups and feature estimation meetings to ensure project",
            "timelines were met.",
            "Installed and maintained computer systems and secured company data through\n\u25cf Managed IT procurement and deployment of equipment and software.",
          ],
        },
      ],
    });

    expect(merged.parsed.experience?.[0]?.bullets).toEqual([
      "Participated in daily stand-ups and feature estimation meetings to ensure project timelines were met.",
      "Installed and maintained computer systems and secured company data through",
      "Managed IT procurement and deployment of equipment and software.",
    ]);
  });
});