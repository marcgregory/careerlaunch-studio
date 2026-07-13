import type { ClientSuggestion } from "./types";

export function isAppliedSuggestion(suggestion: Pick<ClientSuggestion, "status">): boolean {
  return suggestion.status === "applied" || suggestion.status === "accepted";
}

export function isDismissedSuggestion(suggestion: Pick<ClientSuggestion, "status">): boolean {
  return suggestion.status === "dismissed" || suggestion.status === "rejected";
}

export function isPendingSuggestion(suggestion: Pick<ClientSuggestion, "status">): boolean {
  return suggestion.status === "pending";
}

export function countAppliedSuggestions(suggestions: ReadonlyArray<Pick<ClientSuggestion, "status">>): number {
  return suggestions.filter(isAppliedSuggestion).length;
}

export function countDismissedSuggestions(suggestions: ReadonlyArray<Pick<ClientSuggestion, "status">>): number {
  return suggestions.filter(isDismissedSuggestion).length;
}

export function countDetectedIssues(suggestions: ReadonlyArray<Pick<ClientSuggestion, "status">>): number {
  return suggestions.filter((suggestion) => !isAppliedSuggestion(suggestion)).length;
}
