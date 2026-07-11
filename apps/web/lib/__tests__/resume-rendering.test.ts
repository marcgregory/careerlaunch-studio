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

    const languagesBranch = Math.max(
      renderSectionBody.indexOf('if (section === "languages")'),
      renderSectionBody.indexOf("if (section === 'languages')"),
    );
    const projectsBranch = renderSectionBody.indexOf('if (section === "projects")');
    const finalNull = renderSectionBody.lastIndexOf("return null;");

    expect(languagesBranch).toBeGreaterThan(-1);
    expect(projectsBranch).toBeGreaterThan(languagesBranch);
    expect(finalNull).toBeGreaterThan(projectsBranch);
  });

  it("renders achievements as list items and uses a real middle dot for reference contact", () => {
    const reactSource = readFileSync(
      resolve(process.cwd(), "../../packages/rendering/src/index.tsx"),
      "utf8",
    );
    const pdfSource = readFileSync(
      resolve(process.cwd(), "../../packages/rendering/src/pdf.tsx"),
      "utf8",
    );

    expect(reactSource).toContain("title='Achievements' items={resume.achievements}");
    expect(reactSource).toContain("title='Professional Qualities' items={resume.professionalQualities}");
    expect(reactSource).toContain("<ul className='mt-3 list-disc");
    expect(reactSource).toContain('join(" · ")');
    expect(pdfSource).toContain('join(" · ")');
    expect(reactSource + pdfSource).not.toContain("\u00e2\u20ac\u201d");
    expect(reactSource + pdfSource).not.toContain("\u00c2\u00b7");
  });
});
