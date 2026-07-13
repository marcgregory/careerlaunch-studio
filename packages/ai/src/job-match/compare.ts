import type { NormalizedResume } from "../analysis/types";
import type { NormalizedJob } from "./types";
import { suggestionId } from "../suggestion/types";
import type { Suggestion } from "../suggestion/types";
import {
  createSkillMap,
  findSkillMentionInItems,
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

function skillMentionedInResumeSkills(skill: string, resume: NormalizedResume): boolean {
  return findSkillMentionInItems(skill, resume.skills) !== null;
}

export function skillPresentInResume(skill: string, resume: NormalizedResume): string | null {
  const existingSkill = createSkillMap(resume.skills).get(normalizeSkill(skill));
  if (existingSkill) return skillDisplayValue(existingSkill);
  if (skillMentionedInResumeSkills(skill, resume)) return formatSkillName(skill);
  if (skillMentionedInResume(skill, resume)) return formatSkillName(skill);
  return null;
}

const CANONICAL_SKILL_DISPLAY: Record<string, string> = {
  ai: "AI",
  api: "API",
  aws: "AWS",
  css: "CSS",
  gcp: "GCP",
  github: "GitHub",
  html: "HTML",
  javascript: "JavaScript",
  jquery: "jQuery",
  llm: "LLM",
  mysql: "MySQL",
  php: "PHP",
  seo: "SEO",
  sql: "SQL",
};

/**
 * Normalize a skill name to canonical display casing.
 */
function formatSkillName(skill: string): string {
  const normalized = normalizeSkill(skill);
  const canonical = CANONICAL_SKILL_DISPLAY[normalized];
  if (canonical) return canonical;

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
    } else if (skillMentionedInResumeSkills(rawSkill, resume)) {
      presentSkills.push(formatSkillName(rawSkill));
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
export function reconcileSkillComparison(
  input: Pick<ComparisonResult, "missingSkills" | "presentSkills" | "suggestions">,
  resume: NormalizedResume,
): ComparisonResult {
  const presentByKey = new Map<string, string>();
  const missingByKey = new Map<string, string>();

  for (const skill of input.presentSkills) {
    const key = normalizeSkill(skill);
    if (key && !presentByKey.has(key)) {
      presentByKey.set(key, skillPresentInResume(skill, resume) ?? formatSkillName(skill));
    }
  }

  for (const skill of input.missingSkills) {
    const key = normalizeSkill(skill);
    if (!key || presentByKey.has(key) || missingByKey.has(key)) continue;

    const presentSkill = skillPresentInResume(skill, resume);
    if (presentSkill) {
      presentByKey.set(key, presentSkill);
    } else {
      missingByKey.set(key, formatSkillName(skill));
    }
  }

  const suggestions = input.suggestions.filter((suggestion) => {
    const skill = suggestion.suggestedText ?? suggestion.title;
    const key = normalizeSkill(skill);
    return key ? missingByKey.has(key) : true;
  });

  return {
    missingSkills: [...missingByKey.values()],
    presentSkills: [...presentByKey.values()],
    suggestions,
  };
}
