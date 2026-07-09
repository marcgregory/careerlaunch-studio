import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ResumePreview section rendering source guard", () => {
  it("does not fall through unsupported sections to Projects", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../../packages/rendering/src/index.tsx"),
      "utf8",
    );
    const renderSectionBody = source.slice(
      source.indexOf("function renderSection("),
      source.indexOf("function ResumeHeading("),
    );

    expect(renderSectionBody).toContain('if (section === "projects")');
    expect(renderSectionBody).toContain("<ProjectsSection key={section}");

    const languagesBranch = renderSectionBody.indexOf('if (section === "languages")');
    const projectsBranch = renderSectionBody.indexOf('if (section === "projects")');
    const finalNull = renderSectionBody.lastIndexOf("return null;");

    expect(languagesBranch).toBeGreaterThan(-1);
    expect(projectsBranch).toBeGreaterThan(languagesBranch);
    expect(finalNull).toBeGreaterThan(projectsBranch);
  });
});