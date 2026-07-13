import { describe, expect, it } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";

function getImportQualityReportDescription(result: ReturnType<typeof parseResumeText>): string {
  if ((result.parsed.experience || []).length === 0) {
    return "Work history was not imported. Review the original file and add the missing roles before continuing.";
  }

  if (result.importQuality === "excellent" || result.importQuality === "good") {
    return "Everything looks good. You can create a polished draft right away.";
  }

  return "Some sections need review before continuing.";
}

describe("import quality report", () => {
  it("lowers confidence and never reports everything looks good when work history is lost", () => {
    const result = parseResumeText([
      "Morgan Lee",
      "morgan@example.com",
      "",
      "Experience",
      "This section mentions delivery leadership but has no role, company, or dates.",
      "Managed platform work and stakeholder communication.",
      "",
      "Education",
      "B.A. Communication - State University, 2018",
      "",
      "Skills",
      "Planning, Communication, Analytics, Documentation, Facilitation",
    ].join("\n"));

    expect(result.parsed.experience || []).toHaveLength(0);
    expect(result.confidence).toBeLessThan(90);
    expect(result.importQuality).not.toMatch(/^(excellent|good)$/);
    expect(getImportQualityReportDescription(result)).not.toContain("Everything looks good");
  });
});
