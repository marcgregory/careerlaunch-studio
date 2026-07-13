import { describe, expect, it } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";

describe("skills-before-experience imports", () => {
  it("does not stop later experience section detection after a skills block", () => {
    const result = parseResumeText([
      "Jordan Smith",
      "jordan@example.com",
      "",
      "SKILLS",
      "JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker",
      "",
      "EXPERIENCE",
      "Senior Developer",
      "Acme Corp",
      "Jun 2021 - Present",
      "- Built internal workflow tooling used by support and operations teams.",
      "- Improved deployment reliability by adding automated smoke checks.",
      "",
      "Education",
      "B.S. Software Engineering - Metro University, 2020",
    ].join("\n"));

    const experience = result.parsed.experience || [];

    expect(result.layouts).toContain("skills-before-experience");
    expect(result.parsed.skills).toContain("TypeScript");
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        role: "Senior Developer",
        company: "Acme Corp",
        start: "Jun 2021",
        end: "Present",
      }),
    );
    expect(experience[0].bullets).toEqual([
      "Built internal workflow tooling used by support and operations teams.",
      "Improved deployment reliability by adding automated smoke checks.",
    ]);
  });
});
