import { describe, expect, it } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";

describe("pipe-formatted experience imports", () => {
  it("maps date-first pipe rows to start/end, role, company, and bullets", () => {
    const result = parseResumeText([
      "Alex Parker",
      "alex@example.com",
      "",
      "Experience",
      "Jun 2021 - Present | Senior Developer | Acme Corp",
      "- Led platform modernization across billing and account services.",
      "- Mentored 4 developers through release planning and code reviews.",
      "",
      "Education",
      "B.S. Computer Science - State University, 2020",
      "",
      "Skills",
      "TypeScript, React, Node.js, PostgreSQL, AWS",
    ].join("\n"));

    const experience = result.parsed.experience || [];

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
      "Led platform modernization across billing and account services.",
      "Mentored 4 developers through release planning and code reviews.",
    ]);
    expect(result.layouts).toContain("pipe-experience");
  });
});
