import type { NormalizedResume } from "../analysis/types";
import type { NormalizedJob } from "./types";
import { suggestionId } from "../suggestion/types";
import type { Suggestion } from "../suggestion/types";
import {
  createSkillMap,
  normalizeSkill,
  normalizedSkillMentioned,
  skillDisplayValue,
} from "../skills/normalization";

/**
 * Result of comparing a resume to a normalized job description.
 */
export interface ComparisonResult {
  /** Skills in the JD that the resume is missing */
  missingSkills: string[];
  /** Skills in the JD that the resume already has */
  presentSkills: string[];
  /** Actionable suggestions for missing skills */
  suggestions: Suggestion[];
}

/**
 * Check if a skill name appears anywhere in the resume text (bullets, summary).
 */
function skillMentionedInResume(skill: string, resume: NormalizedResume): boolean {
  const searchText = [
    resume.summary,
    ...resume.sections.flatMap((s) => s.bullets),
    ...resume.projects.flatMap((p) => p.bullets),
  ].join(" ");

  return normalizedSkillMentioned(skill, searchText);
}

/**
 * Normalize a skill name to a canonical casing (first letter uppercase).
 */
function formatSkillName(skill: string): string {
  return skillDisplayValue(skill)
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Compare a normalized resume against a normalized job description.
 *
 * Returns which JD skills the resume already has (in its skills list or
 * mentioned in text), which are missing, and a set of `Suggestion` objects
 * for adding missing skills.
 */
export function compare(
  resume: NormalizedResume,
  job: NormalizedJob,
): ComparisonResult {
  const resumeSkillMap = createSkillMap(resume.skills);
  const seenJobSkills = new Set<string>();
  const presentSkills: string[] = [];
  const missingSkills: string[] = [];
  const suggestions: Suggestion[] = [];

  for (const rawSkill of job.skills) {
    const normalizedSkill = normalizeSkill(rawSkill);
    if (!normalizedSkill || seenJobSkills.has(normalizedSkill)) continue;
    seenJobSkills.add(normalizedSkill);

    const existingSkill = resumeSkillMap.get(normalizedSkill);
    if (existingSkill) {
      presentSkills.push(skillDisplayValue(existingSkill));
    } else if (skillMentionedInResume(rawSkill, resume)) {
      // The skill appears in text but is not in the formal skills list, so
      // suggest adding it.
      const formatted = formatSkillName(rawSkill);
      presentSkills.push(formatted);
      suggestions.push({
        id: suggestionId("skills", "add", normalizedSkill.replace(/\s+/g, "-")),
        category: "job-match",
        severity: "medium",
        title: `Add "${formatted}" to your skills list`,
        reason: `Your resume mentions "${formatted}" in the body text, but it's not listed in your Skills section. Adding it improves ATS keyword matching.`,
        targetText: null,
        suggestedText: formatted,
        location: { sectionId: "skills" },
        confidence: 1,
        source: "static",
      });
    } else {
      const formatted = formatSkillName(rawSkill);
      missingSkills.push(formatted);
      suggestions.push({
        id: suggestionId("skills", "add", normalizedSkill.replace(/\s+/g, "-")),
        category: "job-match",
        severity: "medium",
        title: `Add "${formatted}" to your skills list`,
        reason: `"${formatted}" appears in the job description but is not found in your resume. Adding this skill (if you have it) will strengthen your match.`,
        targetText: null,
        suggestedText: formatted,
        location: { sectionId: "skills" },
        confidence: 0.9,
        source: "ai",
      });
    }
  }

  return { missingSkills, presentSkills, suggestions };
}