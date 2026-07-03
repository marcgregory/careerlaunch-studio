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
export { runJobMatch, normalizeJobDescription, compare, computeMatchScore, analyzeKeywords } from "./job-match/index";
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
export { generateCoverLetter } from "./cover-letter/index";
export type { CoverLetterInput, GeneratedCoverLetter } from "./cover-letter/types";
