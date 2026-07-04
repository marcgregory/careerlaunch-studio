// Public API for the AI analysis package

export { analyzeResume } from "./analysis/orchestrator";
export type { AnalyzeOptions } from "./analysis/orchestrator";
export { normalizeResume } from "./analysis/normalize";
export { runStaticAnalysis } from "./analysis/static";

export type {
  AnalysisDimension,
  NormalizedResume,
  NormalizedSection,
  NormalizedProject,
  AnalysisInput,
  AnalysisOptions,
  ATSAnalysis,
  GrammarError,
  GrammarAnalysis,
  ImpactStatement,
  ImpactAnalysis,
  KeywordAnalysis,
  SummarySuggestion,
  SummaryAnalysis,
  ToneAnalysis,
  AnalysisMetadata,
  AnalysisResult,
  ProviderHealth,
  AnalysisQuota,
  AnalysisRunRecord,
} from "./analysis/types";

export {
  registerProvider,
  getProvider,
  setDefaultProvider,
  listProviders,
  clearProviders,
} from "./providers/index";
export type { AIProvider, DimensionResult } from "./providers/types";
export { MockProvider } from "./providers/mock";
export { GeminiProvider } from "./providers/gemini";
export type { GeminiProviderConfig } from "./providers/gemini";
export { GroqProvider } from "./providers/groq";
export type { GroqProviderConfig } from "./providers/groq";

export type {
  Suggestion,
  SuggestionCategory,
  SuggestionSeverity,
  SuggestionSource,
  SuggestionStatus,
  SuggestionLocation,
  StoredSuggestion,
} from "./suggestion/types";

export { computeOverallScore, computeCategoryScores } from "./scoring/index";

// Job-match engine
export { runJobMatch, deterministicRunJobMatch, normalizeJobDescription, compare, computeMatchScore, analyzeKeywords } from "./job-match/index";
export type { JobMatchResult, JobMatchInput, NormalizedJob } from "./job-match/types";

// Suggestion-to-operation factory
export { createOperations, suggestionToOperation } from "./operations/factory";

// Apply engine
export { applyChanges, ApplyError } from "./apply/index";
export type {
  ApplyOperation,
  ReplaceSummaryOperation,
  ReplaceBulletOperation,
  ReplaceSkillOperation,
  AddSkillOperation,
  RemoveSkillOperation,
  AppliedChange,
  ApplyResult,
} from "./apply/index";

// Cover letter generator
export { generateCoverLetter, deterministicGenerateCoverLetter } from "./cover-letter/index";
export type { CoverLetterInput, GeneratedCoverLetter } from "./cover-letter/types";

// LLM helpers
export { callGemini, callOpenAICompatible, LLMError } from "./lib/llm";
export type { CallGeminiConfig, CallOpenAICompatibleConfig } from "./lib/llm";

// Token utilities
export { estimateTokens, truncateToTokens, estimateObjectTokens } from "./lib/tokens";

// Prompt loader (internal — loaded directly by server-side code)
// Export removed from barrel to avoid bundling node:fs/node:path in client bundles.
// Import via: import { loadPrompt } from "@careerlaunch/ai/lib/prompts"

// Validation
export {
  validateDimensionResult,
  validateATS,
  validateGrammar,
  validateImpact,
  validateKeywords,
  validateSummary,
  validateTone,
  validateCoverLetter,
  validateJobMatch,
  ValidationError,
} from "./lib/validate";

// Cost controls
export { withCostControls, checkTokenBudget, recordTokenUsage, getCallCount, estimateAnalysisTokens, CostLimitError } from "./lib/cost-control";
export type { CostConfig } from "./lib/cost-control";
export { DEFAULT_COST_CONFIG } from "./lib/cost-control";

// Cache
export {
  buildCacheKey,
  hashValue,
  getCachedResult,
  setCachedResult,
  getDimensionTTL,
  invalidateCache,
  clearCache,
  getCacheStats,
} from "./lib/cache";
