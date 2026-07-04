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

/** Result from a single dimension analysis */
export interface DimensionResult {
  suggestions: Suggestion[];
  raw?: unknown;
}

/**
 * Each AI provider implements this interface.
 * Providers are stateless — all state lives in the analysis engine.
 *
 * Methods marked with `?` are optional — not every provider needs to
 * implement every capability. The calling code falls back to a
 * deterministic implementation when the provider does not support a
 * capability.
 */
export interface AIProvider {
  /** Human-readable name for display (e.g. "Gemini 2.5 Flash") */
  readonly name: string;

  /** Analyze a specific dimension of the resume */
  analyze(
    dimension: AnalysisDimension,
    input: AnalysisInput,
    options?: AnalysisOptions,
  ): Promise<DimensionResult>;

  /**
   * Generate a cover letter tailored to a job.
   * If not implemented, the caller falls back to the deterministic generator.
   */
  generateCoverLetter?(input: CoverLetterInput): Promise<GeneratedCoverLetter>;

  /**
   * AI-powered job match comparing a resume against a job description.
   * If not implemented, the caller falls back to the dictionary-based matcher.
   */
  matchJob?(resume: NormalizedResume, jobDescription: string): Promise<JobMatchResult>;

  /** Check if the provider is available */
  healthCheck(): Promise<ProviderHealth>;
}
