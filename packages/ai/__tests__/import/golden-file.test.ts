import { describe, it, expect } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  Golden-file regression test suite                                  */
/* ------------------------------------------------------------------ */

const fixturesDir = path.resolve(__dirname, "..", "..", "__fixtures__");

/**
 * Load all fixture .txt files, find matching .expected.json sidecars,
 * and assert parser output matches.
 */
const fixtureFiles = fs
  .readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".txt"))
  .sort();

describe("parseResumeText golden files", () => {
  for (const fixture of fixtureFiles) {
    const expectedPath = fixture.replace(/\.txt$/, ".expected.json");
    const expectedExist = fs.existsSync(path.join(fixturesDir, expectedPath));

    // Register a test even when the .expected.json is missing, so it shows
    // up as a known failure rather than silently being skipped.
    it(`should parse ${fixture} correctly`, () => {
      if (!expectedExist) {
        // Fresh fixture without golden file → generate one and fail so CI
        // catches it. The developer runs the generator to create the sidecar.
        const text = fs.readFileSync(path.join(fixturesDir, fixture), "utf-8");
        const result = parseResumeText(text);
        fs.writeFileSync(
          path.join(fixturesDir, expectedPath),
          JSON.stringify(result, null, 2) + "\n",
        );
        expect(expectedExist, [
          `No .expected.json sidecar found for ${fixture}.`,
          `A sidecar was auto-generated from current parser output.`,
          `Review ${expectedPath} and commit it if the output looks correct.`,
        ].join("\n")).toBe(true);
        return;
      }

      const text = fs.readFileSync(path.join(fixturesDir, fixture), "utf-8");
      const expectedRaw = fs.readFileSync(
        path.join(fixturesDir, expectedPath),
        "utf-8",
      );
      const expected = JSON.parse(expectedRaw);

      const result = parseResumeText(text);

      // Normalize experience item IDs are deterministic (import-exp-N) so
      // they match exactly — no need for loose matching.
      expect(result).toEqual(expected);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Guardrail-specific parser tests                                  */
  /* ---------------------------------------------------------------- */

  it("should not extract 'mail.com' as a website (guardrail: no mail.com artifact)", () => {
    const text = [
      "John Doe",
      "johndoe@gmail.com",
      "Software Developer",
      "",
      "Experience",
      "Company - 2020-Present",
      "- Did stuff.",
    ].join("\n");
    const result = parseResumeText(text);
    // email should be parsed from the line containing gmail.com
    expect(result.parsed.contact?.email).toBe("johndoe@gmail.com");
    // website should NOT be the mail.com domain
    expect(result.parsed.contact?.website).not.toMatch(/mail\.com/);
    // website should be empty since the text has no personal website
    expect(result.parsed.contact?.website).toBe("");
  });

  it("should not produce broken skills like 'Testing' + 'libraries' as separate items (guardrail: no broken skills)", () => {
    // When multiple contiguous spaces or table layout exist, the parser
    // extracts the last column only, not intermediate fragments.
    const text = [
      "Skills",
      "Testing Tools:  Jest, Vitest, Playwright",
      "Languages:     TypeScript, SQL",
      "",
      "Experience",
      "Acme - 2020-Present",
      "- Work.",
    ].join("\n");
    const result = parseResumeText(text);
    const skills = result.parsed.skills ?? [];
    // Each skill name should be a recognizable technology, not a fragment
    for (const skill of skills) {
      expect(skill.length).toBeGreaterThan(2);
    }
    // No word standing alone that looks like a classification label
    expect(skills).not.toContain("Testing");
    expect(skills).not.toContain("Tools");
    // Actual skill values should be present
    expect(skills).toContain("Testing Tools: Jest");
    expect(skills).toContain("Testing Tools: Vitest");
    expect(skills).toContain("Testing Tools: Playwright");
    expect(skills).toContain("Languages: TypeScript");
    expect(skills).toContain("Languages: SQL");
  });

  it("should omit empty Certifications section from coverage (guardrail: no empty sections)", () => {
    const text = [
      "Jane Smith",
      "jane@example.com",
      "",
      "Professional Summary",
      "Experienced developer.",
      "",
      "Experience",
      "Company - 2020-Present",
      "- Built things.",
      "",
      "Education",
      "BS Computer Science, University X, 2020",
      "",
      "Skills",
      "JavaScript, Python",
    ].join("\n");
    const result = parseResumeText(text);
    // No certifications section header was found → coverage should be empty
    const certCoverage = result.coverage.find((c) => c.sectionId === "certifications");
    // Since certifications wasn't detected, originalWordCount should be 0
    expect(certCoverage?.originalWordCount ?? 0).toBe(0);
    // Certifications array should be empty
    expect(result.parsed.certifications).toHaveLength(0);
  });

  it("should render Professional Qualities as individual items (guardrail: bullet-style rendering)", () => {
    const text = [
      "John Q",
      "john@example.com",
      "",
      "Professional Qualities",
      "Strong leadership",
      "Excellent written communication",
      "Team collaboration",
      "",
      "Experience",
      "Acme Corp - 2020-Present",
      "- Work.",
    ].join("\n");
    const result = parseResumeText(text);
    const quals = result.parsed.professionalQualities ?? [];
    // Each quality should be a separate item
    expect(quals.length).toBeGreaterThanOrEqual(3);
    expect(quals).toContain("Strong leadership");
    expect(quals).toContain("Excellent written communication");
    // No joined-string artifact: no "·" separator embedded in any item
    for (const q of quals) {
      expect(q).not.toMatch(/·/);
      expect(q).not.toMatch(/\s{2,}·\s{2,}/);
    }
  });

  it("should have expected sidecars for every fixture file", () => {
    const fixtures = fixtureFiles;
    const sidecars = fs
      .readdirSync(fixturesDir)
      .filter((f) => f.endsWith(".expected.json"))
      .map((f) => f.replace(/\.expected\.json$/, ".txt"));

    const missing = fixtures.filter((f) => !sidecars.includes(f));
    const extra = sidecars.filter((f) => !fixtures.includes(f));

    const messages: string[] = [];
    if (missing.length > 0) {
      messages.push(
        `Fixtures without expected output: ${missing.join(", ")}\n` +
          "  Run: npx tsx packages/ai/scripts/generate-fixtures.ts",
      );
    }
    if (extra.length > 0) {
      messages.push(
        `Orphaned sidecars (no matching fixture): ${extra.join(", ")}`,
      );
    }

    expect(messages, messages.join("\n")).toHaveLength(0);
  });
});
