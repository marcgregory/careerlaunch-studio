/**
 * Cover Letter Context Layer
 *
 * Transforms a raw ResumeDocument into a clean, curated context object
 * for the cover letter prompt. This prevents the LLM from dumping raw
 * fields, repeating technology lists, parsing dates as roles, or losing
 * the signal in noise.
 *
 * Main rule: the LLM receives curated facts, not the whole resume dump.
 */

import type { CoverLetterContext } from "./types";
import type { ResumeDocument } from "@careerlaunch/domain";

// ─── Date pattern for role guard ────────────────────────────────────────
// Rejects any role that contains a 4-digit year, since legitimate job
// titles never contain 4 consecutive digits. This catches cases like
// "Feb 2023 – May 2025", "January 2020 - Present", "2021-2023", etc.
const HAS_YEAR_RE = /\d{4}/;

/**
 * Detect grouped skill strings like "FRONTEND - HTML, CSS, JavaScript"
 * and split them into individual skills.
 */
function flattenGroupedSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of skills) {
    // Matches "CATEGORY - skill1, skill2, skill3" or "CATEGORY: skill1, skill2"
    const groupedMatch = skill.match(
      /^[\w#+./-]+\s*[-–—:]\s*(.+)$/,
    );
    if (groupedMatch) {
      // Split by comma or pipe, trim each
      const parts = groupedMatch[1].split(/[,|]/).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          result.push(part);
        }
      }
    } else {
      const lower = skill.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(skill);
      }
    }
  }
  return result;
}

/**
 * Score a skill's relevance against a job description by counting
 * how many times it (or its subwords) appear.
 */
function skillJdScore(skill: string, jdLower: string): number {
  const skillLower = skill.toLowerCase();
  let score = 0;

  // Exact phrase match (whole skill)
  if (jdLower.includes(skillLower)) {
    score += 10;
  }

  // Word-level matches
  const skillWords = skillLower.split(/[\s/]+/);
  for (const word of skillWords) {
    if (word.length < 2) continue; // skip single chars
    if (jdLower.includes(word)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Select up to `max` skills that are most relevant to the job description.
 * When no JD is available, returns the first `max` skills (deterministic).
 */
function prioritizeSkills(
  skills: string[],
  jobDescription?: string,
  max: number = 5,
): string[] {
  const flat = flattenGroupedSkills(skills);
  if (flat.length === 0) return [];

  if (!jobDescription) {
    return flat.slice(0, Math.min(max, flat.length));
  }

  const jdLower = jobDescription.toLowerCase();

  // Score and sort
  const scored = flat
    .map((skill) => ({ skill, score: skillJdScore(skill, jdLower) }))
    .sort((a, b) => b.score - a.score || flat.indexOf(a.skill) - flat.indexOf(b.skill));

  return scored.slice(0, max).map((s) => s.skill);
}

/**
 * Safely determine the candidate's role, guarding against date strings
 * that were mis-parsed as the role field.
 */
function resolveRole(experience: ResumeDocument["experience"], targetRole: string): string {
  // First try the first experience entry's role
  if (experience.length > 0 && experience[0]?.role) {
    const role = experience[0].role.trim();
    // Reject if the role contains a year (mis-parsed date range)
    if (!HAS_YEAR_RE.test(role)) {
      return role;
    }
  }
  // Fallback to resume targetRole
  if (targetRole) {
    return targetRole;
  }
  // Last resort
  return "Software Developer";
}

/**
 * Extract the best achievement bullets from experience entries.
 * Prefers bullets that contain metrics (numbers, %, $) and picks
 * up to `max` across all entries.
 */
function extractBestAchievements(
  experience: ResumeDocument["experience"],
  max: number = 3,
): string[] {
  const withMetrics: string[] = [];
  const withoutMetrics: string[] = [];

  for (const exp of experience) {
    for (const bullet of exp.bullets) {
      const trimmed = bullet.trim();
      if (!trimmed) continue;
      if (/\d|%|\$|million|thousand|hours|weeks|months|percent/i.test(trimmed)) {
        withMetrics.push(trimmed);
      } else {
        withoutMetrics.push(trimmed);
      }
    }
  }

  // Prefer metric-rich bullets, fill remaining slots with others
  const selected = [...withMetrics, ...withoutMetrics];
  return selected.slice(0, Math.min(max, selected.length));
}

/**
 * Build a curated CoverLetterContext from a resume and optional job description.
 *
 * This is the ONLY function cover-letter prompt builders should call.
 */
export function buildCoverLetterContext(
  resume: ResumeDocument,
  targetRole?: string,
  jobDescription?: string,
): CoverLetterContext {
  const experience = resume.experience ?? [];

  // ── Role guard ──────────────────────────────────────────────────────
  const currentTitle = resolveRole(experience, targetRole || resume.targetRole);

  // ── Current employer ────────────────────────────────────────────────
  const currentEmployer =
    experience.length > 0 ? experience[0].company.trim() : undefined;

  // ── Years of experience ─────────────────────────────────────────────
  // Estimate from the earliest start date, or fall back to summary hints
  let yearsExperience: number | undefined;
  if (experience.length > 0) {
    const startDates = experience
      .map((e) => e.start)
      .filter(Boolean)
      .map((d) => {
        const match = d.match(/(\d{4})/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((y): y is number => y !== null);

    if (startDates.length > 0) {
      const earliestYear = Math.min(...startDates);
      yearsExperience = new Date().getFullYear() - earliestYear;
    }
  }

  // ── Target role ─────────────────────────────────────────────────────
  const resolvedTargetRole = targetRole || resume.targetRole || currentTitle || "the position";

  // ── Skills (prioritized against JD, max 5) ──────────────────────────
  const topRelevantSkills = prioritizeSkills(
    resume.skills ?? [],
    jobDescription,
    5,
  );

  // ── Best achievements (max 3) ───────────────────────────────────────
  const bestAchievements = extractBestAchievements(experience, 3);

  // ── Relevant projects (max 2, prefer those with bullets) ────────────
  const projects = resume.projects ?? [];
  const relevantProjects = projects
    .slice()
    .sort((a, b) => (b.bullets?.length ?? 0) - (a.bullets?.length ?? 0))
    .slice(0, 2)
    .map((p) => ({
      name: p.name,
      description: p.description,
      bullets: p.bullets ?? [],
    }));

  // ── Education ───────────────────────────────────────────────────────
  const education =
    resume.education && resume.education.length > 0
      ? resume.education[0]
      : undefined;

  // ── Certifications (max 2) ──────────────────────────────────────────
  const certifications = (resume.certifications ?? []).slice(0, 2);

  return {
    targetRole: resolvedTargetRole,
    yearsExperience,
    currentTitle,
    currentEmployer,
    topRelevantSkills,
    relevantProjects,
    bestAchievements,
    education,
    certifications,
  };
}
