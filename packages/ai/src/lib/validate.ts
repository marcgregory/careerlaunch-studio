/**
 * Structured output validators.
 *
 * Validates LLM responses (parsed JSON) against expected shapes.
 * Returns typed results with confidence scores proportional to how
 * many fields passed validation — partial results are better than null.
 *
 * This is the second layer of the three-layer validation:
 *   Layer 1: Parse (LLM helper — JSON.parse)
 *   Layer 2: Validate (this file — shape & range checks)
 *   Layer 3: Sanity (caller — contradictions, empty results)
 */

import type { Suggestion, SuggestionSeverity, SuggestionCategory } from "../suggestion/types";
import type {
  ATSAnalysis,
  GrammarAnalysis,
  ImpactAnalysis,
  KeywordAnalysis,
  SummaryAnalysis,
  ToneAnalysis,
} from "../analysis/types";
import type { GeneratedCoverLetter } from "../cover-letter/types";
import type { JobMatchResult } from "../job-match/types";

// ─── Validation error ──────────────────────────────────────────────────

export class ValidationError extends Error {
  public readonly field: string;
  public readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Validation failed for "${field}": ${reason}`);
    this.name = "ValidationError";
    this.field = field;
    this.reason = reason;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= min && value <= max;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isValidSeverity(value: unknown): value is SuggestionSeverity {
  return typeof value === "string" && ["critical", "major", "medium", "minor", "info"].includes(value);
}

const VALID_CATEGORIES = new Set([
  "summary", "experience", "education", "skills", "contact",
  "formatting", "ats", "grammar", "impact", "keywords",
  "completeness", "job-match",
]);

// ─── Suggestion validator ──────────────────────────────────────────────

function validateSuggestion(raw: unknown): Suggestion | null {
  if (!isObject(raw) || !isString(raw.title)) return null;

  const category = isString(raw.category) && VALID_CATEGORIES.has(raw.category)
    ? (raw.category as SuggestionCategory)
    : "ats";

  return {
    id: isString(raw.id) ? raw.id : `${category}:ai-${Math.random().toString(36).slice(2)}`,
    category,
    severity: isValidSeverity(raw.severity) ? raw.severity : "medium",
    title: raw.title as string,
    reason: isString(raw.reason) ? raw.reason : "",
    targetText: isString(raw.targetText) ? raw.targetText : null,
    suggestedText: isString(raw.suggestedText) ? raw.suggestedText : null,
    location: {
      sectionId: isObject(raw.location) && isString(raw.location.sectionId)
        ? raw.location.sectionId
        : "resume",
      entryId: isObject(raw.location) && isString(raw.location.entryId)
        ? raw.location.entryId
        : undefined,
      field: isObject(raw.location) && isString(raw.location.field)
        ? raw.location.field
        : undefined,
    },
    confidence: isNumberInRange(raw.confidence, 0, 1) ? raw.confidence : 0.7,
    source: "ai",
    modelInfo: isString(raw.modelInfo) ? raw.modelInfo : undefined,
  };
}

// ─── Dimension-level validators ────────────────────────────────────────

/**
 * Validate an ATS analysis response.
 */
export function validateATS(data: unknown): ATSAnalysis & { suggestions: Suggestion[] } {
  if (!isObject(data)) throw new ValidationError("ats", "Response is not an object");

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  const score = isNumberInRange(data.score, 0, 100) ? data.score : 70;
  const breakdown = isObject(data.breakdown) ? data.breakdown : {};

  return {
    score,
    breakdown: {
      formatting: isNumberInRange(breakdown.formatting, 0, 100) ? breakdown.formatting : score,
      keywords: isNumberInRange(breakdown.keywords, 0, 100) ? breakdown.keywords : score,
      sections: isNumberInRange(breakdown.sections, 0, 100) ? breakdown.sections : score,
      readability: isNumberInRange(breakdown.readability, 0, 100) ? breakdown.readability : score,
    },
    missingElements: isStringArray(data.missingElements) ? data.missingElements : [],
    warnings: isStringArray(data.warnings) ? data.warnings : [],
    suggestions,
  };
}

/**
 * Validate a grammar analysis response.
 */
export function validateGrammar(data: unknown): GrammarAnalysis & { suggestions: Suggestion[] } {
  if (!isObject(data)) throw new ValidationError("grammar", "Response is not an object");

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  const errors = Array.isArray(data.errors)
    ? data.errors
        .map((e: unknown) => {
          if (!isObject(e)) return null;
          const pos = isObject(e.position) ? e.position : {};
          return {
            text: isString(e.text) ? e.text : "",
            correction: isString(e.correction) ? e.correction : "",
            type: isString(e.type) && ["spelling", "grammar", "punctuation", "style"].includes(e.type)
              ? (e.type as "spelling" | "grammar" | "punctuation" | "style")
              : "grammar" as const,
            position: {
              start: isNumberInRange(pos.start, 0, Infinity) ? (pos.start as number) : 0,
              end: isNumberInRange(pos.end, 0, Infinity) ? (pos.end as number) : 0,
            },
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
    : [];

  return {
    errors,
    overallScore: isNumberInRange(data.overallScore, 0, 100) ? data.overallScore : 70,
    suggestions,
  };
}

/**
 * Validate an impact analysis response.
 */
export function validateImpact(data: unknown): ImpactAnalysis & { suggestions: Suggestion[] } {
  if (!isObject(data)) throw new ValidationError("impact", "Response is not an object");

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  const statements = Array.isArray(data.statements)
    ? data.statements
        .map((s: unknown) => {
          if (!isObject(s)) return null;
          return {
            text: isString(s.text) ? s.text : "",
            hasMetric: typeof s.hasMetric === "boolean" ? s.hasMetric : false,
            hasActionVerb: typeof s.hasActionVerb === "boolean" ? s.hasActionVerb : false,
            verb: isString(s.verb) ? s.verb : null,
            suggestedVerb: isString(s.suggestedVerb) ? s.suggestedVerb : undefined,
            score: isNumberInRange(s.score, 0, 100) ? s.score : 50,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
    : [];

  return {
    statements,
    overallScore: isNumberInRange(data.overallScore, 0, 100) ? data.overallScore : 70,
    weakVerbs: isStringArray(data.weakVerbs) ? data.weakVerbs : [],
    strongVerbsUsed: isStringArray(data.strongVerbsUsed) ? data.strongVerbsUsed : [],
    suggestions,
  };
}

/**
 * Validate a keyword analysis response.
 */
export function validateKeywords(data: unknown): KeywordAnalysis & { suggestions: Suggestion[] } {
  if (!isObject(data)) throw new ValidationError("keywords", "Response is not an object");

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  return {
    present: isStringArray(data.present) ? data.present : [],
    missing: isStringArray(data.missing) ? data.missing : [],
    density: isObject(data.density)
      ? (Object.fromEntries(
          Object.entries(data.density).filter(
            ([k, v]) => typeof k === "string" && typeof v === "number",
          ),
        ) as Record<string, number>)
      : {},
    topMatchScore: isNumberInRange(data.topMatchScore, 0, 100) ? data.topMatchScore : 0,
    suggestions,
  };
}

/**
 * Validate a summary analysis response.
 */
export function validateSummary(data: unknown): SummaryAnalysis {
  if (!isObject(data)) throw new ValidationError("summary", "Response is not an object");

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  const length = isString(data.length) && ["too-short", "optimal", "too-long"].includes(data.length)
    ? (data.length as "too-short" | "optimal" | "too-long")
    : "optimal";

  return {
    score: isNumberInRange(data.score, 0, 100) ? data.score : 70,
    feedback: isString(data.feedback) ? data.feedback : "",
    suggestions: suggestions.map((s) => ({
      original: isString(s.targetText) ? s.targetText : "",
      improved: isString(s.suggestedText) ? s.suggestedText : "",
      reason: s.reason,
    })),
    wordCount: isNumberInRange(data.wordCount, 0, Infinity) ? data.wordCount : 0,
    hasMetrics: typeof data.hasMetrics === "boolean" ? data.hasMetrics : false,
    length,
  };
}

/**
 * Validate a tone analysis response.
 */
export function validateTone(data: unknown): ToneAnalysis {
  if (!isObject(data)) throw new ValidationError("tone", "Response is not an object");

  const rawSuggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  return {
    overallScore: isNumberInRange(data.overallScore, 0, 100) ? data.overallScore : 70,
    tone: isString(data.tone) ? data.tone : "",
    consistency: isNumberInRange(data.consistency, 0, 100) ? data.consistency : 70,
    suggestions: isStringArray(data.suggestions)
      ? (data.suggestions as string[])
      : rawSuggestions.map((s) => s.reason),
  };
}

// ─── Aggregate validation ──────────────────────────────────────────────

/**
 * Validate a raw dimension response against its expected schema.
 * Returns the validated result or null on failure.
 *
 * @param dimension — the analysis dimension name
 * @param raw — the parsed JSON from the LLM response
 */
export function validateDimensionResult(
  dimension: string,
  raw: unknown,
): Record<string, unknown> | null {
  try {
    switch (dimension) {
      case "ats":
        return validateATS(raw) as unknown as Record<string, unknown>;
      case "grammar":
        return validateGrammar(raw) as unknown as Record<string, unknown>;
      case "impact":
        return validateImpact(raw) as unknown as Record<string, unknown>;
      case "keywords":
        return validateKeywords(raw) as unknown as Record<string, unknown>;
      case "summary":
        return validateSummary(raw) as unknown as Record<string, unknown>;
      case "tone":
        return validateTone(raw) as unknown as Record<string, unknown>;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Validate a cover letter generation response.
 */
export function validateCoverLetter(data: unknown): GeneratedCoverLetter {
  if (!isObject(data)) {
    return { body: "", salutation: "Dear Hiring Manager,", closing: "Sincerely," };
  }

  return {
    body: isString(data.body) ? data.body : "",
    salutation: isString(data.salutation) ? data.salutation : "Dear Hiring Manager,",
    closing: isString(data.closing) ? data.closing : "Sincerely,",
  };
}

/**
 * Validate a job match response.
 */
export function validateJobMatch(data: unknown): JobMatchResult {
  if (!isObject(data)) {
    return { matchScore: null, missingSkills: [], presentSkills: [], suggestions: [] };
  }

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.map(validateSuggestion).filter((s): s is Suggestion => s !== null)
    : [];

  return {
    matchScore: isNumberInRange(data.matchScore, 0, 100) ? data.matchScore : null,
    missingSkills: isStringArray(data.missingSkills) ? data.missingSkills : [],
    presentSkills: isStringArray(data.presentSkills) ? data.presentSkills : [],
    suggestions,
  };
}
