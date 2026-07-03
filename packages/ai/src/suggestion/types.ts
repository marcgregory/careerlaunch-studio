/** Category of resume issue or area of analysis */
export type SuggestionCategory =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "contact"
  | "formatting"
  | "ats"
  | "grammar"
  | "impact"
  | "keywords"
  | "completeness";

/** How important this suggestion is */
export type SuggestionSeverity = "critical" | "major" | "medium" | "minor" | "info";

/** Source of the suggestion */
export type SuggestionSource = "static" | "ai";

/** User-facing state of a suggestion */
export type SuggestionStatus =
  | "pending"
  | "accepted"
  | "applied"
  | "rejected"
  | "dismissed";

/** Location within a resume that a suggestion targets */
export interface SuggestionLocation {
  /** Resume section key */
  sectionId: string;
  /** Specific entry within a list (e.g., experience item id) */
  entryId?: string;
  /** Field path within the entry (e.g., "bullets[2]", "jobTitle") */
  field?: string;
}

/** A single suggestion, regardless of source (static or AI) */
export interface Suggestion {
  /** Unique stable identifier for deduplication */
  id: string;
  /** Which area of the resume this applies to */
  category: SuggestionCategory;
  /** How important this is to fix */
  severity: SuggestionSeverity;
  /** Short user-facing headline */
  title: string;
  /** Longer explanation of what is wrong and why it matters */
  reason: string;
  /** Exact text this suggestion targets (null for whole-resume issues) */
  targetText: string | null;
  /** Suggested replacement (null for informational suggestions) */
  suggestedText: string | null;
  /** Section and field path this applies to */
  location: SuggestionLocation;
  /** Model confidence (0–1). Static analysis always returns 1. */
  confidence: number;
  /** Whether this came from static analysis or AI */
  source: SuggestionSource;
  /** Human-readable label for which AI provider/model generated this */
  modelInfo?: string;
}

/** Full suggestion with status for database persistence */
export interface StoredSuggestion extends Suggestion {
  status: SuggestionStatus;
}

/**
 * Create a deterministic, unique suggestion ID from its semantic parts.
 *
 * Two suggestions with the same (category, code, path) are the same logical
 * finding, regardless of whether they came from static or AI analysis.
 * This lets the orchestrator deduplicate while keeping a stable, readable ID.
 *
 * @param category — the SuggestionCategory (e.g. "summary", "impact")
 * @param code     — a short kebab-case code for the specific check (e.g. "too-short")
 * @param path     — location context: sectionId, entryId, or a composite path.
 *                  Omit for whole-resume suggestions. Defaults to "resume".
 */
export function suggestionId(category: string, code: string, path?: string): string {
  return [category, code, path ?? "resume"].join(":").replace(/[^a-zA-Z0-9:_-]/g, "-");
}
