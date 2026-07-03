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
