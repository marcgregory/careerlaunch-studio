import type { NormalizedResume, ResumeStatistics } from "./types";
import type { Suggestion } from "../suggestion/types";
import { suggestionId } from "../suggestion/types";

/**
 * Static analysis engine — performs deterministic checks that require no AI.
 *
 * These checks run first and always. They are fast, free, and consistent.
 * Results are merged with AI findings by the analysis orchestrator; there
 * is no distinction at the suggestion level.
 *
 * Every check returns fully-formed Suggestion objects with source: "static"
 * and confidence: 1.
 */

export function runStaticAnalysis(resume: NormalizedResume): {
  suggestions: Suggestion[];
  statistics: ResumeStatistics;
} {
  const suggestions: Suggestion[] = [];

  suggestions.push(...checkContact(resume));
  suggestions.push(...checkSummary(resume));
  suggestions.push(...checkExperience(resume));
  suggestions.push(...checkSkills(resume));
  suggestions.push(...checkEducation(resume));
  suggestions.push(...checkCompleteness(resume));

  const expSections = resume.sections.filter((sec) => sec.type === "experience");
  const eduSections = resume.sections.filter((sec) => sec.type === "education");
  const bulletCount = expSections.reduce((sum, e) => sum + e.bullets.length, 0);

  const statistics: ResumeStatistics = {
    skills: resume.skills.length,
    certifications: resume.certifications.length,
    projects: resume.projects.length,
    experienceEntries: expSections.length,
    educationEntries: eduSections.length,
    bulletPoints: bulletCount,
  };

  return { suggestions, statistics };
}

// ─── Contact checks ─────────────────────────────────────────────

function checkContact(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];

  if (!resume.contact.fullName.trim()) {
    s.push(missingField(suggestionId("contact", "missing-name", "contact"), "Full name", "contact"));
  }

  if (!resume.contact.email.trim()) {
    s.push(missingField(suggestionId("contact", "missing-email", "contact"), "Email address", "contact"));
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.contact.email.trim())
  ) {
    s.push({
      id: suggestionId("contact", "email-invalid", "contact"),
      category: "contact",
      severity: "critical",
      title: "Email address appears invalid",
      reason: `"${resume.contact.email}" does not look like a valid email. Recruiters cannot reach you without a correct address.`,
      targetText: resume.contact.email,
      suggestedText: null,
      location: { sectionId: "contact", field: "email" },
      confidence: 1,
      source: "static",
    });
  }

  if (!resume.contact.phone.trim()) {
    s.push(missingField(suggestionId("contact", "missing-phone", "contact"), "Phone number", "contact"));
  }

  if (!resume.contact.location.trim()) {
    s.push({
      id: suggestionId("contact", "location-missing", "contact"),
      category: "contact",
      severity: "minor",
      title: "Location is missing",
      reason: "Including your city and state helps recruiters determine geographic fit and can improve local search rankings.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "contact", field: "location" },
      confidence: 1,
      source: "static",
    });
  }

  return s;
}

// ─── Summary checks ─────────────────────────────────────────────

function checkSummary(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];

  if (!resume.summary.trim()) {
    s.push({
      id: suggestionId("summary", "missing", "summary"),
      category: "summary",
      severity: "critical",
      title: "Professional summary is missing",
      reason:
        "A strong 2–3 sentence summary tells recruiters who you are and what you bring before they read your experience.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "summary" },
      confidence: 1,
      source: "static",
    });
    return s;
  }

  const wordCount = resume.summary.split(/\s+/).filter(Boolean).length;

  if (wordCount < 30) {
    s.push({
      id: suggestionId("summary", "too-short", "summary"),
      category: "summary",
      severity: "major",
      title: "Summary is too brief",
      reason: `Your summary is ${wordCount} words. Expand to 40–80 words covering your experience level, key skills, and career target.`,
      targetText: resume.summary,
      suggestedText: null,
      location: { sectionId: "summary" },
      confidence: 1,
      source: "static",
    });
  }

  if (wordCount > 120) {
    s.push({
      id: suggestionId("summary", "too-long", "summary"),
      category: "summary",
      severity: "medium",
      title: "Summary is longer than recommended",
      reason: `Your summary is ${wordCount} words. Trim to 40–80 words so recruiters can quickly grasp your profile.`,
      targetText: resume.summary,
      suggestedText: null,
      location: { sectionId: "summary" },
      confidence: 1,
      source: "static",
    });
  }

  return s;
}

// ─── Experience checks ──────────────────────────────────────────

function checkExperience(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];
  const expSections = resume.sections.filter((sec) => sec.type === "experience");

  if (expSections.length === 0) {
    s.push({
      id: suggestionId("experience", "missing", "experience"),
      category: "experience",
      severity: "critical",
      title: "No experience entries",
      reason:
        "Work experience is the most important section for most recruiters. Add at least one relevant role.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "experience" },
      confidence: 1,
      source: "static",
    });
    return s;
  }

  // Each entry should have at least one bullet
  for (const entry of expSections) {
    if (entry.bullets.length === 0) {
      s.push({
        id: suggestionId("experience", "empty", entry.id),
        category: "experience",
        severity: "major",
        title: `"${entry.role ?? "Role"}" has no bullet points`,
        reason:
          "Bullet points are where you demonstrate impact. Add 3–5 bullets per role.",
        targetText: null,
        suggestedText: null,
        location: {
          sectionId: "experience",
          entryId: entry.id,
        },
        confidence: 1,
        source: "static",
      });
    }
  }

  // Check for bullet points that are too short (< 8 words)
  for (const entry of expSections) {
    for (let i = 0; i < entry.bullets.length; i++) {
      const bullet = entry.bullets[i];
      const words = bullet.split(/\s+/).filter(Boolean).length;
      if (words < 8 && words > 0) {
        s.push({
          id: suggestionId("experience", `short-bullet-${i}`, entry.id),
          category: "experience",
          severity: "minor",
          title: "Bullet point is too short",
          reason: `This bullet is ${words} words. Expand to 10–20 words that describe what you did, how you did it, and the result.`,
          targetText: bullet,
          suggestedText: null,
          location: {
            sectionId: "experience",
            entryId: entry.id,
            field: `bullets[${i}]`,
          },
          confidence: 1,
          source: "static",
        });
      }
    }
  }

  // Bullets that do not start with an action verb
  const actionVerbs = [
    "achieved", "accelerated", "administered", "advised", "allocated", "analyzed",
    "built", "chaired", "coached", "collaborated", "consolidated", "created",
    "cut", "decreased", "delivered", "designed", "developed", "devised",
    "directed", "documented", "drove", "edited", "eliminated", "enforced",
    "engineered", "established", "evaluated", "executed", "expanded", "expedited",
    "facilitated", "formed", "founded", "generated", "grew", "guided",
    "hired", "identified", "implemented", "improved", "increased", "initiated",
    "instituted", "integrated", "introduced", "invented", "investigated", "launched",
    "led", "managed", "mentored", "merged", "monitored", "negotiated",
    "operated", "optimized", "organized", "originated", "overhauled", "oversaw",
    "performed", "pioneered", "planned", "prepared", "presented", "produced",
    "programmed", "promoted", "proposed", "provided", "published", "purchased",
    "recommended", "reduced", "reengineered", "reorganized", "replaced", "resolved",
    "restructured", "revamped", "revised", "saved", "scheduled", "selected",
    "set up", "simplified", "solved", "spearheaded", "standardized", "started",
    "streamlined", "strengthened", "structured", "succeeded", "supervised", "surpassed",
    "trained", "transformed", "trimmed", "unified", "upgraded", "wrote",

    // Tech / IT verbs
    "installed", "troubleshot", "troubleshoot", "maintained", "configured",
    "deployed", "tested", "monitored", "supported", "documented",
    "responded", "resolved", "diagnosed", "authored", "refactored",
    "migrated", "coded", "scaffolded", "validated", "triaged",
    "patched", "provisioned",

    // Common gerund forms (used as bullet starters)
    "troubleshooting", "maintaining", "configuring", "deploying",
    "testing", "monitoring", "supporting", "documenting", "training",
    "responding", "resolving", "diagnosing", "refactoring", "migrating",
    "coding", "validating", "triaging", "installing", "upgrading",
  ];

  for (const entry of expSections) {
    for (let i = 0; i < entry.bullets.length; i++) {
      const bullet = entry.bullets[i].trim();
      if (!bullet) continue;

      const firstWord = bullet.split(/\s+/)[0]?.toLowerCase();
      if (firstWord && !actionVerbs.includes(firstWord)) {
        s.push({
          id: suggestionId("experience", `weak-verb-${i}`, entry.id),
          category: "experience",
          severity: "minor",
          title: "Bullet does not start with a strong action verb",
          reason: `"${firstWord}" is not a strong action verb. Lead with verbs like "Developed", "Implemented", or "Optimized".`,
          targetText: bullet,
          suggestedText: null,
          location: {
            sectionId: "experience",
            entryId: entry.id,
            field: `bullets[${i}]`,
          },
          confidence: 1,
          source: "static",
        });
      }
    }
  }

  // Missing measurable results
  for (const entry of expSections) {
    const bulletsWithMetrics = entry.bullets.filter((b) =>
      /\d|%|\$|million|thousand/i.test(b),
    );
    if (entry.bullets.length > 0 && bulletsWithMetrics.length === 0) {
      s.push({
        id: suggestionId("impact", "no-metrics", entry.id),
        category: "impact",
        severity: "major",
        title: `"${entry.role ?? "Role"}" has no measurable results`,
        reason:
          "Bullets with numbers (percentages, revenue, time saved, team size) are 40% more likely to get interviews.",
        targetText: null,
        suggestedText:
          "Add numbers, percentages, or other measurable outcomes. Examples:\n" +
          "• \"Developed 15+ React components used across 4 internal applications\"\n" +
          "• \"Reduced page load time by 40% through code-splitting and lazy loading\"\n" +
          "• \"Supported 200+ end users across 3 departments\"",
        location: { sectionId: "experience", entryId: entry.id },
        confidence: 1,
        source: "static",
      });
    }
  }

  // Date gaps > 1 year in the last 3 entries
  for (const entry of expSections) {
    if (!entry.dateRange) continue;
    const { start, end } = entry.dateRange;
    if (start && end && start.length === 4 && end.length === 4) {
      const startYear = parseInt(start, 10);
      const endYear = parseInt(end, 10);
      if (endYear - startYear > 5) {
        s.push({
          id: suggestionId("experience", `long-tenure`, entry.id),
          category: "experience",
          severity: "info",
          title: "Long tenure at one role — consider a summary",
          reason: `This role spans ${endYear - startYear}+ years. If your responsibilities changed significantly during this period, consider adding a promotion or scope-change bullet.`,
          targetText: null,
          suggestedText: null,
          location: { sectionId: "experience", entryId: entry.id },
          confidence: 1,
          source: "static",
        });
      }
    }
  }

  return s;
}

// ─── Skills checks ──────────────────────────────────────────────

function checkSkills(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];
  const count = resume.skills.length;

  if (count === 0) {
    s.push({
      id: suggestionId("skills", "missing", "skills"),
      category: "skills",
      severity: "major",
      title: "No skills listed",
      reason:
        "Skills help you get past ATS filters and show recruiters your capabilities at a glance. List at least 6 relevant skills.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "skills" },
      confidence: 1,
      source: "static",
    });
  } else if (count < 6) {
    s.push({
      id: suggestionId("skills", "too-few", "skills"),
      category: "skills",
      severity: "medium",
      title: "Only " + count + " skills listed",
      reason:
        count + " skills is light for most roles. Aim for 6–12 relevant skills that match your target job description.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "skills" },
      confidence: 1,
      source: "static",
    });
  } else if (count > 20) {
    s.push({
      id: suggestionId("skills", "too-many", "skills"),
      category: "skills",
      severity: "minor",
      title: `${count} skills is more than typical`,
      reason:
        "A long skills list can dilute your focus. Consider trimming to 10–15 of your strongest, most relevant skills.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "skills" },
      confidence: 1,
      source: "static",
    });
  }

  return s;
}

// ─── Education checks ───────────────────────────────────────────

function checkEducation(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];
  const eduSections = resume.sections.filter((sec) => sec.type === "education");

  if (eduSections.length === 0) {
    s.push({
      id: suggestionId("education", "missing", "education"),
      category: "education",
      severity: "medium",
      title: "No education entries",
      reason:
        "Most resumes include at least a degree entry. Even if not required for the role, it demonstrates baseline credentials.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "education" },
      confidence: 1,
      source: "static",
    });
  }

  return s;
}

// ─── Completeness checks ────────────────────────────────────────

function checkCompleteness(resume: NormalizedResume): Suggestion[] {
  const s: Suggestion[] = [];

  // Projects presence
  if (resume.projects.length === 0) {
    s.push({
      id: suggestionId("completeness", "projects-missing", "projects"),
      category: "completeness",
      severity: "info",
      title: "Consider adding a Projects section",
      reason:
        "Projects are a great way to demonstrate skills when you have limited professional experience or want to showcase specific work.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "projects" },
      confidence: 1,
      source: "static",
    });
  }

  // Target role
  if (!resume.projects.length && !resume.sections.some(s => s.type === "experience")) {
    s.push({
      id: suggestionId("completeness", "minimal", "completeness"),
      category: "completeness",
      severity: "critical",
      title: "Resume is mostly empty",
      reason:
        "Add experience, education, or projects so recruiters have content to evaluate.",
      targetText: null,
      suggestedText: null,
      location: { sectionId: "completeness" },
      confidence: 1,
      source: "static",
    });
  }

  return s;
}

// ─── Helpers ────────────────────────────────────────────────────

function missingField(
  id: string,
  label: string,
  sectionId: string,
): Suggestion {
  return {
    id,
    category: "contact" as const,
    severity: "critical" as const,
    title: `${label} is missing`,
    reason: `Recruiters cannot contact you without a ${label.toLowerCase()}. This is required for most applications.`,
    targetText: null,
    suggestedText: null,
    location: { sectionId, field: sectionId },
    confidence: 1,
    source: "static" as const,
  };
}
