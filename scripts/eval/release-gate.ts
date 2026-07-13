import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  clearProviders,
  GeminiProvider,
  GroqProvider,
  registerProvider,
  setDefaultProvider,
  type AIProvider,
  type GeneratedCoverLetter,
  type JobMatchResult,
  type NormalizedResume,
} from "@careerlaunch/ai";

let envLoaded = false;

export type RealProviderName = "gemini" | "groq";

export interface ProviderSelection {
  name: RealProviderName;
  provider: AIProvider;
  model: string;
  healthLatencyMs: number;
}

export interface ProviderCallMetadata {
  provider: RealProviderName;
  model: string;
  operation: string;
  durationMs: number;
  retryCount: number;
  fallbackPath: string;
  tokenUsage: null;
  usedMock: false;
  usedStaticFallback: false;
}

export interface GateReportOptions {
  title: string;
  fileName: string;
  commands: string[];
  providerCalls: ProviderCallMetadata[];
  passCount: number;
  failCount: number;
  failures: string[];
  fixesApplied: string[];
  knownIssues: string[];
  latencyResults: Array<{ label: string; durationMs: number }>;
  environment?: string;
}

export const releaseDir = join(process.cwd(), "docs", "release", "sprint-6d");

export function loadEvaluationEnv(): void {
  if (!envLoaded) {
    loadEnvConfig(process.cwd());
    loadDotEnvEval();
    envLoaded = true;
  }
}

export async function requireRealProvider(preferred?: RealProviderName): Promise<ProviderSelection> {
  const providers = await getAvailableProviders();
  const ordered = preferred
    ? [...providers.filter((p) => p.name === preferred), ...providers.filter((p) => p.name !== preferred)]
    : providers;

  if (ordered.length === 0) {
    throw new Error("Evaluation environment has no real provider credentials loaded (checked process env and .env.eval): configure GEMINI_API_KEY or GROQ_API_KEY.");
  }

  const failures: string[] = [];
  for (const candidate of ordered) {
    const startedAt = Date.now();
    const health = await candidate.provider.healthCheck();
    if (health.available) {
      clearProviders();
      registerProvider(candidate.name, candidate.provider);
      setDefaultProvider(candidate.name);
      return {
        ...candidate,
        model: health.model || candidate.model,
        healthLatencyMs: health.latency || Date.now() - startedAt,
      };
    }
    failures.push(`${candidate.name}/${health.model || candidate.model} unavailable`);
  }

  throw new Error(`No configured real AI provider passed health check: ${failures.join("; ")}`);
}

export async function requireProviderPair(): Promise<{ primary: ProviderSelection; secondary: ProviderSelection }> {
  const providers = await getAvailableProviders();
  if (providers.length < 2) {
    throw new Error("Recovery gate requires both GEMINI_API_KEY and GROQ_API_KEY in the evaluation environment to prove real provider fallback.");
  }

  const healthy: ProviderSelection[] = [];
  for (const candidate of providers) {
    const health = await candidate.provider.healthCheck();
    if (health.available) {
      healthy.push({
        ...candidate,
        model: health.model || candidate.model,
        healthLatencyMs: health.latency,
      });
    }
  }

  if (healthy.length < 2) {
    throw new Error("Recovery gate requires two healthy real providers in the evaluation environment; one or more health checks failed.");
  }

  return { primary: healthy[0], secondary: healthy[1] };
}

export async function measuredProviderCall<T>(
  selection: ProviderSelection,
  operation: string,
  call: (provider: AIProvider) => Promise<T>,
  fallbackPath = "none",
): Promise<{ result: T; metadata: ProviderCallMetadata }> {
  const startedAt = Date.now();
  const result = await call(selection.provider);
  const metadata: ProviderCallMetadata = {
    provider: selection.name,
    model: selection.model,
    operation,
    durationMs: Date.now() - startedAt,
    retryCount: 0,
    fallbackPath,
    tokenUsage: null,
    usedMock: false,
    usedStaticFallback: false,
  };
  assertRealProviderCall(metadata);
  return { result, metadata };
}

export function assertRealProviderCall(metadata: ProviderCallMetadata): void {
  if (!/gemini|groq/i.test(metadata.provider)) {
    throw new Error(`Expected Gemini or Groq provider, received ${metadata.provider}`);
  }
  if (metadata.usedMock) {
    throw new Error("Mock provider output is not allowed in release-gate AI evaluation.");
  }
  if (metadata.usedStaticFallback) {
    throw new Error("Static fallback output is not allowed in release-gate AI evaluation.");
  }
}

export function normalizeFixtureResume(resume: any): NormalizedResume {
  return {
    contact: resume.contact,
    summary: resume.summary,
    sections: resume.sections,
    skills: resume.skills ?? [],
    certifications: resume.certifications ?? [],
    projects: (resume.projects ?? []).map((p: any) => ({
      name: p.name ?? "",
      description: p.description ?? "",
      bullets: p.bullets ?? [],
    })),
  };
}

export function validateProviderJobMatch(result: JobMatchResult): string[] {
  const errors: string[] = [];
  if (typeof result.matchScore !== "number" && result.matchScore !== null) {
    errors.push("matchScore is neither a number nor null");
  }
  if (!Array.isArray(result.missingSkills)) errors.push("missingSkills is not an array");
  if (!Array.isArray(result.presentSkills)) errors.push("presentSkills is not an array");
  if (!Array.isArray(result.suggestions)) errors.push("suggestions is not an array");
  return errors;
}

export function validateProviderCoverLetter(result: GeneratedCoverLetter): string[] {
  const errors: string[] = [];
  if (!result || typeof result !== "object") return ["cover letter result is not an object"];
  if (typeof result.body !== "string" || result.body.trim().length < 80) {
    errors.push("cover letter body is missing or too short");
  }
  if (typeof result.salutation !== "string") errors.push("salutation is not a string");
  if (typeof result.closing !== "string") errors.push("closing is not a string");
  return errors;
}

export function writeGateReport(options: GateReportOptions): void {
  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir, { recursive: true });
  }

  const now = new Date().toISOString();
  const credentialPresence = getCredentialPresence();
  const credentialSummary = [
    `- Gemini: credential present: ${credentialPresence.gemini ? "yes" : "no"}`,
    `- Groq: credential present: ${credentialPresence.groq ? "yes" : "no"}`,
  ].join("\n");
  const providerSummary = options.providerCalls.length > 0
    ? options.providerCalls
        .map((m) => [
          `- Provider: ${displayProviderName(m.provider)}`,
          `  Model: ${m.model}`,
          `  Credential present: ${credentialPresence[m.provider] ? "yes" : "no"}`,
          `  Operation: ${m.operation}`,
          `  Duration: ${m.durationMs}ms`,
          `  Retry count: ${m.retryCount}`,
          `  Fallback path: ${m.fallbackPath}`,
          `  Token usage: ${m.tokenUsage ?? "unavailable"}`,
        ].join("\n"))
        .join("\n")
    : "- No provider calls recorded";

  const body = `# ${options.title}

- Date/time: ${now}
- Environment: ${options.environment ?? getEnvironmentLabel()}
- Provider/model: ${options.providerCalls.map((m) => `${m.provider}/${m.model}`).join(", ") || "none"}
- Credential presence: Gemini=${credentialPresence.gemini ? "yes" : "no"}, Groq=${credentialPresence.groq ? "yes" : "no"}
- Commands run: ${options.commands.join(", ")}
- Pass/fail totals: ${options.passCount} passed, ${options.failCount} failed

## Credential Status

${credentialSummary}

## Provider Calls

${providerSummary}

## Latency Results

${formatList(options.latencyResults.map((l) => `${l.label}: ${l.durationMs}ms`))}

## Failures Found

${formatList(options.failures)}

## Fixes Applied

${formatList(options.fixesApplied)}

## Remaining Known Issues

${formatList(options.knownIssues)}
`;

  writeFileSync(join(releaseDir, options.fileName), body, "utf-8");
}

export function getEnvironmentLabel(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
}

async function getAvailableProviders(): Promise<Array<Omit<ProviderSelection, "healthLatencyMs">>> {
  loadEvaluationEnv();
  const providers: Array<Omit<ProviderSelection, "healthLatencyMs">> = [];

  if (process.env.GEMINI_API_KEY?.trim()) {
    providers.push({
      name: "gemini",
      provider: new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      }),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });
  }

  if (process.env.GROQ_API_KEY?.trim()) {
    providers.push({
      name: "groq",
      provider: new GroqProvider({
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || undefined,
      }),
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    });
  }

  return providers;
}

export function getCredentialPresence(): Record<RealProviderName, boolean> {
  loadEvaluationEnv();
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    groq: Boolean(process.env.GROQ_API_KEY?.trim()),
  };
}

function loadDotEnvEval(): void {
  const envPath = join(process.cwd(), ".env.eval");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf-8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function displayProviderName(provider: RealProviderName): string {
  return provider === "gemini" ? "Gemini" : "Groq";
}

function formatList(items: string[]): string {
  if (items.length === 0) return "- None";
  return items.map((item) => `- ${item}`).join("\n");
}





