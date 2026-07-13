/**
 * CareerLaunch Studio - Sprint 6D AI dogfooding release gate.
 * Validates real Gemini/Groq calls for each dogfooding persona.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  measuredProviderCall,
  normalizeFixtureResume,
  requireRealProvider,
  validateProviderCoverLetter,
  validateProviderJobMatch,
  writeGateReport,
  type ProviderCallMetadata,
} from "../release-gate";
import type { NormalizedResume } from "@careerlaunch/ai";

const DOGFOODING_RESUME_IDS = new Set(["resume-16", "resume-17", "resume-18", "resume-19", "resume-20", "resume-21"]);

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
  provider: string;
  model: string;
  pipelineResults: {
    jobMatch: boolean;
    coverLetter: boolean;
  };
  errors: string[];
  timingMs: number;
}

function loadDataset<T>(filename: string): T[] {
  const path = join(__dirname, "..", "datasets", filename);
  if (!existsSync(path)) throw new Error(`Dataset not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf-8")) as T[];
}

async function run(): Promise<void> {
  const selection = await requireRealProvider();
  const allResumes = loadDataset<any>("resumes.json");
  const jds = loadDataset<any>("job-descriptions.json");
  const jdMap = new Map(jds.map((j: any) => [j.id, j]));
  const calls: ProviderCallMetadata[] = [];
  const results: PersonaTestResult[] = [];

  for (const resume of allResumes.filter((r: any) => DOGFOODING_RESUME_IDS.has(r.id))) {
    const start = Date.now();
    const normalized: NormalizedResume = normalizeFixtureResume(resume);
    const jd = jdMap.get(resume.id.replace("resume-", "jd-"));
    const errors: string[] = [];
    const pipelineResults = { jobMatch: false, coverLetter: false };

    if (!jd) {
      errors.push(`No matching job description found for ${resume.id}`);
    } else {
      try {
        const { result, metadata } = await measuredProviderCall(
          selection,
          `${resume.id}.matchJob`,
          async (provider) => {
            if (!provider.matchJob) throw new Error(`${selection.name} does not expose matchJob`);
            return provider.matchJob(normalized, jd.text);
          },
        );
        calls.push(metadata);
        const validationErrors = validateProviderJobMatch(result);
        pipelineResults.jobMatch = validationErrors.length === 0;
        errors.push(...validationErrors.map((e) => `Job match: ${e}`));
      } catch (error) {
        errors.push(`Job match: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const { result, metadata } = await measuredProviderCall(
          selection,
          `${resume.id}.generateCoverLetter`,
          async (provider) => {
            if (!provider.generateCoverLetter) throw new Error(`${selection.name} does not expose generateCoverLetter`);
            return provider.generateCoverLetter({ resume: normalized, targetRole: jd.label, jobDescription: jd.text });
          },
        );
        calls.push(metadata);
        const validationErrors = validateProviderCoverLetter(result);
        pipelineResults.coverLetter = validationErrors.length === 0;
        errors.push(...validationErrors.map((e) => `Cover letter: ${e}`));
      } catch (error) {
        errors.push(`Cover letter: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    results.push({
      persona: PERSONA_NAMES[resume.id] ?? resume.label,
      personaId: resume.id,
      jobLabel: jd?.label ?? "(missing JD)",
      provider: selection.name,
      model: selection.model,
      pipelineResults,
      errors,
      timingMs: Date.now() - start,
    });
  }

  const failed = results.filter((r) => r.errors.length > 0);
  const passed = results.length - failed.length;
  const failures = failed.flatMap((r) => r.errors.map((e) => `${r.persona}: ${e}`));

  writeGateReport({
    title: "AI Dogfooding Report",
    fileName: "AI_DOGFOODING_REPORT.md",
    commands: ["npm run eval:dogfooding"],
    providerCalls: calls,
    passCount: passed,
    failCount: failed.length,
    failures,
    fixesApplied: ["Dogfooding gate now uses real provider matchJob and generateCoverLetter calls instead of deterministic pipeline fallbacks."],
    knownIssues: failures,
    latencyResults: results.map((r) => ({ label: r.persona, durationMs: r.timingMs })),
  });

  console.log(JSON.stringify({ provider: selection.name, model: selection.model, passed, failed: failed.length, results, providerCalls: calls }, null, 2));

  if (failed.length > 0 || calls.length === 0) process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeGateReport({
    title: "AI Dogfooding Report",
    fileName: "AI_DOGFOODING_REPORT.md",
    commands: ["npm run eval:dogfooding"],
    providerCalls: [],
    passCount: 0,
    failCount: 1,
    failures: [message],
    fixesApplied: ["Dogfooding gate now fails when no real provider call can be proven."],
    knownIssues: [message],
    latencyResults: [],
  });
  console.error("Dogfooding runner failed:", message);
  process.exit(1);
});

