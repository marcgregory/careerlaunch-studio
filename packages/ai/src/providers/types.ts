import type {
  AnalysisDimension,
  AnalysisInput,
  AnalysisOptions,
  ProviderHealth,
} from "../analysis/types";
import type { Suggestion } from "../suggestion/types";

/** Result from a single dimension analysis */
export interface DimensionResult {
  suggestions: Suggestion[];
  raw?: unknown;
}

/**
 * Each AI provider implements this interface.
 * Providers are stateless — all state lives in the analysis engine.
 */
export interface AIProvider {
  /** Human-readable name for display (e.g. "OpenAI GPT-4o") */
  readonly name: string;

  /** Analyze a specific dimension of the resume */
  analyze(
    dimension: AnalysisDimension,
    input: AnalysisInput,
    options?: AnalysisOptions,
  ): Promise<DimensionResult>;

  /** Check if the provider is available */
  healthCheck(): Promise<ProviderHealth>;
}
