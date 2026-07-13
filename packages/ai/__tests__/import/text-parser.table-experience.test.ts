import { describe, expect, it } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";

describe("table-formatted work-history imports", () => {
  it("keeps pipe table work-history rows instead of discarding them", () => {
    const result = parseResumeText([
      "Taylor Chen",
      "taylor@example.com",
      "",
      "Work History",
      "Dates | Title | Employer | Highlights",
      "Jun 2021 - Present | Senior Developer | Acme Corp | Led platform modernization; Mentored 4 developers",
      "Jan 2019 - May 2021 | Developer | Beta LLC | Built customer dashboards; Reduced defect backlog",
      "",
      "Education",
      "B.S. Computer Science - State University, 2018",
      "",
      "Skills",
      "TypeScript, React, Node.js, PostgreSQL, AWS",
    ].join("\n"));

    const experience = result.parsed.experience || [];

    expect(experience).toHaveLength(2);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        role: "Senior Developer",
        company: "Acme Corp",
        start: "Jun 2021",
        end: "Present",
      }),
    );
    expect(experience[0].bullets).toEqual([
      "Led platform modernization",
      "Mentored 4 developers",
    ]);
    expect(experience[1]).toEqual(
      expect.objectContaining({
        role: "Developer",
        company: "Beta LLC",
        start: "Jan 2019",
        end: "May 2021",
      }),
    );
    expect(experience[1].bullets).toEqual([
      "Built customer dashboards",
      "Reduced defect backlog",
    ]);
    expect(result.layouts).toContain("pipe-experience");
    expect(result.layouts).toContain("table-format");
  });
});
