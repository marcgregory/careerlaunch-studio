import type { NormalizedJob } from "./types";
import type { NormalizedResume } from "../analysis/types";
import { normalizeSkill } from "../skills/normalization";

/**
 * Extract keyword-related metadata from a job match comparison.
 *
 * This module provides additional keyword analysis beyond simple skill
 * matching â€” token overlap, density, and frequency analysis.
 * Primarily used for debugging and future AI enrichment.
 */

export interface KeywordAnalysis {
  /** Total unique tokens in the job description */
  totalTokens: number;
  /** Tokens that appear in both the JD and the resume */
  overlapTokens: string[];
  /** Overlap ratio (0â€“1) */
  overlapRatio: number;
}

/**
 * Build a set of significant tokens from a resume for comparison.
 * Filters out very common stop words and short tokens.
 */
function resumeTokenSet(resume: NormalizedResume): Set<string> {
  const STOP_WORDS = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "must", "i", "me", "my", "we", "our", "us", "this", "that", "these",
    "those", "it", "its", "they", "them", "their", "he", "she", "his",
    "her", "not", "no", "nor", "so", "if", "then", "than", "too", "very",
    "just", "about", "also", "more", "most", "some", "any", "each",
    "every", "all", "both", "few", "many", "much",
  ]);

  const text = [
    resume.summary,
    ...resume.sections.flatMap((s) => s.bullets),
    ...resume.sections.flatMap((s) => [s.role, s.company].filter(Boolean)),
    ...resume.projects.flatMap((p) => [p.name, p.description, ...p.bullets]),
    ...resume.skills,
  ]
    .join(" ")
    .toLowerCase();

  const tokens = text
    .replace(/[^a-z0-9\s/.#+_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const tokenSet = new Set(tokens);
  for (const skill of resume.skills) {
    const normalized = normalizeSkill(skill);
    if (normalized) tokenSet.add(normalized);
  }

  return tokenSet;
}

/**
 * Analyze keyword overlap between the resume and job description.
 *
 * Compares significant tokens (excluding stop words, short tokens)
 * from both sides and returns overlap statistics.
 */
export function analyzeKeywords(
  resume: NormalizedResume,
  job: NormalizedJob,
): KeywordAnalysis {
  const resumeTokens = resumeTokenSet(resume);
  const jobTokens = new Set(job.tokens.filter((t) => t.length > 2));
  for (const skill of job.skills) {
    const normalized = normalizeSkill(skill);
    if (normalized) jobTokens.add(normalized);
  }

  const overlapTokens: string[] = [];
  for (const token of jobTokens) {
    if (resumeTokens.has(token)) {
      overlapTokens.push(token);
    }
  }

  overlapTokens.sort();

  const totalTokens = jobTokens.size;
  const overlapRatio = totalTokens > 0 ? overlapTokens.length / totalTokens : 0;

  return {
    totalTokens,
    overlapTokens,
    overlapRatio: Math.round(overlapRatio * 100) / 100,
  };
}
