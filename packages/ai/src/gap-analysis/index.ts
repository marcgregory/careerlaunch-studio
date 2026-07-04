/**
 * Gap Analysis — Phase 2 of the AI Resume Tailoring pipeline.
 *
 * Compares the analyzed job against the normalized resume to produce
 * a detailed gap report. Delegates to the AI provider if available,
 * falls back to the existing dictionary-based matcher.
 */

import type { GapAnalysis, GapAnalysisInput } from "./types";
import { emptyGapAnalysis } from "./types";
import type { NormalizedResume } from "../analysis/types";
import type { JobAnalysis } from "../job-analysis/types";
import { getProvider } from "../providers/index";
import { deterministicRunJobMatch } from "../job-match/index";

export type { GapAnalysis, GapAnalysisInput, GapWeakSection, GapRecommendation, GapRecommendationType } from "./types";

/**
 * Run gap analysis — compare resume against analyzed job.
 *
 * Delegates to the configured AI provider if it supports `analyzeGap`.
 * Falls back to the dictionary-based deterministic matcher.
 */
export async function runGapAnalysis(
  input: GapAnalysisInput,
  options?: { providerName?: string },
): Promise<GapAnalysis> {
  // Try the AI provider first
  try {
    const provider = options?.providerName
      ? getProvider(options.providerName)
      : getProvider();

    if (provider.analyzeGap) {
      try {
        return await provider.analyzeGap(input);
      } catch {
        // Fall through to deterministic
      }
    }
  } catch {
    // No provider registered — fall through
  }

  return deterministicGapAnalysis(input);
}

/**
 * Deterministic gap analysis using the existing dictionary-based matcher.
 *
 * Reuses the existing `deterministicRunJobMatch()` logic to compare
 * resume skills against job description skills.
 */
export function deterministicGapAnalysis(input: GapAnalysisInput): GapAnalysis {
  const { resume, jobAnalysis, jobDescription } = input;

  // Use the existing deterministic job-match for skill comparison
  const matchResult = deterministicRunJobMatch({
    resume: { ...resume, skills: resume.skills ?? [] },
    jobDescription,
  });

  const matchedSkills = matchResult.presentSkills;
  const missingSkills = matchResult.missingSkills;
  const matchScore = matchResult.matchScore ?? 0;

  const weakSections: GapAnalysis["weakSections"] = [];
  const recommendations: GapAnalysis["recommendations"] = [];

  // Check summary
  if (!resume.summary || resume.summary.trim().length < 60) {
    weakSections.push({
      sectionId: "summary",
      field: "summary",
      reason: "Professional summary is too short or empty for this role.",
      severity: "major",
    });
    recommendations.push({
      type: "rewrite_summary",
      sectionId: "summary",
      reason: "Expand summary to highlight skills relevant to this position.",
    });
  }

  // Check missing skills
  for (const skill of missingSkills) {
    recommendations.push({
      type: "add_skill",
      sectionId: "skills",
      reason: `Add "${skill}" to match job requirements.`,
    });
  }

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    weakSections,
    recommendations,
  };
}
