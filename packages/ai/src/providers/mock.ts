import type { AIProvider } from "./types";
import type { DimensionResult } from "./types";
import type {
  AnalysisDimension,
  AnalysisInput,
  ProviderHealth,
} from "../analysis/types";

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
        id: "ats-missing-sections",
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
        id: "ats-format-tables",
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
            id: `grammar-tense-${section.id}`,
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
            id: `grammar-weak-phrase-${section.id}-${i}`,
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
        id: "impact-missing-metrics",
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
              id: `impact-weak-verb-${section.id}-${i}`,
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
        id: "impact-strong-verbs",
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
          id: "keywords-no-jd",
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
        id: "summary-missing",
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
        id: "summary-too-short",
        category: "summary",
        severity: "major",
        title: "Summary is too brief",
        reason: `Your summary is ${wordCount} words. Aim for 40–80 words that highlight your experience, key skills, and career target.`,
        targetText: resume.summary,
        suggestedText: null,
        location: { sectionId: "summary" },
        confidence: 0.9,
        source: "ai",
        modelInfo: "mock-v1",
      });
    }

    if (wordCount > 120) {
      suggestions.push({
        id: "summary-too-long",
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
        id: "summary-generic",
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
        id: "tone-first-person",
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
