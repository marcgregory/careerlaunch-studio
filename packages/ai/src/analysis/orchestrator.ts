import type { ResumeDocument } from "@careerlaunch/domain";
import { normalizeResume } from "./normalize";
import { runStaticAnalysis } from "./static";
import type {
  AnalysisDimension,
  AnalysisResult,
  AnalysisMetadata,
  ResumeStatistics,
} from "./types";
import type { Suggestion } from "../suggestion/types";
import { getProvider } from "../providers/index";
import { computeOverallScore } from "../scoring/index";

export interface AnalyzeOptions {
  /** Resume version for tracking */
  resumeVersion?: number;
  /** Job description to include in keyword analysis */
  jobDescription?: string;
  /** Which dimensions to analyze (default: all) */
  dimensions?: AnalysisDimension[];
  /** Named provider to use (default: the registered default) */
  providerName?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

const ALL_DIMENSIONS: AnalysisDimension[] = [
  "ats",
  "grammar",
  "impact",
  "keywords",
  "summary",
  "tone",
];

/**
 * Analyze a resume: run static analysis first, then AI analysis for each
 * requested dimension. Results are merged into a single suggestion set.
 *
 * Static analysis is always included. AI dimensions are optional and run
 * in parallel. One dimension failing does not block the others.
 */
export async function analyzeResume(
  resume: ResumeDocument,
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const { resumeVersion = 1, dimensions = ALL_DIMENSIONS, jobDescription, providerName, signal } = options;

  const normalized = normalizeResume(resume);

  // Step 1: Static analysis (always runs, no AI calls)
  const { suggestions: staticSuggestions, statistics } = runStaticAnalysis(normalized);

  // Step 2: AI analysis per dimension
  const provider = getProvider(providerName);
  const providersUsed = [provider.name];
  const dimensionsFailed: string[] = [];

  const dimensionResults = await Promise.all(
    dimensions.map(async (dim) => {
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const result = await provider.analyze(
          dim,
          { resume: normalized, jobDescription },
          { signal, maxRetries: 0 },
        );
        return { dimension: dim, suggestions: result.suggestions, failed: false };
      } catch (error) {
        if (signal?.aborted) {
          throw error; // Let abort propagate
        }
        dimensionsFailed.push(dim);
        return { dimension: dim, suggestions: [], failed: true };
      }
    }),
  );

  // Step 3: Merge all suggestions, deduplicating by id.
  // Both static analysis and AI providers can produce the same logical
  // suggestion for the same finding. When one exists, prefer the AI source
  // (higher-enrichment) over the static source (deterministic).
  const merged = new Map<string, Suggestion>();
  for (const s of staticSuggestions) {
    merged.set(s.id, s);
  }
  for (const s of dimensionResults.flatMap((r) => r.suggestions)) {
    // AI suggestions overwrite static ones for the same finding
    merged.set(s.id, s);
  }
  let allSuggestions = Array.from(merged.values());

  // Step 3b: Filter out low-value suggestions that produce noise without actionable insight.
  // Pattern: pronoun-consistency / first-person tone warnings from the AI provider.
  const LOW_VALUE_PATTERNS = [
    /pronoun (use|consistency|switch)/i,
    /first.person/i,
    /\bI\s+believe\b|\bIn my opinion\b/i,
  ];
  allSuggestions = allSuggestions.filter(
    (s) => !LOW_VALUE_PATTERNS.some((p) => p.test(s.title) || p.test(s.reason)),
  );

  // Step 4: Compute overall score
  const overallScore = computeOverallScore(allSuggestions, normalized);

  const metadata: AnalysisMetadata = {
    duration: Date.now() - startedAt,
    providersUsed,
    dimensionsFailed,
  };

  return {
    resumeId: resume.id,
    resumeVersion,
    analyzedAt: new Date().toISOString(),
    resumeStatistics: statistics,
    ats: null,
    grammar: null,
    impact: null,
    keywords: null,
    summary: null,
    tone: null,
    overallScore,
    suggestions: allSuggestions,
    metadata,
  };
}
