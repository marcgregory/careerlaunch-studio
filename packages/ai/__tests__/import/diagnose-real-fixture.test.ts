/**
 * ROOT CAUSE DIAGNOSTIC — Real Fixture Pipeline Trace
 *
 * Runs the EXACT fixture text through EVERY transformation stage
 * and dumps the output at each stage to find where corruption starts.
 *
 * Stages:
 *   1. Raw fixture text (as loaded from file → POST body)
 *   2. parseResumeText() → ParseResult
 *   3. normalizeResume() → ResumeDocument (what gets persisted)
 *   4. Preview normalization → what the UI renders
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeResume } from "../../../../apps/web/lib/resume-store";
import { parseResumeText } from "../../src/import/text-parser";

// We need to simulate normalizeResume — import it from the web app
// For now, inline the relevant normalization logic

function log(prefix: string, obj: unknown): void {
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  ${prefix}`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(JSON.stringify(obj, null, 2));
}

describe("REAL FIXTURE: Full Pipeline Trace", () => {
  const fixturePath = join(
    __dirname,
    "..",
    "..",
    "__fixtures__",
    "resume-marc-style.txt",
  );
  const rawText = readFileSync(fixturePath, "utf-8");

  it("STAGE 1: Raw fixture text", () => {
    log("Raw text from resume-marc-style.txt", rawText);
    log("Raw text length", rawText.length);

    // Check critical lines
    const lines = rawText.split("\n");
    log("Line count", lines.length);

    // Find specific lines
    const standupsIdx = lines.findIndex((l) => l.includes("stand-ups"));
    log("Line with 'stand-ups'", {
      index: standupsIdx,
      content: standupsIdx >= 0 ? lines[standupsIdx] : "NOT FOUND",
      previous: standupsIdx > 0 ? lines[standupsIdx - 1] : "N/A",
      next: standupsIdx >= 0 && standupsIdx < lines.length - 1 ? lines[standupsIdx + 1] : "N/A",
    });

    // Check if the full text "Participated in daily stand-ups and feature estimation
    // meetings to ensure project timelines were met." appears intact
    const fullBulletText =
      "Participated in daily stand-ups and feature estimation meetings to ensure project timelines were met.";
    const foundFull = rawText.includes(fullBulletText);
    log("Full bullet text present in raw input", {
      found: foundFull,
      text: fullBulletText,
    });

    const installedIdx = lines.findIndex((l) =>
      l.includes("Installed and maintained"),
    );
    log("Line with 'Installed and maintained'", {
      index: installedIdx,
      content: installedIdx >= 0 ? lines[installedIdx] : "NOT FOUND",
      next: installedIdx >= 0 && installedIdx < lines.length - 1 ? lines[installedIdx + 1] : "N/A",
    });

    const phpWordPressIdx = lines.findIndex((l) => l.includes("PHP WordPress"));
    log("Line with 'PHP WordPress'", {
      index: phpWordPressIdx,
      content: phpWordPressIdx >= 0 ? lines[phpWordPressIdx] : "NOT FOUND",
    });
  });

  it("STAGE 2: parseResumeText output", () => {
    const result = parseResumeText(rawText);
    log("ParseResult metadata", {
      importQuality: result.importQuality,
      confidence: result.confidence,
      warnings: result.warnings,
      layouts: result.layouts,
    });

    log("Coverage", result.coverage.map((c) => ({
      id: c.sectionId,
      ratio: c.ratio,
      original: c.originalWordCount,
      parsed: c.parsedWordCount,
      status: c.status,
    })));

    // Check timeline bullet
    const allBullets = (result.parsed.experience ?? []).flatMap((e) => e.bullets);
    log("All experience bullets", allBullets);

    const timelineBullet = allBullets.find((b) =>
      b.includes("timelines were met") || b.includes("stand-ups"),
    );
    log("Timeline bullet found in parsed output", {
      found: !!timelineBullet,
      text: timelineBullet ?? "NOT FOUND",
    });

    // Check "network security measures"
    const securityBullet = allBullets.find((b) =>
      b.includes("network security measures") || b.includes("secured company data"),
    );
    log("Security bullet found in parsed output", {
      found: !!securityBullet,
      text: securityBullet ?? "NOT FOUND",
    });

    // Check for orphaned lines
    const orphanLines = allBullets.filter(
      (b) =>
        b === "timelines were met." ||
        b === "timelines were met" ||
        b === "network security measures." ||
        b.startsWith("network security measures"),
    );
    log("Orphaned lines in parsed output", {
      count: orphanLines.length,
      items: orphanLines,
    });

    // Check skills
    log("All parsed skills", result.parsed.skills);

    // Check for "Custom Queries" split
    const customQueriesSplit = result.parsed.skills?.filter(
      (s) => s.includes("Custom") || s === "Queries",
    );
    log("Custom/Queries in skills", {
      items: customQueriesSplit,
    });

    // Check backend skills count
    const backendSkills = result.parsed.skills?.filter(
      (s) => s.startsWith("Backend:"),
    );
    log("Backend skills count", {
      count: backendSkills?.length ?? 0,
      items: backendSkills,
    });

    // Total skills
    log("Total skills count", {
      total: result.parsed.skills?.length ?? 0,
    });
  });

  it("STAGE 3: Check each experience entry in detail", () => {
    const result = parseResumeText(rawText);
    const experiences = result.parsed.experience ?? [];

    log("All experience entries", experiences.length);

    experiences.forEach((exp, i) => {
      log(`Experience entry ${i}: ${exp.role} @ ${exp.company}`, {
        role: exp.role,
        company: exp.company,
        start: exp.start,
        end: exp.end,
        bulletCount: exp.bullets.length,
        bullets: exp.bullets,
      });

      // Check for the problematic bullet pattern
      exp.bullets.forEach((b, bi) => {
        if (b.includes("through") && !b.includes("network security")) {
          log(`  Bullet ${bi} ends with 'through'?`, {
            bullet: b,
            endsWithThrough: b.trim().endsWith("through"),
          });
        }
        if (b.startsWith("through") || b.startsWith("with") || b.startsWith("and")) {
          log(`  Bullet ${bi} starts with continuation word`, {
            bullet: b,
          });
        }
      });
    });
  });

  it("STAGE 4: Section boundary detection", () => {
    const result = parseResumeText(rawText); // Uses internal detectSections

    // Check section boundaries indirectly through the coverage report
    log("Detected sections", {
      summary: result.parsed.summary ? "present" : "missing",
      experience: `${result.parsed.experience?.length ?? 0} entries`,
      education: `${result.parsed.education?.length ?? 0} entries`,
      skills: `${result.parsed.skills?.length ?? 0} items`,
      certifications: `${result.parsed.certifications?.length ?? 0} items`,
      professionalQualities: `${result.parsed.professionalQualities?.length ?? 0} items`,
    });

    // Check what's in coverage (shows which sections were detected)
    const detectedSections = result.coverage
      .filter((c) => c.originalWordCount > 0)
      .map((c) => `${c.sectionId} (${c.originalWordCount} words)`);
    log("Sections with content", detectedSections);
  });
});
