/**
 * Groq AI Provider
 *
 * Implements the AIProvider interface using Groq's OpenAI-compatible API.
 * Uses models like Llama 4 Scout and Mixtral through Groq's fast inference
 * infrastructure.
 *
 * Shares the same prompts and response parsing as the Gemini provider —
 * only the API transport differs.
 */

import type { AIProvider, DimensionResult } from "./types";
import type {
  AnalysisDimension,
  AnalysisInput,
  AnalysisOptions,
  NormalizedResume,
  ProviderHealth,
} from "../analysis/types";
import type { Suggestion } from "../suggestion/types";
import type { CoverLetterInput, GeneratedCoverLetter } from "../cover-letter/types";
import type { JobMatchResult } from "../job-match/types";
import { callOpenAICompatible } from "../lib/llm";
import { suggestionId } from "../suggestion/types";

const BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-4-scout-17b-16e-instruct";

// ─── Provider class ────────────────────────────────────────────────────

export interface GroqProviderConfig {
  /** Groq API key (default: process.env.GROQ_API_KEY) */
  apiKey?: string;
  /** Model name (default: "llama-4-scout-17b-16e-instruct") */
  model?: string;
}

export class GroqProvider implements AIProvider {
  readonly name = "Groq (Llama 4)";
  private apiKey: string;
  private model: string;

  constructor(config?: GroqProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GROQ_API_KEY || "";
    this.model = config?.model || DEFAULT_MODEL;
  }

  // ── analyze ──────────────────────────────────────────────────────────

  async analyze(
    dimension: AnalysisDimension,
    input: AnalysisInput,
    options?: AnalysisOptions,
  ): Promise<DimensionResult> {
    const prompt = buildDimensionPrompt(dimension, input.resume, input.jobDescription);
    if (!prompt) {
      return { suggestions: [] };
    }

    try {
      const raw = await callOpenAICompatible({
        baseUrl: BASE_URL,
        apiKey: this.apiKey,
        model: this.model,
        system: DIMENSION_SYSTEM_PROMPTS[dimension] ?? "You are a professional resume expert.",
        prompt,
        signal: options?.signal,
      });

      const suggestions = parseDimensionResponse(dimension, raw, input);
      return { suggestions, raw };
    } catch {
      return { suggestions: [] };
    }
  }

  // ── generateCoverLetter ──────────────────────────────────────────────

  async generateCoverLetter(input: CoverLetterInput): Promise<GeneratedCoverLetter> {
    const resume = input.resume;
    const jd = input.jobDescription;

    const prompt = buildCoverLetterPrompt(resume, jd);

    const raw = await callOpenAICompatible({
      baseUrl: BASE_URL,
      apiKey: this.apiKey,
      model: this.model,
      system: COVER_LETTER_SYSTEM_PROMPT,
      prompt,
      temperature: 0.5,
    });

    const data = raw as Record<string, unknown>;
    return {
      body: typeof data.body === "string" ? data.body : "",
      salutation: typeof data.salutation === "string" ? data.salutation : "Dear Hiring Manager,",
      closing: typeof data.closing === "string" ? data.closing : "Sincerely,",
    };
  }

  // ── matchJob ──────────────────────────────────────────────────────────

  async matchJob(resume: NormalizedResume, jobDescription: string): Promise<JobMatchResult> {
    const prompt = buildJobMatchPrompt(resume, jobDescription);

    const raw = await callOpenAICompatible({
      baseUrl: BASE_URL,
      apiKey: this.apiKey,
      model: this.model,
      system: JOB_MATCH_SYSTEM_PROMPT,
      prompt,
    });

    return parseJobMatchResponse(raw, resume);
  }

  // ── healthCheck ──────────────────────────────────────────────────────

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.apiKey) {
      return { available: false, model: this.model, latency: 0 };
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "Respond with: ok" },
            { role: "user", content: "Health check" },
          ],
          max_tokens: 10,
        }),
      });

      return {
        available: response.ok,
        model: this.model,
        latency: Date.now() - startedAt,
      };
    } catch {
      return { available: false, model: this.model, latency: Date.now() - startedAt };
    }
  }
}

// ─── Shared prompts and parsers ────────────────────────────────────────
// These are identical to the Gemini provider. In Step 7, both providers
// will load them from packages/ai/prompts/{dimension}/v1.md.
//
// Keeping them inline here avoids a cross-reference dependency during
// initial implementation. They will converge in Step 7.

const DIMENSION_SYSTEM_PROMPTS: Record<string, string> = {
  ats: "You are an ATS (Applicant Tracking System) compatibility expert. Analyze the resume for ATS-friendliness.",
  grammar: "You are a professional proofreader. Identify grammatical errors, spelling mistakes, punctuation issues, and style problems.",
  impact: "You are a resume impact analyst. Evaluate how compelling and measurable each bullet point is.",
  keywords: "You are a keyword optimization specialist. Compare the resume against the target job description.",
  summary: "You are a professional resume writer. Evaluate the professional summary for clarity, impact, and structure.",
  tone: "You are a tone analyst. Assess the consistency and appropriateness of the resume's language.",
};

const COVER_LETTER_SYSTEM_PROMPT = "You are a professional cover letter writer. Generate a tailored, compelling cover letter based on the candidate's resume and the target job description.";

const JOB_MATCH_SYSTEM_PROMPT = "You are a job match analyst. Compare a candidate's resume against a job description and provide a detailed match analysis.";

function buildDimensionPrompt(
  dimension: AnalysisDimension,
  resume: NormalizedResume,
  jobDescription?: string,
): string {
  const resumeJson = JSON.stringify(resume, null, 2);
  const jdSection = jobDescription ? `\n\nTarget Job Description:\n${jobDescription}` : "";

  switch (dimension) {
    case "ats":
      return `Analyze this resume for ATS compatibility. Consider formatting, section headers, keyword optimization, and readability.

Score each category 0-100 and list specific missing elements and warnings.

Resume:
${resumeJson}${jdSection}

Respond with JSON: { "score": 0-100, "breakdown": { "formatting": 0-100, "keywords": 0-100, "sections": 0-100, "readability": 0-100 }, "missingElements": ["..."], "warnings": ["..."], "suggestions": [{ "title": "...", "reason": "...", "severity": "critical|major|medium|minor|info", "category": "ats" }] }`;

    case "grammar":
      return `Identify grammatical errors, spelling mistakes, punctuation issues, and style problems in this resume.

Resume:
${resumeJson}

Respond with JSON: { "errors": [{ "text": "...", "correction": "...", "type": "spelling|grammar|punctuation|style", "position": { "start": 0, "end": 0 } }], "overallScore": 0-100, "suggestions": [{ "title": "...", "reason": "...", "severity": "...", "category": "grammar" }] }`;

    case "impact":
      return `Evaluate each bullet point for measurable impact. Check for metrics, action verbs, and quantifiable results.

Resume:
${resumeJson}

Respond with JSON: { "statements": [{ "text": "...", "hasMetric": true, "hasActionVerb": true, "verb": "...", "suggestedVerb": "...", "score": 0-100 }], "overallScore": 0-100, "weakVerbs": ["..."], "strongVerbsUsed": ["..."], "suggestions": [{ "title": "...", "reason": "...", "severity": "...", "category": "impact", "targetText": "...", "suggestedText": "..." }] }`;

    case "keywords":
      if (!jobDescription) {
        return "";
      }
      return `Compare the resume against the target job description. Identify matching and missing keywords, and calculate match score.

Resume:
${resumeJson}

Job Description:
${jobDescription}

Respond with JSON: { "present": ["..."], "missing": ["..."], "density": { "keyword": count }, "topMatchScore": 0-100, "suggestions": [{ "title": "...", "reason": "...", "severity": "...", "category": "keywords" }] }`;

    case "summary":
      return `Evaluate the professional summary for clarity, impact, word count, and effectiveness.

Resume:
${resumeJson}

Respond with JSON: { "score": 0-100, "feedback": "...", "suggestions": [{ "title": "...", "reason": "...", "severity": "...", "category": "summary", "targetText": "...", "suggestedText": "..." }], "wordCount": 0, "hasMetrics": true, "length": "too-short|optimal|too-long" }`;

    case "tone":
      return `Assess the tone consistency across all resume sections. Check for first-person use, formality level, and voice consistency.

Resume:
${resumeJson}

Respond with JSON: { "overallScore": 0-100, "tone": "...", "consistency": 0-100, "suggestions": [{ "title": "...", "reason": "...", "severity": "...", "category": "grammar" }] }`;

    default:
      return "";
  }
}

function buildCoverLetterPrompt(resume: CoverLetterInput["resume"], jobDescription?: string): string {
  const jdSection = jobDescription ? `\n\nTarget Job Description:\n${jobDescription}` : "";
  return `Generate a professional cover letter for this candidate.

Resume:
${JSON.stringify(resume, null, 2)}${jdSection}

Respond with JSON: { "salutation": "Dear Hiring Manager,", "body": "Full cover letter body with multiple paragraphs...", "closing": "Sincerely," }`;
}

function buildJobMatchPrompt(resume: NormalizedResume, jobDescription: string): string {
  return `Compare this resume against the job description. Identify matching skills, missing skills, and provide a match score.

Resume:
${JSON.stringify(resume, null, 2)}

Job Description:
${jobDescription}

Respond with JSON: { "matchScore": 0-100, "missingSkills": ["..."], "presentSkills": ["..."], "suggestions": [{ "title": "...", "reason": "...", "severity": "major|medium|minor|info", "category": "job-match", "suggestedText": "..." }] }`;
}

function parseDimensionResponse(
  dimension: AnalysisDimension,
  raw: unknown,
  input: AnalysisInput,
): Suggestion[] {
  const data = raw as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return [];

  const rawSuggestions = data.suggestions;
  if (!Array.isArray(rawSuggestions)) return [];

  return rawSuggestions
    .map((s: unknown, i: number) => {
      const item = s as Record<string, unknown>;
      if (!item || typeof item.title !== "string") return null;

      return {
        id: suggestionId(
          dimension,
          (item.code as string) ?? `${dimension}-ai-${i}`,
          (item.location as Record<string, string> | undefined)?.sectionId ?? "resume",
        ),
        category: dimension as Suggestion["category"],
        severity: (
          ["critical", "major", "medium", "minor", "info"].includes(item.severity as string)
            ? item.severity
            : "medium"
        ) as Suggestion["severity"],
        title: item.title as string,
        reason: (item.reason as string) ?? "",
        targetText: (item.targetText as string) ?? null,
        suggestedText: (item.suggestedText as string) ?? null,
        location: {
          sectionId: (item.location as Record<string, string> | undefined)?.sectionId ?? "resume",
          entryId: (item.location as Record<string, string> | undefined)?.entryId,
          field: (item.location as Record<string, string> | undefined)?.field,
        },
        confidence: typeof item.confidence === "number" ? item.confidence : 0.8,
        source: "ai" as const,
        modelInfo: "groq-llama-4-scout",
      } as Suggestion;
    })
    .filter(Boolean) as Suggestion[];
}

function parseJobMatchResponse(raw: unknown, _resume: NormalizedResume): JobMatchResult {
  const data = raw as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    return { matchScore: null, missingSkills: [], presentSkills: [], suggestions: [] };
  }

  const missingSkills = Array.isArray(data.missingSkills)
    ? (data.missingSkills as string[]).filter((s: unknown) => typeof s === "string")
    : [];

  const presentSkills = Array.isArray(data.presentSkills)
    ? (data.presentSkills as string[]).filter((s: unknown) => typeof s === "string")
    : [];

  const matchScore = typeof data.matchScore === "number" ? Math.max(0, Math.min(100, data.matchScore)) : null;

  const rawSuggestionsArr = data.suggestions;
  const suggestions: Suggestion[] = Array.isArray(rawSuggestionsArr)
    ? rawSuggestionsArr
        .map((s: unknown, i: number) => {
          const item = s as Record<string, unknown>;
          if (!item || typeof item.title !== "string") return null;
          return {
            id: suggestionId("job-match", `match-${i}`, "skills"),
            category: "job-match" as const,
            severity: (["major", "medium", "minor", "info"].includes(item.severity as string)
              ? item.severity
              : "medium") as Suggestion["severity"],
            title: item.title as string,
            reason: (item.reason as string) ?? "",
            targetText: null,
            suggestedText: (item.suggestedText as string) ?? (item.title as string),
            location: { sectionId: "skills" },
            confidence: 0.8,
            source: "ai" as const,
            modelInfo: "groq-llama-4-scout",
          } as Suggestion;
        })
        .filter(Boolean) as Suggestion[]
    : [];

  return { matchScore, missingSkills, presentSkills, suggestions };
}
