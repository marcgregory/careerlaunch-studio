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
      title: "Add a professional summary for a stronger first impression",
      reason:
        "A 2–3 sentence summary at the top of your resume gives recruiters a quick sense of who you are and what you bring before they dive into your experience.",
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
      title: "Expand your summary for a stronger first impression",
      reason: `Your summary is ${wordCount} words currently. Expanding to 40–80 words gives you room to mention your experience level, key skills, and career direction.`,
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
      reason: `Your summary is ${wordCount} words. Trimming to 40–80 words makes it easier for recruiters to quickly grasp your profile.`,
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
        "Work experience is the section most recruiters look at first. Adding at least one relevant role builds credibility.",
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
          `Your ${entry.role ?? "Role"} role is missing bullet points. ` +
          "Add 3–5 bullets per role to demonstrate your impact and responsibilities.",
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
          title: "Bullet could say more",
          reason: `This bullet is ${words} words. Bullets of 10–20 words tend to communicate impact most clearly — describing what you did, how, and the result.`,
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

  // ── Weighted verb scoring system ──────────────────────────
  // +2: Strong action verbs — signal direct, measurable contribution
  const strongVerbs = new Set([
    "achieved", "accelerated", "administered", "advised", "allocated", "analyzed",
    "built", "chaired", "coached", "consolidated", "created",
    "cut", "decreased", "delivered", "designed", "developed", "devised",
    "directed", "documented", "drove", "edited", "eliminated", "enforced",
    "engineered", "established", "evaluated", "executed", "expanded", "expedited",
    "formed", "founded", "generated", "grew",
    "hired", "identified", "implemented", "improved", "increased", "initiated",
    "instituted", "integrated", "introduced", "invented", "investigated",
    "launched", "led",
    "managed", "merged", "monitored",
    "negotiated",
    "operated", "optimized", "organized", "originated", "overhauled", "oversaw",
    "performed", "pioneered", "planned", "prepared", "presented", "produced",
    "programmed", "promoted", "proposed", "provided", "published", "purchased",
    "recommended", "reduced", "reengineered", "reorganized", "replaced", "resolved",
    "restructured", "revamped", "revised",
    "saved", "scheduled", "selected", "set up", "simplified", "solved",
    "spearheaded", "standardized", "started",
    "streamlined", "strengthened", "structured", "succeeded", "supervised", "surpassed",
    "trained", "transformed", "trimmed", "unified", "upgraded", "wrote",

    // Tech / IT
    "installed", "troubleshot", "troubleshoot", "maintained", "configured",
    "deployed", "tested", "monitored",
    "responded", "resolved", "diagnosed", "authored", "refactored",
    "migrated", "coded", "scaffolded", "validated", "triaged",
    "patched", "provisioned",

    // Gerund forms (strong)
    "troubleshooting", "maintaining", "configuring", "deploying",
    "testing", "monitoring",
    "responding", "resolving", "diagnosing", "refactoring", "migrating",
    "coding", "validating", "triaging", "installing", "upgrading",
  ]);

  // +1: Collaborative / supportive verbs — good, but softer signal
  const collaborativeVerbs = new Set([
    "collaborated", "facilitated",
    "partnered", "liaised",
    "mentored", "guided", "coached",
    "presented", "communicated", "documented",
    "participated",
    "supported", "assisted", "contributed", "helped",
    "coordinated",

    // Gerund forms (collaborative)
    "collaborating", "facilitating", "partnering", "liaising",
    "mentoring", "guiding", "coaching",
    "presenting", "communicating", "documenting",
    "participating",
    "supporting", "assisting", "contributing", "helping",
    "coordinating",
  ]);

  function scoreVerb(bullet: string): number {
    const first = bullet.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first) return 0;
    if (strongVerbs.has(first)) return 2;
    if (collaborativeVerbs.has(first)) return 1;
    return 0;
  }

  // ── Dimension 1: Writing Quality (per-bullet weak-verb check) ──
  for (const entry of expSections) {
    for (let i = 0; i < entry.bullets.length; i++) {
      const bullet = entry.bullets[i].trim();
      if (!bullet) continue;

      const firstWord = bullet.split(/\s+/)[0]?.toLowerCase();
      if (firstWord && !strongVerbs.has(firstWord) && !collaborativeVerbs.has(firstWord)) {
        s.push({
          id: suggestionId("experience", `weak-verb-${i}`, entry.id),
          category: "experience",
          severity: "minor",
          title: "Start this bullet with a stronger action verb",
          reason: `"${firstWord}" reads passively. Leading with a strong verb like "Developed", "Implemented", or "Optimized" makes your contribution clearer.`,
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

  // ── Dimension 2: Writing Quality (entry-level aggregated score) ──
  for (const entry of expSections) {
    if (entry.bullets.length === 0) continue;

    let totalScore = 0;
    for (const b of entry.bullets) {
      totalScore += scoreVerb(b);
    }
    const maxPossible = entry.bullets.length * 2;
    const qualityRatio = totalScore / maxPossible;

    if (qualityRatio < 0.4) {
      s.push({
        id: suggestionId("writing", "quality-low", entry.id),
        category: "experience",
        severity: "major",
        title: `"${entry.role ?? "Role"}" needs stronger bullet points`,
        reason:
          `Most bullets in your ${entry.role ?? "Role"} role use passive phrasing. Start each bullet ` +
          "with a strong action verb like \"Developed\", \"Built\", \"Implemented\", or \"Optimized\" " +
          "to communicate your contributions more clearly.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "experience", entryId: entry.id },
        confidence: 1,
        source: "static",
      });
    } else if (qualityRatio < 0.7) {
      s.push({
        id: suggestionId("writing", "quality-mixed", entry.id),
        category: "experience",
        severity: "medium",
        title: `Some bullets in "${entry.role ?? "Role"}" could be stronger`,
        reason:
          `Your ${entry.role ?? "Role"} bullet points scored ${totalScore}/${maxPossible}. ` +
          "Consider replacing collaborative verbs (\"Collaborated\", \"Participated\", \"Supported\") " +
          "with stronger action verbs that signal direct ownership.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "experience", entryId: entry.id },
        confidence: 1,
        source: "static",
      });
    }
    // qualityRatio >= 0.7 → no aggregated writing suggestion
  }

  // ── Dimension 3: Impact Quality (metrics presence) ─────────────────
  // Fully independent from writing quality. Numbers are optional.
  for (const entry of expSections) {
    if (entry.bullets.length === 0) continue;

    const hasMetrics = entry.bullets.some((b) =>
      /\d|%|\$|million|thousand/i.test(b),
    );

    if (!hasMetrics) {
      const role = entry.role ?? "Role";
      const reasons: Record<string, string> = {
        default:
          "Adding measurable outcomes can make this experience more persuasive to recruiters. " +
          "Examples: supported 200+ users, reduced page load by 40%, delivered 15 reusable components. " +
          "Only add numbers that are true.",
      };

      // Generate a contextual reason based on role title keywords
      let contextualReason = reasons.default;
      const lowerRole = role.toLowerCase();

      if (/developer|engineer|programmer|coder|software/i.test(lowerRole)) {
        contextualReason =
          `Add measurable outcomes for your ${role} role. ` +
          "Examples: number of features shipped, code coverage percentage, " +
          "performance improvements (e.g. reduced load time by X%), or team size mentored. " +
          "Only add numbers that are true.";
      } else if (/staff|support|help desk|technician/i.test(lowerRole)) {
        contextualReason =
          `Mention the number of users supported, tickets resolved, systems maintained, ` +
          `or downtime reduced in your ${role} role.`;
      } else if (/manager|supervisor|lead|head|director/i.test(lowerRole)) {
        contextualReason =
          `Include metrics such as team size managed, budget overseen, ` +
          `projects delivered on time, or revenue impact in your ${role} role.`;
      } else if (/sales|marketing|account|business/i.test(lowerRole)) {
        contextualReason =
          `Quantify results for your ${role} role — revenue generated, ` +
          `conversion rate improvements, leads generated, or market share growth. Only add numbers that are true.`;
      }

      s.push({
        id: suggestionId("impact", "no-metrics", entry.id),
        category: "impact",
        severity: "minor",
        title: `Opportunity to strengthen "${role}" with measurable outcomes`,
        reason: contextualReason,
        targetText: null,
        suggestedText: null,
        location: { sectionId: "experience", entryId: entry.id },
        confidence: 1,
        source: "static",
      });
    }
    // Has metrics → no impact suggestion (good)
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
      title: "Add relevant skills to pass ATS filters",
      reason:
        "Skills help ATS systems and recruiters understand your capabilities at a glance. Aim for at least 6 skills relevant to your target role.",
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
      title: `Only ${count} skills listed`,
      reason:
        `${count} skills is on the lighter side for most roles. 6–12 relevant skills tends to give the strongest signal to both ATS and recruiters.`,
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
      title: `${count} skills may dilute your focus`,
      reason:
        `${count} skills is a lot to scan. Trimming to 10–15 of your strongest, most relevant skills makes the section easier to digest.`,
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
      title: "Adding a Projects section could help",
      reason:
        "Projects let you demonstrate skills hands-on — especially useful if you have limited professional experience or want to highlight specific work.",
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
      title: "Add experience, education, or projects",
      reason:
        "Your resume currently has very little content. Adding experience, education, or projects gives recruiters something to evaluate.",
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
