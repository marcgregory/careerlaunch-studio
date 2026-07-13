/**
 * CareerLaunch Studio — Dogfooding Test Matrix Runner
 *
 * Executes the automated pipeline portion of the dogfooding test matrix.
 * This covers the AI analysis, gap analysis, and tailoring steps for each
 * of the 6 fixed personas.
 *
 * The full dogfooding workflow (import, UI interaction, billing verification)
 * requires manual execution through the browser — this script validates the
 * data pipeline layer.
 *
 * Usage:
 *   npm run eval:dogfooding
 *   npm run eval:dogfooding -- --json    # JSON output for CI
 *
 * Severity labels (assigned manually during UI walkthrough):
 *   Critical — app crash, data loss, core flow broken, AI hallucinates credentials
 *   High     — feature unusable, wrong output, wrong PDF content
 *   Medium   — feature works but has clear UX problems
 *   Low      — cosmetic issues, edge cases, minor copy
 *
 * Release gate:
 *   Critical: 0 | High: 0 | Medium: <=5 | Low: unlimited
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireRealAIProvider } from "../provider-preflight";
import {
  deterministicAnalyzeJob,
  deterministicGapAnalysis,
  deterministicTailor,
} from "@careerlaunch/ai";
import type {
  NormalizedResume,
  JobAnalysis,
  GapAnalysis,
  TailorSuggestion,
} from "@careerlaunch/ai";

// ─── Constants ────────────────────────────────────────────────────────────

const DOGFOODING_RESUME_IDS = new Set([
  "resume-16",
  "resume-17",
  "resume-18",
  "resume-19",
  "resume-20",
  "resume-21",
]);

const PERSONA_NAMES: Record<string, string> = {
  "resume-16": "Junior Frontend Developer",
  "resume-17": "Senior Backend Engineer",
  "resume-18": "WordPress Developer",
  "resume-19": "Marketing Specialist",
  "resume-20": "Graphic Designer",
  "resume-21": "Customer Support Specialist",
};

interface PersonaTestResult {
  persona: string;
  personaId: string;
  jobLabel: string;
  pipelineResults: {
    analysis: boolean;
    gapAnalysis: boolean;
    tailoring: boolean;
  };
  errors: string[];
  timingMs: number;
}

// ─── Load datasets ────────────────────────────────────────────────────────

function loadDataset<T>(filename: string): T[] {
  const dir = join(__dirname, "..", "datasets");
  const path = join(dir, filename);
  if (!existsSync(path)) {
    console.error(`Dataset not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as T[];
}

// ─── Validators ───────────────────────────────────────────────────────────

function validateJobAnalysis(result: JobAnalysis): string[] {
  const errors: string[] = [];
  if (!Array.isArray(result.requiredSkills)) errors.push("requiredSkills is not an array");
  if (!Array.isArray(result.preferredSkills)) errors.push("preferredSkills is not an array");
  if (!Array.isArray(result.responsibilities)) errors.push("responsibilities is not an array");
  if (!Array.isArray(result.atsKeywords)) errors.push("atsKeywords is not an array");
  if (!["entry", "mid", "senior", "lead", "executive", "unknown"].includes(result.seniority)) {
    errors.push(`invalid seniority: ${result.seniority}`);
  }
  return errors;
}

function validateGapAnalysis(result: GapAnalysis): string[] {
  const errors: string[] = [];
  if (typeof result.matchScore !== "number") errors.push("matchScore is not a number");
  if (result.matchScore < 0 || result.matchScore > 100) errors.push("matchScore out of range 0-100");
  if (!Array.isArray(result.matchedSkills)) errors.push("matchedSkills is not an array");
  if (!Array.isArray(result.missingSkills)) errors.push("missingSkills is not an array");
  if (!Array.isArray(result.weakSections)) errors.push("weakSections is not an array");
  if (!Array.isArray(result.recommendations)) errors.push("recommendations is not an array");
  return errors;
}

function validateTailoring(suggestions: TailorSuggestion[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(suggestions)) return ["suggestions is not an array"];
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    if (!s.id) errors.push(`suggestion[${i}] missing id`);
    if (!["summary", "experience", "skills"].includes(s.category)) {
      errors.push(`suggestion[${i}] invalid category: ${s.category}`);
    }
    if (typeof s.confidence !== "number" || s.confidence < 0 || s.confidence > 1) {
      errors.push(`suggestion[${i}] confidence out of range`);
    }
    if (!s.reason) errors.push(`suggestion[${i}] missing reason`);
  }
  return errors;
}

// ─── Runner ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  requireRealAIProvider();

  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");

  const resumeMap = new Map<string, NormalizedResume & { label: string }>();
  const allResumes = loadDataset<any>("resumes.json");
  for (const r of allResumes) {
    if (DOGFOODING_RESUME_IDS.has(r.id)) {
      resumeMap.set(r.id, r);
    }
  }

  const jds = loadDataset<any>("job-descriptions.json");

  const results: PersonaTestResult[] = [];

  for (const [resumeId, resume] of resumeMap) {
    const personaName = PERSONA_NAMES[resumeId] ?? resume.label;
    const jdId = resumeId.replace("resume-", "jd-");
    const jd = jds.find((j: any) => j.id === jdId);

    if (!jd) {
      results.push({
        persona: personaName,
        personaId: resumeId,
        jobLabel: "(no matching JD)",
        pipelineResults: { analysis: false, gapAnalysis: false, tailoring: false },
        errors: [`No matching job description found for ${jdId}`],
        timingMs: 0,
      });
      continue;
    }

    const allErrors: string[] = [];
    const pipelineResults = { analysis: false, gapAnalysis: false, tailoring: false };
    const start = Date.now();

    // Normalize resume (fixtures are stored directly in NormalizedResume format)
    const normalized: NormalizedResume = {
      contact: resume.contact,
      summary: resume.summary,
      sections: resume.sections,
      skills: resume.skills,
      certifications: resume.certifications,
      projects: resume.projects.map((p: any) => ({
        name: p.name ?? "",
        description: p.description ?? "",
        bullets: p.bullets ?? [],
      })),
    };

    // Step 1: Job Analysis
    try {
      const ja = deterministicAnalyzeJob({ jobDescription: jd.text });
      const errors = validateJobAnalysis(ja);
      pipelineResults.analysis = errors.length === 0;
      if (errors.length > 0) allErrors.push(`Analysis: ${errors.join("; ")}`);
    } catch (e) {
      allErrors.push(`Analysis: ${String(e)}`);
    }

    // Step 2: Gap Analysis
    try {
      const ja = deterministicAnalyzeJob({ jobDescription: jd.text });
      const ga = deterministicGapAnalysis({
        resume: normalized,
        jobAnalysis: ja,
        jobDescription: jd.text,
      });
      const errors = validateGapAnalysis(ga);
      pipelineResults.gapAnalysis = errors.length === 0;
      if (errors.length > 0) allErrors.push(`Gap: ${errors.join("; ")}`);
    } catch (e) {
      allErrors.push(`Gap: ${String(e)}`);
    }

    // Step 3: Tailoring
    try {
      const ja = deterministicAnalyzeJob({ jobDescription: jd.text });
      const ga = deterministicGapAnalysis({
        resume: normalized,
        jobAnalysis: ja,
        jobDescription: jd.text,
      });
      const suggestions = deterministicTailor({
        resume: normalized,
        jobAnalysis: ja,
        gapAnalysis: ga,
      });
      const errors = validateTailoring(suggestions);
      pipelineResults.tailoring = errors.length === 0;
      if (errors.length > 0) allErrors.push(`Tailoring: ${errors.join("; ")}`);
    } catch (e) {
      allErrors.push(`Tailoring: ${String(e)}`);
    }

    results.push({
      persona: personaName,
      personaId: resumeId,
      jobLabel: jd.label,
      pipelineResults,
      errors: allErrors,
      timingMs: Date.now() - start,
    });
  }

  // ─── Output ──────────────────────────────────────────────────────────

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("\n\x1b[1m═══════════════════════════════════════════════════════\x1b[0m");
    console.log("  Dogfooding Test Matrix — Pipeline Results");
    console.log("\x1b[1m═══════════════════════════════════════════════════════\x1b[0m\n");

    let allPassed = true;
    for (const r of results) {
      const status = r.errors.length === 0 ? "✅ PASS" : "❌ FAIL";
      if (r.errors.length > 0) allPassed = false;

      console.log(`  ${r.persona}`);
      console.log(`  Target: ${r.jobLabel}`);
      console.log(`  Status: ${status}`);
      console.log(`  Time:   ${r.timingMs}ms`);
      console.log(`  Steps:`);
      console.log(`    Analysis:    ${r.pipelineResults.analysis ? "✅" : "❌"}`);
      console.log(`    Gap Analysis: ${r.pipelineResults.gapAnalysis ? "✅" : "❌"}`);
      console.log(`    Tailoring:    ${r.pipelineResults.tailoring ? "✅" : "❌"}`);
      if (r.errors.length > 0) {
        console.log(`  Errors:`);
        for (const e of r.errors) console.log(`    • ${e}`);
      }
      console.log("");
    }

    const passed = results.filter((r) => r.errors.length === 0).length;
    console.log(`  ${passed}/${results.length} personas passed pipeline check`);
    console.log("\x1b[1m═══════════════════════════════════════════════════════\x1b[0m\n");

    if (!allPassed) process.exit(1);
  }
}

run().catch((err) => {
  console.error("Dogfooding runner failed:", err);
  process.exit(1);
});
