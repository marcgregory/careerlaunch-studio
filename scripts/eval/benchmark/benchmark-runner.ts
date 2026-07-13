/**
 * CareerLaunch Studio - Sprint 6D real-provider AI benchmark gate.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  measuredProviderCall,
  normalizeFixtureResume,
  releaseDir,
  requireRealProvider,
  validateProviderJobMatch,
  writeGateReport,
  type ProviderCallMetadata,
} from "../release-gate";
import type { JobMatchResult, NormalizedResume } from "@careerlaunch/ai";

const DOGFOODING_RESUME_IDS = ["resume-16", "resume-17", "resume-18", "resume-19", "resume-20", "resume-21"];
const PERSONA_NAMES: Record<string, string> = {
  "resume-16": "Junior Frontend Developer",
  "resume-17": "Senior Backend Engineer",
  "resume-18": "WordPress Developer",
  "resume-19": "Marketing Specialist",
  "resume-20": "Graphic Designer",
  "resume-21": "Customer Support Specialist",
};

interface PersonaBenchmarkResult {
  persona: string;
  personaId: string;
  jobLabel: string;
  provider: string;
  model: string;
  jsonValid: boolean;
  schemaValid: boolean;
  promptFailed: boolean;
  latencyMs: number;
  suggestionCount: number;
  errors: string[];
  matchScore: number | null;
}

interface ConsistencyResult {
  persona: string;
  personaId: string;
  runs: Array<{ runNumber: number; matchScore: number | null; latencyMs: number }>;
  scoreStddev: number;
  passed: boolean;
}

function loadDataset<T>(filename: string): T[] {
  const path = join(__dirname, "..", "datasets", filename);
  if (!existsSync(path)) throw new Error(`Dataset not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf-8")) as T[];
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] ?? 0;
}

async function runMatch(
  selection: Awaited<ReturnType<typeof requireRealProvider>>,
  resumeId: string,
  normalized: NormalizedResume,
  jdText: string,
  callLabel: string,
): Promise<{ result: JobMatchResult; metadata: ProviderCallMetadata }> {
  return measuredProviderCall(selection, `${resumeId}.${callLabel}`, async (provider) => {
    if (!provider.matchJob) throw new Error(`${selection.name} does not expose matchJob`);
    return provider.matchJob(normalized, jdText);
  });
}

async function run(): Promise<void> {
  const selection = await requireRealProvider();
  const allResumes = loadDataset<any>("resumes.json");
  const jds = loadDataset<any>("job-descriptions.json");
  const jdMap = new Map(jds.map((j: any) => [j.id, j]));
  const calls: ProviderCallMetadata[] = [];
  const results: PersonaBenchmarkResult[] = [];
  const consistency: ConsistencyResult[] = [];

  for (const resume of allResumes.filter((r: any) => DOGFOODING_RESUME_IDS.includes(r.id))) {
    const normalized = normalizeFixtureResume(resume);
    const jd = jdMap.get(resume.id.replace("resume-", "jd-"));
    const errors: string[] = [];
    let latencyMs = 0;
    let result: JobMatchResult | null = null;

    if (!jd) {
      errors.push(`No matching job description for ${resume.id}`);
    } else {
      try {
        const call = await runMatch(selection, resume.id, normalized, jd.text, "benchmark");
        calls.push(call.metadata);
        latencyMs = call.metadata.durationMs;
        result = call.result;
        errors.push(...validateProviderJobMatch(call.result));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    results.push({
      persona: PERSONA_NAMES[resume.id] ?? resume.label,
      personaId: resume.id,
      jobLabel: jd?.label ?? "(missing JD)",
      provider: selection.name,
      model: selection.model,
      jsonValid: result !== null,
      schemaValid: errors.length === 0,
      promptFailed: result === null,
      latencyMs,
      suggestionCount: result?.suggestions.length ?? 0,
      errors,
      matchScore: result?.matchScore ?? null,
    });

    if (jd) {
      const runs: ConsistencyResult["runs"] = [];
      for (let i = 0; i < 3; i++) {
        try {
          const call = await runMatch(selection, resume.id, normalized, jd.text, `consistency-${i + 1}`);
          calls.push(call.metadata);
          runs.push({ runNumber: i + 1, matchScore: call.result.matchScore ?? null, latencyMs: call.metadata.durationMs });
        } catch {
          runs.push({ runNumber: i + 1, matchScore: null, latencyMs: 0 });
        }
      }
      const scores = runs.map((r) => r.matchScore).filter((s): s is number => typeof s === "number");
      const scoreStddev = stddev(scores);
      consistency.push({
        persona: PERSONA_NAMES[resume.id] ?? resume.label,
        personaId: resume.id,
        runs,
        scoreStddev,
        passed: scores.length === 3 && scoreStddev < 10,
      });
    }
  }

  const jsonValidityPct = results.length ? (results.filter((r) => r.jsonValid).length / results.length) * 100 : 0;
  const schemaPassPct = results.length ? (results.filter((r) => r.schemaValid).length / results.length) * 100 : 0;
  const promptFailurePct = results.length ? (results.filter((r) => r.promptFailed).length / results.length) * 100 : 100;
  const latencies = calls.map((c) => c.durationMs);
  const failures = [
    ...results.flatMap((r) => r.errors.map((e) => `${r.persona}: ${e}`)),
    ...consistency.filter((c) => !c.passed).map((c) => `${c.persona}: consistency failed, stddev=${c.scoreStddev.toFixed(2)}`),
  ];

  const report = {
    timestamp: new Date().toISOString(),
    provider: selection.name,
    model: selection.model,
    totalPersonas: results.length,
    providerCalls: calls,
    results,
    consistency,
    aggregated: {
      jsonValidityPct,
      schemaPassPct,
      promptFailurePct,
      avgLatencyMs: latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
    },
    overallPass: failures.length === 0 && calls.length > 0,
  };

  if (!existsSync(releaseDir)) {
    await import("node:fs").then((fs) => fs.mkdirSync(releaseDir, { recursive: true }));
  }
  writeFileSync(join(releaseDir, "AI_BENCHMARK_REPORT.json"), JSON.stringify(report, null, 2), "utf-8");

  writeGateReport({
    title: "AI Benchmark Report",
    fileName: "AI_BENCHMARK_REPORT.md",
    commands: ["npm run eval:benchmark"],
    providerCalls: calls,
    passCount: results.length - results.filter((r) => r.errors.length > 0).length,
    failCount: failures.length,
    failures,
    fixesApplied: ["Benchmark now uses real provider matchJob calls for quality and consistency checks; deterministic fallback is not counted as success."],
    knownIssues: failures,
    latencyResults: [
      { label: "p50 provider latency", durationMs: report.aggregated.p50LatencyMs },
      { label: "p95 provider latency", durationMs: report.aggregated.p95LatencyMs },
      { label: "avg provider latency", durationMs: Math.round(report.aggregated.avgLatencyMs) },
    ],
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.overallPass) process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeGateReport({
    title: "AI Benchmark Report",
    fileName: "AI_BENCHMARK_REPORT.md",
    commands: ["npm run eval:benchmark"],
    providerCalls: [],
    passCount: 0,
    failCount: 1,
    failures: [message],
    fixesApplied: ["Benchmark gate now fails when no real provider call can be proven."],
    knownIssues: [message],
    latencyResults: [],
  });
  console.error("Benchmark suite failed:", message);
  process.exit(1);
});

