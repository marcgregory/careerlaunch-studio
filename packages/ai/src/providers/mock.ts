import type { AIProvider } from "./types";
import type { DimensionResult } from "./types";
import type {
  AnalysisDimension,
  AnalysisInput,
  ProviderHealth,
} from "../analysis/types";
import { suggestionId } from "../suggestion/types";
import { createSkillMap, normalizeSkill } from "../skills/normalization";

/**
 * Mock provider that returns realistic fake analysis results.
 * Used for tests, development, and demo mode.
 *
 * The mock produces slightly different results depending on resume content
 * (e.g., presence of metrics, weak verbs) so it's useful for building UIs
 * that handle varied feedback.
 */
export class MockProvider implements AIProvider {
  readonly name = "Mock Analyzer";

  async analyze(
    dimension: AnalysisDimension,
    input: AnalysisInput,
  ): Promise<DimensionResult> {
    // Simulate realistic latency
    await sleep(50 + Math.random() * 100);

    switch (dimension) {
      case "ats":
        return this.analyzeATS(input);
      case "grammar":
        return this.analyzeGrammar(input);
      case "impact":
        return this.analyzeImpact(input);
      case "keywords":
        return this.analyzeKeywords(input);
      case "summary":
        return this.analyzeSummary(input);
      case "tone":
        return this.analyzeTone(input);
      default:
        return { suggestions: [] };
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { available: true, model: "mock-v1", latency: 1 };
  }

  // ── Job analysis ─────────────────────────────────────────────────

  async analyzeJob(jobDescription: string): Promise<import("../job-analysis/types").JobAnalysis> {
    await sleep(50 + Math.random() * 100);

    const text = jobDescription.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 3);

    // Extract plausible skills from the JD text
    const skills = words.filter(w =>
      /^(react|angular|vue|node|python|java|typescript|javascript|aws|docker|kubernetes|sql|mongodb|graphql|rest|api|css|html|git|agile|scrum|devops|machine.learning|ai|cloud|ci.cd|terraform|linux|go|rust|ruby|php|swift|kotlin|flutter|react.native)$/i.test(w)
    );

    return {
      requiredSkills: skills.length > 0 ? skills.slice(0, 5) : ["JavaScript", "React", "Communication", "Problem Solving"],
      preferredSkills: skills.length > 3 ? skills.slice(5, 8) : ["TypeScript", "GraphQL"],
      seniority: /\bsenior\b|\bstaff\b|\b5\+/i.test(text) ? "senior" : /\blead\b|\bmanager\b/i.test(text) ? "lead" : "mid",
      responsibilities: [
        "Build and maintain web applications",
        "Collaborate with cross-functional teams",
        "Participate in code reviews",
        "Write unit and integration tests",
      ],
      atsKeywords: [...new Set(skills)],
      industry: /\b(healthcare|medical|clinical|hospital)\b/i.test(text) ? "healthcare"
        : /\b(finance|banking|accounting|insurance)\b/i.test(text) ? "finance"
        : /\b(software|engineer|developer|tech)\b/i.test(text) ? "technology"
        : "technology",
    };
  }

  // ── Gap analysis ─────────────────────────────────────────────────

  async analyzeGap(
    input: import("../gap-analysis/types").GapAnalysisInput
  ): Promise<import("../gap-analysis/types").GapAnalysis> {
    await sleep(50 + Math.random() * 100);

    const { resume, jobAnalysis } = input;

    // Compare resume skills against job required skills
    const resumeSkillMap = createSkillMap(resume.skills);
    const seenRequiredSkills = new Set<string>();
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const skill of jobAnalysis.requiredSkills) {
      const normalizedSkill = normalizeSkill(skill);
      if (!normalizedSkill || seenRequiredSkills.has(normalizedSkill)) continue;
      seenRequiredSkills.add(normalizedSkill);

      if (resumeSkillMap.has(normalizedSkill)) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }

    const totalRequiredSkills = seenRequiredSkills.size;
    const matchScore = totalRequiredSkills > 0
      ? Math.round((matchedSkills.length / totalRequiredSkills) * 100)
      : 50;

    const weakSections: import("../gap-analysis/types").GapAnalysis["weakSections"] = [];
    const recommendations: import("../gap-analysis/types").GapAnalysis["recommendations"] = [];

    if (!resume.summary || resume.summary.trim().length < 60) {
      weakSections.push({
        sectionId: "summary",
        field: "summary",
        reason: "Summary is too short or missing.",
        severity: "major",
      });
      recommendations.push({
        type: "rewrite_summary",
        sectionId: "summary",
        reason: "Expand summary to highlight relevant skills.",
      });
    }

    for (const skill of missingSkills) {
      recommendations.push({
        type: "add_skill",
        sectionId: "skills",
        reason: `Add "${skill}" to match job requirements.`,
      });
    }

    return { matchScore, matchedSkills, missingSkills, weakSections, recommendations };
  }

  // ── Tailoring ────────────────────────────────────────────────────

  async tailorResume(
    input: import("../tailoring/types").TailoringInput
  ): Promise<import("../tailoring/types").TailorSuggestion[]> {
    await sleep(100 + Math.random() * 150);

    const { resume, gapAnalysis } = input;
    const suggestions: import("../tailoring/types").TailorSuggestion[] = [];

    // Summary rewrite
    if (resume.summary && resume.summary.trim().length > 0) {
      suggestions.push({
        id: suggestionId("summary", "mock-tailor", "summary"),
        category: "summary",
        location: { sectionId: "summary" },
        before: resume.summary,
        after: resume.summary.length < 100
          ? `${resume.summary.trim()} I bring expertise in ${(gapAnalysis.matchedSkills.length > 0 ? gapAnalysis.matchedSkills : ["relevant technologies"]).slice(0, 3).join(", ")}, with a proven track record of delivering high-quality results.`
          : resume.summary.replace(/(\.\s*$)/, ` and expertise in ${gapAnalysis.matchedSkills.slice(0, 2).join(", ")}.$1`),
        reason: "Tailor your summary to highlight skills matching this role.",
        confidence: 0.7,
        severity: "medium",
      });
    }

    // Skill suggestions
    for (let i = 0; i < gapAnalysis.missingSkills.length; i++) {
      suggestions.push({
        id: suggestionId("skills", `mock-add-${i}`, "skills"),
        category: "skills",
        location: { sectionId: "skills" },
        before: "",
        after: gapAnalysis.missingSkills[i],
        reason: `Add "${gapAnalysis.missingSkills[i]}" to match the job requirements.`,
        confidence: 0.9,
        severity: "major",
      });
    }

    // Experience bullet rewrites (first 2)
    const firstExp = resume.sections.find(s => s.type === "experience");
    if (firstExp) {
      for (let i = 0; i < Math.min(firstExp.bullets.length, 2); i++) {
        const bullet = firstExp.bullets[i];
        if (bullet && bullet.trim().length > 0) {
          suggestions.push({
            id: suggestionId("experience", `mock-rewrite-${i}`, firstExp.id),
            category: "experience",
            location: {
              sectionId: firstExp.id,
              entryId: firstExp.id,
              field: `bullets[${i}]`,
            },
            before: bullet,
            after: bullet.length < 80
              ? `${bullet.trim().replace(/\.$/, "")} to drive business outcomes and deliver measurable results.`
              : `${bullet.trim().replace(/\.$/, "")}, leveraging domain expertise to maximize impact.`,
            reason: "Strengthen this bullet with outcome-focused language.",
            confidence: 0.6,
            severity: "minor",
          });
        }
      }
    }

    return suggestions;
  }

  private analyzeATS(input: AnalysisInput): DimensionResult {
    const { resume } = input;
    const suggestions: DimensionResult["suggestions"] = [];
    const missing: string[] = [];

    if (!resume.contact.email) missing.push("Email address");
    if (!resume.contact.phone) missing.push("Phone number");

    const hasSummary = resume.summary.trim().length > 0;
    if (!hasSummary) missing.push("Professional summary");

    const hasSection = (type: string) =>
      resume.sections.some((s) => s.type === type);
    if (!hasSection("experience")) missing.push("Experience section");
    if (!hasSection("education")) missing.push("Education section");

    if (resume.skills.length === 0) missing.push("Skills section");

    if (missing.length > 0) {
      suggestions.push({
        id: suggestionId("ats", "missing-sections", "completeness"),
        category: "ats",
        severity: missing.length > 2 ? "critical" : "major",
        title: "Missing ATS-required sections",
        reason: `ATS parsers expect these sections: ${missing.join(", ")}. Without them, automated screening may reject the resume before a human reads it.`,
        targetText: null,
        suggestedText: null,
        location: { sectionId: "completeness" },
        confidence: 1,
        source: "static",
        modelInfo: "mock-v1",
      });
    }

    // Check for potential ATS-hostile elements
    const tableWarning = resume.sections.some((s) =>
      s.bullets.some((b) => b.includes("table") || b.includes("column")),
    );
    if (tableWarning) {
      suggestions.push({
        id: suggestionId("ats", "format-tables", "formatting"),
        category: "ats",
        severity: "medium",
        title: "Tables or columns detected",
        reason: "ATS parsers struggle with tables and multi-column layouts. Use plain text with standard headings.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "formatting" },
        confidence: 0.7,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    return { suggestions };
  }

  private analyzeGrammar(input: AnalysisInput): DimensionResult {
    const { resume } = input;
    const suggestions: DimensionResult["suggestions"] = [];

    // Check for inconsistent tense in bullet points
    const allBullets = resume.sections.flatMap((s) => s.bullets);
    const presentTense = allBullets.filter((b) =>
      /\b(manage|lead|oversee|create|develop|design|implement)\b/i.test(b),
    );
    const pastTense = allBullets.filter((b) =>
      /\b(managed|led|oversaw|created|developed|designed|implemented)\b/i.test(b),
    );

    if (presentTense.length > 0 && pastTense.length > 0) {
      // Only flag if both tenses appear in the same section
      for (const section of resume.sections) {
        const secPresent = section.bullets.filter((b) =>
          /\b(manage|lead|oversee|create|develop|design|implement)\b/i.test(b),
        );
        const secPast = section.bullets.filter((b) =>
          /\b(managed|led|oversaw|created|developed|designed|implemented)\b/i.test(b),
        );
        if (secPresent.length > 0 && secPast.length > 0) {
          suggestions.push({
            id: suggestionId("grammar", "tense", section.id),
            category: "grammar",
            severity: "medium",
            title: "Inconsistent verb tense in this section",
            reason: "Past-tense roles should use past-tense verbs throughout. Current role can use present tense for ongoing responsibilities.",
            targetText: section.bullets.join(" "),
            suggestedText: null,
            location: { sectionId: "experience", entryId: section.id },
            confidence: 0.85,
            source: "ai",
            modelInfo: "mock-v1",
          });
        }
      }
    }

    // Check for weak "responsible for" phrasing
    for (const section of resume.sections) {
      for (let i = 0; i < section.bullets.length; i++) {
        const bullet = section.bullets[i];
        if (
          /responsible for|duties included|duties include|tasked with/i.test(
            bullet,
          )
        ) {
          suggestions.push({
            id: suggestionId("grammar", `weak-phrase-${i}`, section.id),
            category: "grammar",
            severity: "minor",
            title: "Weak phrasing: 'Responsible for'",
            reason: "Lead with a strong action verb instead of describing responsibilities. 'Responsible for managing a team' → 'Managed a team of...'",
            targetText: bullet,
            suggestedText: bullet.replace(
              /responsible for/i,
              " ",
            ),
            location: {
              sectionId: "experience",
              entryId: section.id,
              field: `bullets[${i}]`,
            },
            confidence: 0.9,
            source: "ai",
            modelInfo: "mock-v1",
          });
        }
      }
    }

    return { suggestions };
  }

  private analyzeImpact(input: AnalysisInput): DimensionResult {
    const { resume } = input;
    const suggestions: DimensionResult["suggestions"] = [];

    const weakVerbPatterns = [
      /\bwas responsible for\b/i,
      /\bhelped\b/i,
      /\bworked on\b/i,
      /\bwas involved in\b/i,
      /\bparticipated in\b/i,
      /\bdid\b/i,
      /\bmade\b/i,
    ];

    const allBullets = resume.sections.flatMap((s) => s.bullets);

    // Check for bullets without metrics
    const bulletsWithoutMetrics = allBullets.filter(
      (b) => !/\d|%|\$|million|thousand|hours|weeks|months|improved|reduced|increased/i.test(b),
    );

    if (
      bulletsWithoutMetrics.length > 0 &&
      bulletsWithoutMetrics.length >= allBullets.length * 0.5
    ) {
      suggestions.push({
        id: suggestionId("impact", "missing-metrics", "experience"),
        category: "impact",
        severity: "major",
        title: "Most bullets lack measurable results",
        reason: "Recruiters look for quantified impact: percentages, revenue, time saved, team size. Add metrics to at least half your bullet points.",
        targetText: bulletsWithoutMetrics[0],
        suggestedText: null,
        location: { sectionId: "experience" },
        confidence: 0.9,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    // Check for weak verbs
    for (const section of resume.sections) {
      for (let i = 0; i < section.bullets.length; i++) {
        const bullet = section.bullets[i];
        for (const pattern of weakVerbPatterns) {
          if (pattern.test(bullet)) {
            suggestions.push({
              id: suggestionId("impact", `weak-verb-${i}`, section.id),
              category: "impact",
              severity: "medium",
              title: "Weak action verb detected",
              reason: "Replace passive phrasing with a strong, specific action verb that communicates ownership and impact.",
              targetText: bullet,
              suggestedText: null,
              location: {
                sectionId: "experience",
                entryId: section.id,
                field: `bullets[${i}]`,
              },
              confidence: 0.85,
              source: "ai",
              modelInfo: "mock-v1",
            });
          }
        }
      }
    }

    // Suggest strong verbs where appropriate
    const hasAnyActionVerb = allBullets.some((b) =>
      /\b(achieved|engineered|optimized|transformed|delivered|generated|drove|launched|spearheaded)\b/i.test(b),
    );
    if (!hasAnyActionVerb && allBullets.length > 0) {
      suggestions.push({
        id: suggestionId("impact", "strong-verbs", "experience"),
        category: "impact",
        severity: "minor",
        title: "Consider stronger action verbs",
        reason: "Lead bullets with verbs like 'Achieved', 'Engineered', 'Optimized', 'Delivered', or 'Transformed' to convey stronger ownership of results.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "experience" },
        confidence: 0.75,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    return { suggestions };
  }

  private analyzeKeywords(_input: AnalysisInput): DimensionResult {
    // Keyword analysis requires a job description; without it, return a suggestion
    // prompting the user to add one
    return {
      suggestions: [
        {
          id: suggestionId("keywords", "no-jd", "skills"),
          category: "keywords",
          severity: "info",
          title: "Add a job description for keyword matching",
          reason: "Keyword analysis compares your resume against a target job description. Paste a job posting to see how well your resume matches.",
          targetText: null,
          suggestedText: null,
          location: { sectionId: "skills" },
          confidence: 1,
          source: "static",
          modelInfo: "mock-v1",
        },
      ],
    };
  }

  private analyzeSummary(input: AnalysisInput): DimensionResult {
    const { resume } = input;
    const suggestions: DimensionResult["suggestions"] = [];

    if (!resume.summary.trim()) {
      suggestions.push({
        id: suggestionId("summary", "missing", "summary"),
        category: "summary",
        severity: "critical",
        title: "Professional summary is missing",
        reason: "Recruiters spend 6–10 seconds on a resume. A strong summary tells them immediately who you are and what you bring.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "summary" },
        confidence: 1,
        source: "static",
        modelInfo: "mock-v1",
      });
      return { suggestions };
    }

    const wordCount = resume.summary.split(/\s+/).filter(Boolean).length;

    if (wordCount < 30) {
      suggestions.push({
        id: suggestionId("summary", "too-short", "summary"),
        category: "summary",
        severity: "major",
        title: "Summary is too brief",
        reason: `Your summary is ${wordCount} words. Aim for 40–80 words that highlight your experience, key skills, and career target.`,
        targetText: resume.summary,
        suggestedText: resume.summary
          ? `${resume.summary.replace(/\.$/, "")} — a results-driven professional with a proven track record of delivering measurable impact across cross-functional teams.`
          : "A results-driven professional with experience delivering measurable impact across cross-functional teams.",
        location: { sectionId: "summary" },
        confidence: 0.9,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    if (wordCount > 120) {
      suggestions.push({
        id: suggestionId("summary", "too-long", "summary"),
        category: "summary",
        severity: "medium",
        title: "Summary is longer than recommended",
        reason: `Your summary is ${wordCount} words. Consider trimming to 40–80 words to keep the recruiter's attention on your experience.`,
        targetText: resume.summary,
        suggestedText: null,
        location: { sectionId: "summary" },
        confidence: 0.85,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    // Check for generic opening
    const genericOpeners = [
      /dedicated/i,
      /hardworking/i,
      /motivated/i,
      /seeking.*opportunity/i,
      /looking for.*position/i,
    ];
    const hasGeneric = genericOpeners.some((p) => p.test(resume.summary));
    if (hasGeneric) {
      suggestions.push({
        id: suggestionId("summary", "generic", "summary"),
        category: "summary",
        severity: "medium",
        title: "Summary opens with a generic phrase",
        reason: "Open with a specific achievement or your distinctive value proposition rather than a trait like 'hardworking' or 'dedicated'.",
        targetText: resume.summary,
        suggestedText: null,
        location: { sectionId: "summary" },
        confidence: 0.8,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    return { suggestions };
  }

  private analyzeTone(input: AnalysisInput): DimensionResult {
    const { resume } = input;
    const suggestions: DimensionResult["suggestions"] = [];

    const allText = [
      resume.summary,
      ...resume.sections.flatMap((s) => s.bullets),
    ]
      .join(" ")
      .toLowerCase();

    // Check for first-person pronouns
    const firstPerson = (allText.match(/\b(i\s|my\s|me\s)/g) || []).length;
    if (firstPerson > 2) {
      suggestions.push({
        id: suggestionId("grammar", "first-person", "experience"),
        category: "grammar",
        severity: "minor",
        title: "First-person pronouns detected",
        reason: "Resumes traditionally use implied first person. Remove 'I', 'me', and 'my' — sentences should start with action verbs instead.",
        targetText: null,
        suggestedText: null,
        location: { sectionId: "experience" },
        confidence: 0.9,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    return { suggestions };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
