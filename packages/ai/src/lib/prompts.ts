/**
 * Prompt loader — loads prompt files from the prompts directory.
 *
 * Prompts are versioned markdown files stored in packages/ai/prompts/{dimension}/{version}.md.
 * The loader reads them at runtime and fills in template variables (resume_json, job_description).
 *
 * In production, prompts could be cached in memory after first load.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { NormalizedResume } from "../analysis/types";
import type { ResumeDocument } from "@careerlaunch/domain";

/** Resolved prompt with system instruction and user message */
export interface ResolvedPrompt {
  system: string;
  user: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, "../../prompts");

// ─── Prompt loading ────────────────────────────────────────────────────

const promptCache = new Map<string, string>();

/**
 * Load a prompt file by dimension and version.
 * Caches the file content in memory after first load.
 *
 * @param dimension — e.g. "ats", "grammar", "cover-letter"
 * @param version — e.g. "v1" (default)
 * @returns The raw prompt file text, or throws if not found
 */
export function loadPrompt(dimension: string, version = "v1"): string {
  const cacheKey = `${dimension}/${version}`;

  const cached = promptCache.get(cacheKey);
  if (cached) return cached;

  const filePath = path.join(PROMPTS_DIR, dimension, `${version}.md`);
  const content = fs.readFileSync(filePath, "utf-8");
  promptCache.set(cacheKey, content);
  return content;
}

/**
 * Check if a prompt file exists for the given dimension and version.
 */
export function hasPrompt(dimension: string, version = "v1"): boolean {
  try {
    loadPrompt(dimension, version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the in-memory prompt cache (useful in tests).
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

// ─── Prompt rendering ──────────────────────────────────────────────────

/**
 * Build a system prompt and user message for a given dimension by loading
 * the prompt template and filling in template variables.
 */
export function buildSystemPrompt(
  dimension: string,
  resume: NormalizedResume,
  jobDescription?: string,
): ResolvedPrompt {
  const template = loadPrompt(dimension);

  const resumeJson = JSON.stringify(resume, null, 2);

  // Extract the # Role section as system prompt, everything else as user message
  const roleMatch = template.match(/^# Role\s*\n([\s\S]*?)(?=\n# )/);
  const system = roleMatch
    ? roleMatch[1].trim()
    : "You are a professional resume expert.";

  // Build user message by filling variables into the full template
  let user = template
    .replace(/{resume_json}/g, resumeJson)
    .replace(/{job_description}/g, jobDescription ?? "Not provided");

  return { system, user };
}

/**
 * Build a system prompt and user message for cover letter generation.
 */
export function buildCoverLetterPrompt(
  resume: ResumeDocument | NormalizedResume,
  jobDescription?: string,
): ResolvedPrompt {
  const template = loadPrompt("cover-letter");

  const resumeJson = JSON.stringify(resume, null, 2);

  const roleMatch = template.match(/^# Role\s*\n([\s\S]*?)(?=\n# )/);
  const system = roleMatch
    ? roleMatch[1].trim()
    : "You are a professional cover letter writer.";

  let user = template
    .replace(/{resume_json}/g, resumeJson)
    .replace(/{job_description}/g, jobDescription ?? "Not provided");

  return { system, user };
}

/**
 * Build a system prompt and user message for job match analysis.
 */
export function buildJobMatchPrompt(
  resume: NormalizedResume,
  jobDescription: string,
): ResolvedPrompt {
  const template = loadPrompt("job-match");

  const resumeJson = JSON.stringify(resume, null, 2);

  const roleMatch = template.match(/^# Role\s*\n([\s\S]*?)(?=\n# )/);
  const system = roleMatch
    ? roleMatch[1].trim()
    : "You are a job match analyst.";

  let user = template
    .replace(/{resume_json}/g, resumeJson)
    .replace(/{job_description}/g, jobDescription);

  return { system, user };
}
