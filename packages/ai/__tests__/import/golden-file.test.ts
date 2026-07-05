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
