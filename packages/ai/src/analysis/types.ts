import type { Suggestion } from "../suggestion/types";

/** All analysis dimensions the engine can evaluate */
export type AnalysisDimension =
  | "ats"
  | "grammar"
  | "impact"
  | "keywords"
  | "summary"
  | "tone";

/** A normalized resume consumed by analysis providers */
export interface NormalizedResume {
  contact: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    website: string;
  };
  summary: string;
  sections: NormalizedSection[];
  skills: string[];
  certifications: string[];
  projects: NormalizedProject[];
}

export interface NormalizedSection {
  id: string;
  type: "experience" | "education";
  role?: string;
  company?: string;
  school?: string;
  degree?: string;
  bullets: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface NormalizedProject {
  name: string;
  description: string;
  bullets: string[];
}

/** Input structure for a single analysis dimension */
export interface AnalysisInput {
  resume: NormalizedResume;
  /** Job description, if provided by the user */
  jobDescription?: string;
}

/** Options passed to a provider call */
export interface AnalysisOptions {
  signal?: AbortSignal;
  maxRetries?: number;
}

// ─── Dimension-specific responses ───────────────────────────────

export interface ATSAnalysis {
  score: number;
  breakdown: {
    formatting: number;
    keywords: number;
    sections: number;
    readability: number;
  };
  missingElements: string[];
  warnings: string[];
}

export interface GrammarError {
  text: string;
  correction: string;
  type: "spelling" | "grammar" | "punctuation" | "style";
  position: { start: number; end: number };
}

export interface GrammarAnalysis {
  errors: GrammarError[];
  overallScore: number;
}

export interface ImpactStatement {
  text: string;
  hasMetric: boolean;
  hasActionVerb: boolean;
  verb: string | null;
  suggestedVerb?: string;
  score: number;
}

export interface ImpactAnalysis {
  statements: ImpactStatement[];
  overallScore: number;
  weakVerbs: string[];
  strongVerbsUsed: string[];
}

export interface KeywordAnalysis {
  present: string[];
  missing: string[];
  density: Record<string, number>;
  topMatchScore: number;
}

export interface SummarySuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface SummaryAnalysis {
  score: number;
  feedback: string;
  suggestions: SummarySuggestion[];
  wordCount: number;
  hasMetrics: boolean;
  length: "too-short" | "optimal" | "too-long";
}

export interface ToneAnalysis {
  overallScore: number;
  tone: string;
  consistency: number;
  suggestions: string[];
}

// ─── Combined result ────────────────────────────────────────────

export interface AnalysisMetadata {
  duration: number;
  providersUsed: string[];
  dimensionsFailed: string[];
}

export interface AnalysisResult {
  resumeId: string;
  resumeVersion: number;
  analyzedAt: string;
  ats: ATSAnalysis | null;
  grammar: GrammarAnalysis | null;
  impact: ImpactAnalysis | null;
  keywords: KeywordAnalysis | null;
  summary: SummaryAnalysis | null;
  tone: ToneAnalysis | null;
  overallScore: number;
  suggestions: Suggestion[];
  metadata: AnalysisMetadata;
}

/** Provider health status */
export interface ProviderHealth {
  available: boolean;
  model?: string;
  latency?: number;
}

/** Analysis quota tracking */
export interface AnalysisQuota {
  used: number;
  limit: number;
  resetAt: string;
}
