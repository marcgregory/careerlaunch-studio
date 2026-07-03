import type { Suggestion, SuggestionStatus } from "@careerlaunch/ai";

export interface AnalysisState {
  status: "idle" | "loading" | "success" | "error";
  overallScore: number | null;
  suggestions: ClientSuggestion[];
  analyzedAt: string | null;
  error: string | null;
}

export interface ClientSuggestion extends Suggestion {
  status: SuggestionStatus;
}
