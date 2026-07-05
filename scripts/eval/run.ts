/**
 * CareerLaunch Studio — AI Quality Evaluation Suite
 *
 * Runs automated evaluations against a dataset of resumes and job descriptions.
 * Tests all 3 AI modules: job analysis, gap analysis, and tailoring.
 *
 * Usage:
 *   npm run eval
 *   npm run eval -- --gap        # Only gap analysis
 *   npm run eval -- --tailor     # Only tailoring
 *   npm run eval -- --analysis   # Only job analysis
 *   npm run eval -- --ai         # Also run with configured AI provider
 *   npm run eval -- --json       # Output as JSON
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reportConsole } from "./reporters/console";
import { reportJSON } from "./reporters/json";
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

// ─── Types ───────────────────────────────────────────────────────────────

export interface EvalResult {
  testCase: string;
  mode: string;
  passed: boolean;
  durationMs: number;
  errors: string[];
  output?: Record<string, unknown>;
}

interface EvalResume extends NormalizedResume {
  id: string;
  label: string;
}

interface EvalJobDescription {
  id: string;
  label: string;
  text: string;
}

// ─── Load datasets ───────────────────────────────────────────────────────

function loadDataset<T>(filename: string): T[] {
  const dir = join(__dirname, "datasets");
  const path = join(dir, filename);

  if (!existsSync(path)) {
    console.error(`Dataset not found: ${path}`);
    console.error("Run from the project root: npm run eval");
    process.exit(1);
  }

  return JSON.parse(readFileSync(path, "utf-8")) as T[];
}

// ─── Validators ──────────────────────────────────────────────────────────

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

async function run() {
  const args = process.argv.slice(2);
  const modes: string[] = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--") ));
  const useAI = flags.has("--ai");
  const jsonOutput = flags.has("--json");

  const resumeMap = new Map<string, EvalResume>();
  for (const r of loadDataset<EvalResume>("resumes.json")) {
    resumeMap.set(r.id, r);
  }

  const jds = loadDataset<EvalJobDescription>("job-descriptions.json");

  const results: EvalResult[] = [];

  for (const jd of jds) {
    // Find matching resume (same index/number)
    const resumeId = jd.id.replace("jd-", "resume-");
    const resume = resumeMap.get(resumeId);
    if (!resume) {
      console.warn(`  ⚠ No matching resume for ${jd.id} (expected ${resumeId})`);
      continue;
    }

    const testCase = `${resume.label} vs ${jd.label}`;
    // Fixtures are stored in NormalizedResume format, but normalizeResume
    // expects ResumeDocument (experience/education arrays). Bypass the
    // conversion for eval fixtures and construct the object directly.
    const normalized: NormalizedResume = {
      contact: resume.contact,
      summary: resume.summary,
      sections: resume.sections ?? [],
      skills: resume.skills ?? [],
      certifications: resume.certifications ?? [],
      projects: (resume.projects ?? []).map((p: any) => ({
        name: p.name ?? "",
        description: p.description ?? "",
        bullets: p.bullets ?? [],
      })),
    };

    // Phase 1: Job Analysis
    {
      const start = Date.now();
      let errors: string[] = [];
      try {
        const result = deterministicAnalyzeJob({ jobDescription: jd.text });
        errors = validateJobAnalysis(result);
      } catch (e) {
        errors = [String(e)];
      }
      results.push({
        testCase,
        mode: "analysis",
        passed: errors.length === 0,
        durationMs: Date.now() - start,
        errors,
      });
    }

    // Phase 2: Gap Analysis
    {
      const start = Date.now();
      let errors: string[] = [];
      try {
        const ja = deterministicAnalyzeJob({ jobDescription: jd.text });
        const result = deterministicGapAnalysis({
          resume: normalized,
          jobAnalysis: ja,
          jobDescription: jd.text,
        });
        errors = validateGapAnalysis(result);
      } catch (e) {
        errors = [String(e)];
      }
      results.push({
        testCase,
        mode: "gap",
        passed: errors.length === 0,
        durationMs: Date.now() - start,
        errors,
      });
    }

    // Phase 3: Tailoring
    {
      const start = Date.now();
      let errors: string[] = [];
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
        errors = validateTailoring(suggestions);
      } catch (e) {
        errors = [String(e)];
      }
      results.push({
        testCase,
        mode: "tailor",
        passed: errors.length === 0,
        durationMs: Date.now() - start,
        errors,
      });
    }

    // AI-powered runs (optional)
    if (useAI) {
      // Phase 1: AI Job Analysis
      {
        const start = Date.now();
        let errors: string[] = [];
        try {
          const { runJobAnalysis } = await import("@careerlaunch/ai");
          const result = await runJobAnalysis({ jobDescription: jd.text });
          errors = validateJobAnalysis(result);
        } catch (e) {
          errors = [String(e)];
        }
        results.push({
          testCase,
          mode: "ai-analysis",
          passed: errors.length === 0,
          durationMs: Date.now() - start,
          errors,
        });
      }

      // Phase 2: AI Gap Analysis
      {
        const start = Date.now();
        let errors: string[] = [];
        try {
          const { runGapAnalysis, runJobAnalysis } = await import("@careerlaunch/ai");
          const ja = await runJobAnalysis({ jobDescription: jd.text });
          const result = await runGapAnalysis({
            resume: normalized,
            jobAnalysis: ja,
            jobDescription: jd.text,
          });
          errors = validateGapAnalysis(result);
        } catch (e) {
          errors = [String(e)];
        }
        results.push({
          testCase,
          mode: "ai-gap",
          passed: errors.length === 0,
          durationMs: Date.now() - start,
          errors,
        });
      }
    }
  }

  if (jsonOutput) {
    reportJSON(results);
  } else {
    reportConsole(results);
  }

  // Exit with non-zero if any test failed
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Eval suite failed:", err);
  process.exit(1);
});
