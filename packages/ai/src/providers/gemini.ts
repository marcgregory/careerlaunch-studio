/**
 * Gemini AI Provider
 *
 * Implements the AIProvider interface using Google's Gemini 2.5 Flash model.
 * Uses structured output (responseMimeType: "application/json") for reliable
 * typed responses across all dimensions.
 *
 * Prompts are inlined here for initial development. In Step 7 they will be
 * extracted to packages/ai/prompts/{dimension}/v1.md.
 *
 * Validation is inline here for initial development. In Step 8 it will be
 * extracted to packages/ai/src/lib/validate.ts.
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
import type { CoverLetterInput, GeneratedCoverLetter, CoverLetterContext } from "../cover-letter/types";
import { buildCoverLetterContext } from "../cover-letter/context";
import type { JobMatchResult } from "../job-match/types";
import { callGemini } from "../lib/llm";
import { suggestionId } from "../suggestion/types";
import { reconcileSkillComparison } from "../job-match/compare";

// ─── Provider class ────────────────────────────────────────────────────

export interface GeminiProviderConfig {
  /** Gemini API key (default: process.env.GEMINI_API_KEY) */
  apiKey?: string;
  /** Model name (default: "gemini-2.5-flash") */
  model?: string;
}

export class GeminiProvider implements AIProvider {
  readonly name = "Gemini 2.5 Flash";
  private apiKey: string;
  private model: string;

  constructor(config?: GeminiProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || "";
    this.model = config?.model || "gemini-2.5-flash";
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
      const raw = await callGemini({
        system: DIMENSION_SYSTEM_PROMPTS[dimension] ?? "You are a professional resume expert.",
        prompt,
        apiKey: this.apiKey,
        model: this.model,
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
    const targetRole = input.targetRole;
    const jd = input.jobDescription;

    const prompt = buildCoverLetterPrompt(resume, targetRole, jd);

    const raw = await callGemini({
      system: COVER_LETTER_SYSTEM_PROMPT,
      prompt,
      apiKey: this.apiKey,
      model: this.model,
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

    const raw = await callGemini({
      system: JOB_MATCH_SYSTEM_PROMPT,
      prompt,
      apiKey: this.apiKey,
      model: this.model,
      signal: undefined,
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
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey: this.apiKey });
      await client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: "Respond with: ok" }] }],
        config: { maxOutputTokens: 10 },
      });
      return { available: true, model: this.model, latency: Date.now() - startedAt };
    } catch {
      return { available: false, model: this.model, latency: Date.now() - startedAt };
    }
  }
}

// ─── Dimension system prompts ──────────────────────────────────────────

const DIMENSION_SYSTEM_PROMPTS: Record<string, string> = {
  ats: "You are an ATS (Applicant Tracking System) compatibility expert. Analyze the resume for ATS-friendliness.",
  grammar: "You are a professional proofreader. Identify grammatical errors, spelling mistakes, punctuation issues, and style problems.",
  impact: "You are a resume impact analyst. Evaluate how compelling and measurable each bullet point is.",
  keywords: "You are a keyword optimization specialist. Compare the resume against the target job description.",
  summary: "You are a professional resume writer. Evaluate the professional summary for clarity, impact, and structure.",
  tone: "You are a tone analyst. Assess the consistency and appropriateness of the resume's language.",
};

// ─── Dimension prompt builders ─────────────────────────────────────────

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
        return ""; // Skip keyword analysis without a JD
      }
      return `Compare the resume against the target job description. Identify matching and missing keywords, and calculate match score.

IMPORTANT: Only list skills or keywords as "missing" if they clearly appear in the job description below. Do NOT infer or guess skills from the role title alone — only include what is explicitly mentioned.

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

// ─── Cover letter ──────────────────────────────────────────────────────

const COVER_LETTER_SYSTEM_PROMPT = `You are a professional cover letter writer. Generate a tailored, compelling cover letter based on the candidate's curated profile and the target job description.

Rules:
- Never list all of the candidate's technologies. Mention only 3-5 most relevant skills.
- Do not repeat the same skills in multiple paragraphs.
- Do not use dates as job titles.
- Keep it 3-4 short paragraphs.
- Use first-person voice throughout.
- Be specific: reference actual achievements, not generic duties.`;

function buildCoverLetterPrompt(resume: CoverLetterInput["resume"], targetRole: string, jobDescription?: string): string {
  const ctx: CoverLetterContext = buildCoverLetterContext(resume, targetRole, jobDescription);

  const parts: string[] = [
    `Generate a cover letter for a ${ctx.targetRole} position.`,
    "",
    "## Curated Candidate Profile",
    `Name: ${resume.contact.fullName || "The Candidate"}`,
    `Target Role: ${ctx.targetRole}`,
  ];

  if (ctx.currentTitle) {
    parts.push(`Current/Last Title: ${ctx.currentTitle}`);
  }
  if (ctx.currentEmployer) {
    parts.push(`Current/Last Employer: ${ctx.currentEmployer}`);
  }
  if (ctx.yearsExperience !== undefined) {
    parts.push(`Estimated Experience: ${ctx.yearsExperience}+ years`);
  }

  // Skills — only top 5, JD-relevant
  if (ctx.topRelevantSkills.length > 0) {
    parts.push("");
    parts.push(`Top Relevant Skills: ${ctx.topRelevantSkills.join(", ")}`);
  }

  // Best achievements — max 3
  if (ctx.bestAchievements.length > 0) {
    parts.push("");
    parts.push("Key Achievements:");
    for (const a of ctx.bestAchievements) {
      parts.push(`- ${a}`);
    }
  }

  // Projects — max 2
  if (ctx.relevantProjects.length > 0) {
    parts.push("");
    parts.push("Relevant Projects:");
    for (const p of ctx.relevantProjects) {
      parts.push(`- ${p.name}: ${p.description}`);
      for (const b of p.bullets) {
        parts.push(`  - ${b}`);
      }
    }
  }

  // Education
  if (ctx.education) {
    parts.push("");
    parts.push(`Education: ${ctx.education.degree} — ${ctx.education.school} (${ctx.education.graduation})`);
  }

  // Certifications
  if (ctx.certifications.length > 0) {
    parts.push(`Certifications: ${ctx.certifications.join(", ")}`);
  }

  // Summary (optional hint)
  if (resume.summary) {
    parts.push("");
    parts.push(`Professional Summary: ${resume.summary}`);
  }

  // Job description
  if (jobDescription) {
    parts.push("");
    parts.push(`Target Job Description:\n${jobDescription}`);
  }

  parts.push("");
  parts.push(`Respond with JSON: { "salutation": "Dear Hiring Manager,", "body": "Full cover letter body with 3-4 paragraphs...", "closing": "Sincerely," }`);

  return parts.join("\n");
}

// ─── Job match ─────────────────────────────────────────────────────────

const JOB_MATCH_SYSTEM_PROMPT = `You are a job match analyst. Compare a candidate's resume against a job description and provide a detailed match analysis.`;

function buildJobMatchPrompt(resume: NormalizedResume, jobDescription: string): string {
  return `Compare this resume against the job description. Identify matching skills, missing skills, and provide a match score.

Resume:
${JSON.stringify(resume, null, 2)}

Job Description:
${jobDescription}

Respond with JSON: { "matchScore": 0-100, "missingSkills": ["..."], "presentSkills": ["..."], "suggestions": [{ "title": "...", "reason": "...", "severity": "major|medium|minor|info", "category": "job-match", "suggestedText": "..." }] }`;
}

// ─── Response parsers ──────────────────────────────────────────────────

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
        modelInfo: "gemini-2.5-flash",
      } as Suggestion;
    })
    .filter(Boolean) as Suggestion[];
}

function parseJobMatchResponse(raw: unknown, resume: NormalizedResume): JobMatchResult {
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

  const rawSuggestions = data.suggestions;
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
            modelInfo: "gemini-2.5-flash",
          } as Suggestion;
        })
        .filter(Boolean) as Suggestion[]
    : [];

  const reconciled = reconcileSkillComparison({ missingSkills, presentSkills, suggestions }, resume);

  return { matchScore, ...reconciled };
}
