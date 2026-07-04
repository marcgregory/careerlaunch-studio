/**
 * Job Analysis — Phase 1 of the AI Resume Tailoring pipeline.
 *
 * Analyzes a raw job description to extract structured information:
 * required/preferred skills, seniority, responsibilities, ATS keywords, industry.
 *
 * Delegates to the AI provider if available, falls back to deterministic
 * dictionary-based extraction.
 */

import type { AIProvider } from "../providers/types";
import { getProvider } from "../providers/index";
import type { JobAnalysis, JobAnalysisInput } from "./types";
import { emptyJobAnalysis } from "./types";
import { normalizeJobDescription } from "../job-match/normalize-job";

export type { JobAnalysis, JobAnalysisInput } from "./types";

/**
 * Run job analysis — extract structured data from a job description.
 *
 * Delegates to the configured AI provider if it supports `analyzeJob`.
 * Falls back to a deterministic keyword extractor.
 *
 * @param input — the job description to analyze
 * @param options — optional provider name override
 * @returns structured JobAnalysis
 */
export async function runJobAnalysis(
  input: JobAnalysisInput,
  options?: { providerName?: string },
): Promise<JobAnalysis> {
  // Try the AI provider first
  try {
    const provider = options?.providerName
      ? getProvider(options.providerName)
      : getProvider();

    if (provider.analyzeJob) {
      try {
        return await provider.analyzeJob(input.jobDescription);
      } catch {
        // Fall through to deterministic
      }
    }
  } catch {
    // No provider registered — fall through to deterministic
  }

  return deterministicAnalyzeJob(input);
}

/**
 * Deterministic, dictionary-based job analysis.
 *
 * Extracts skills and keywords using the existing skill dictionary.
 * No AI calls — used as a fallback.
 */
export function deterministicAnalyzeJob(input: JobAnalysisInput): JobAnalysis {
  const { jobDescription } = input;
  const text = jobDescription.toLowerCase();

  // Use the same dictionary matching as the job-match fallback
  const normalized = normalizeJobDescription(jobDescription);
  const keywords = normalized.skills;

  // Basic seniority detection
  let seniority: JobAnalysis["seniority"] = "unknown";
  if (/\b(entry.level|junior|intern|graduate|0-2\s*years?)\b/i.test(text)) seniority = "entry";
  else if (/\bsenior\b|\bstaff\b|\b5\+?\s*years?\b|\b5-7\s*years?\b/i.test(text)) seniority = "senior";
  else if (/\blead\b|\bmanager\b|\bhead\b|\b8\+?\s*years?\b/i.test(text)) seniority = "lead";
  else if (/\b(vp|vice president|chief|director|cxo|cto|ceo)\b/i.test(text)) seniority = "executive";
  else if (/\bmid.level\b|\b2\+?\s*years?\b|\b3-5\s*years?\b/i.test(text)) seniority = "mid";

  // Basic industry detection
  let industry: string | null = null;
  if (/\b(software|engineer|developer|full.stack|frontend|backend|devops|cloud|api|saas|agile|sprint)\b/i.test(text)) industry = "technology";
  else if (/\b(healthcare|clinical|patient|hospital|medical|nurse|doctor|pharma)\b/i.test(text)) industry = "healthcare";
  else if (/\bfinance|accounting|banking|audit|compliance|investment|insurance\b/i.test(text)) industry = "finance";
  else if (/\bmarketing|seo|content|social.media|brand|campaign|growth\b/i.test(text)) industry = "marketing";
  else if (/\bsales|business.development|account.executive|revenue\b/i.test(text)) industry = "sales";

  return {
    requiredSkills: keywords,
    preferredSkills: [],
    seniority,
    responsibilities: [],
    atsKeywords: [...new Set(keywords)],
    industry,
  };
}
