/**
 * Generate expected JSON sidecars for each resume fixture.
 * Run: npx tsx packages/ai/scripts/generate-fixtures.ts
 *
 * After an intentional parser change, run this to update golden files:
 *   npx tsx packages/ai/scripts/generate-fixtures.ts
 * Then review the diff of each .expected.json before committing.
 */
import { parseResumeText } from "../src/import/text-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "..", "__fixtures__");

const fixtureFiles = fs
  .readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".txt"))
  .sort();

for (const fixture of fixtureFiles) {
  const text = fs.readFileSync(path.join(fixturesDir, fixture), "utf-8");
  const result = parseResumeText(text);

  const expectedPath = path.join(
    fixturesDir,
    fixture.replace(/\.txt$/, ".expected.json"),
  );
  fs.writeFileSync(expectedPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Generated ${path.basename(expectedPath)}`);
}
