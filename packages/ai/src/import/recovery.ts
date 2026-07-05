/**
 * AI Recovery Pass for Resume Import
 *
 * When the deterministic parser produces low coverage on critical sections
 * (experience, education, projects), this module sends the original text
 * and parser output to an LLM for reconstruction, then merges the results.
 *
 * Flow:
 *   1. Deterministic parser runs (existing flow)
 *   2. Coverage check identifies sections below 80%
 *   3. recoverSections() sends original text + parser output to LLM
 *   4. mergeRecovery() combines parser output with AI reconstruction
 *   5. Result is returned with annotations for UI badge display
 */

import { callGemini, callOpenAICompatible } from "../lib/llm";
import type { ParseResult, SectionCoverageItem } from "./text-parser";
import type { ResumeDocument } from "@careerlaunch/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type RecoveryProviderConfig = {
  /** Provider name — "gemini" or "groq" */
  name: "gemini" | "groq";
  /** API key for the provider */
  apiKey: string;
  /** Optional model override (defaults to provider's standard model) */
  model?: string;
};

/**
 * Data recovered by the LLM for low-coverage sections.
 * Each key is present only if the LLM found recoverable data.
 */
export type RecoveryResult = {
  experience?: Array<{
    role: string;
    company: string;
    start: string;
    end: string;
    bullets: string[];
  }>;
  education?: Array<{
    school: string;
    degree: string;
    graduation: string;
  }>;
  projects?: Array<{
    name: string;
    bullets: string[];
  }>;
  summary?: string;
  /** Categorized skills: each category has a label and list of skill items.
   *  Example: { category: "Frontend", items: ["React", "TypeScript", "Next.js"] } */
  skills?: Array<{
    category: string;
    items: string[];
  }>;
};

/**
 * Configuration for the recovery pass.
 */
export type RecoveryConfig = {
  /** The full original resume text the user pasted */
  originalText: string;
  /** Output from the deterministic parser */
  parserOutput: ParseResult;
  /** Sections that fell below the coverage threshold */
  lowCoverageSections: SectionCoverageItem[];
  /** LLM provider configuration */
  provider: RecoveryProviderConfig;
};

/**
 * Result of merging parser output with AI recovery.
 */
export type MergedResult = {
  /** Merged resume data — parser output enhanced with AI recovery */
  parsed: Partial<ResumeDocument>;
  /** Section IDs that were reconstructed by the AI */
  recoveredSections: string[];
  /** Whether any AI recovery was applied */
  aiRecovered: boolean;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const CRITICAL_SECTIONS = new Set(["experience", "education", "projects"]);
const COVERAGE_THRESHOLD = 0.8; // 80% — sections below this trigger recovery

const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const GROQ_DEFAULT_MODEL = "llama-4-scout-17b-16e-instruct";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/* ------------------------------------------------------------------ */
/*  Prompt building                                                    */
/* ------------------------------------------------------------------ */

/**
 * Inline prompt for resume recovery.
 * Inlined rather than loaded from file so it works in all environments
 * (the file-based prompt loader does not work in production Next.js bundles).
 */
const RECOVERY_SYSTEM_PROMPT = [
  `You are a resume reconstruction expert. Your task is to recover missing information from a resume that was only partially parsed by an automated system.`,
  ``,
  `You will receive:`,
  `1. The **original resume text** — the full text the user pasted`,
  `2. The **parser output** — what the automated parser extracted (may be incomplete)`,
  `3. A list of **low-coverage sections** — sections where the parser preserved less than 80% of the content`,
  ``,
  `For EACH low-coverage section, carefully read the original resume text and extract ALL available information. Be thorough — the original text contains the information even if the parser missed or fragmented it.`,
  ``,
  `## Critical Rules`,
  `- Return ONLY information that is explicitly present in the original text`,
  `- Do NOT invent, infer, or rewrite content`,
  `- Preserve the exact wording from the original text`,
  `- If a section is truly absent from the resume (not just poorly parsed), return an empty result for that key`,
  `- Maintain the original order of entries within each section`,
  `- For experience: every entry must have role, company, start date, end date, and bullet points`,
  `- For education: every entry must have school, degree, and graduation year`,
  `- For projects: every entry must have at least a project name (bullets are optional)`,
  `- For skills: organize by category (Frontend, Backend, Cloud & Tools, etc.)`,
  `  with each category having a list of individual skill items.`,
  ``,
  `Return ONLY valid JSON in the following format — no markdown, no code fences, no additional text:`,
  `{`,
  `  "experience": [`,
  `    { "role": "Job Title", "company": "Company Name", "start": "Month Year", "end": "Month Year or Present", "bullets": ["Accomplishment bullet point"] }`,
  `  ],`,
  `  "education": [`,
  `    { "school": "University Name", "degree": "Full Degree Name", "graduation": "Year" }`,
  `  ],`,
  `  "skills": [`,
  `    { "category": "Frontend", "items": ["React", "TypeScript"] },`,
  `    { "category": "Backend", "items": ["Node.js", "PostgreSQL"] }`,
  `  ],`,
  `  "projects": [`,
  `    { "name": "Project Name", "bullets": ["Detail about the project"] }`,
  `  ],`,
  `  "summary": "Full summary text as written in the original resume"`,
  `}`,
  ``,
  `Omit any section key that you could not recover.`,
].join("\n");

/**
 * Build the recovery prompt from configuration.
 */
function buildRecoveryPrompt(
  originalText: string,
  parserOutput: ParseResult,
  lowCoverageSections: SectionCoverageItem[],
): { system: string; user: string } {
  const system = RECOVERY_SYSTEM_PROMPT;

  // Format low-coverage sections for the prompt
  const coverageSummary = lowCoverageSections
    .map(
      (c) =>
        `- ${c.sectionId}: ${Math.round(c.ratio * 100)}% coverage (${c.parsedWordCount}/${c.originalWordCount} words)`,
    )
    .join("\n");

  // Truncate original text if needed (keep within reasonable token limits)
  const truncatedText = originalText.length > 12000
    ? originalText.slice(0, 12000) + "\n\n[...truncated at 12000 chars for token limits]"
    : originalText;

  // Build a compact summary of parser output for the prompt
  const parserSummary = JSON.stringify(
    {
      contact: parserOutput.parsed.contact,
      summary:
        parserOutput.parsed.summary
          ? parserOutput.parsed.summary.slice(0, 500)
          : null,
      experienceCount: parserOutput.parsed.experience?.length ?? 0,
      experiencePreview: (parserOutput.parsed.experience ?? []).map((e) => ({
        role: e.role,
        company: e.company,
        bullets: e.bullets.length,
      })),
      educationCount: parserOutput.parsed.education?.length ?? 0,
      educationPreview: (parserOutput.parsed.education ?? []).map((e) => ({
        degree: e.degree,
        school: e.school,
      })),
      skillsCount: parserOutput.parsed.skills?.length ?? 0,
      projectsCount: parserOutput.parsed.projects?.length ?? 0,
    },
    null,
    2,
  );

  const user = [
    `## Original Resume Text`,
    truncatedText,
    ``,
    `## Parser Output (Incomplete)`,
    parserSummary,
    ``,
    `## Low Coverage Sections`,
    coverageSummary,
    ``,
    `Return ONLY valid JSON — no markdown, no code fences, no additional text.`,
    `Omit any section key that you could not recover.`,
  ].join("\n");

  return { system, user };
}

/* ------------------------------------------------------------------ */
/*  LLM call                                                          */
/* ------------------------------------------------------------------ */

/**
 * Call the configured LLM provider and return the raw parsed response.
 */
async function callRecoveryLLM(
  system: string,
  user: string,
  provider: RecoveryProviderConfig,
): Promise<unknown> {
  const signal = AbortSignal.timeout(30_000); // 30-second timeout

  if (provider.name === "gemini") {
    return callGemini({
      system,
      prompt: user,
      apiKey: provider.apiKey,
      model: provider.model ?? GEMINI_DEFAULT_MODEL,
      maxTokens: 4096,
      temperature: 0.2,
      signal,
    });
  }

  if (provider.name === "groq") {
    return callOpenAICompatible({
      baseUrl: GROQ_BASE_URL,
      apiKey: provider.apiKey,
      model: provider.model ?? GROQ_DEFAULT_MODEL,
      system,
      prompt: user,
      maxTokens: 4096,
      temperature: 0.2,
      signal,
    });
  }

  throw new Error(`Unsupported recovery provider: ${provider.name}`);
}

/* ------------------------------------------------------------------ */
/*  Response parsing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse the raw LLM response into a typed RecoveryResult.
 * Returns an empty result if parsing fails.
 */
function parseRecoveryResponse(raw: unknown): RecoveryResult {
  if (!raw || typeof raw !== "object") return {};

  const data = raw as Record<string, unknown>;
  const result: RecoveryResult = {};

  // Validate experience (array of objects with role, company, start, end, bullets)
  if (Array.isArray(data.experience)) {
    const valid = data.experience.filter(
      (e: unknown) =>
        e &&
        typeof e === "object" &&
        typeof (e as Record<string, unknown>).role === "string" &&
        ((e as Record<string, unknown>).role as string).trim().length > 0,
    );
    if (valid.length > 0) {
      result.experience = valid.map(
        (e: unknown) => {
          const entry = e as Record<string, unknown>;
          return {
            role: String(entry.role ?? "").trim(),
            company: String(entry.company ?? "").trim(),
            start: String(entry.start ?? "").trim(),
            end: String(entry.end ?? "").trim(),
            bullets: Array.isArray(entry.bullets)
              ? entry.bullets.map((b: unknown) => String(b).trim()).filter(Boolean)
              : [],
          };
        },
      );
    }
  }

  // Validate education (array of objects with school, degree, graduation)
  if (Array.isArray(data.education)) {
    const valid = data.education.filter(
      (e: unknown) =>
        e &&
        typeof e === "object" &&
        typeof (e as Record<string, unknown>).school === "string" &&
        (e as Record<string, unknown>).school &&
        typeof (e as Record<string, unknown>).degree === "string",
    );
    if (valid.length > 0) {
      result.education = valid.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        return {
          school: String(entry.school ?? "").trim(),
          degree: String(entry.degree ?? "").trim(),
          graduation: String(entry.graduation ?? "").trim(),
        };
      });
    }
  }

  // Validate projects (array of objects with name)
  if (Array.isArray(data.projects)) {
    const valid = data.projects.filter(
      (p: unknown) =>
        p &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).name === "string" &&
        ((p as Record<string, unknown>).name as string).trim().length > 0,
    );
    if (valid.length > 0) {
      result.projects = valid.map((p: unknown) => {
        const entry = p as Record<string, unknown>;
        return {
          name: String(entry.name ?? "").trim(),
          bullets: Array.isArray(entry.bullets)
            ? entry.bullets.map((b: unknown) => String(b).trim()).filter(Boolean)
            : [],
        };
      });
    }
  }

  // Validate summary (string)
  if (
    typeof data.summary === "string" &&
    data.summary.trim().length > 0
  ) {
    result.summary = data.summary.trim();
  }

  // Validate skills (array of { category, items })
  if (Array.isArray(data.skills)) {
    const valid = data.skills.filter(
      (s: unknown) =>
        s &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).category === "string" &&
        ((s as Record<string, unknown>).category as string).trim().length > 0 &&
        Array.isArray((s as Record<string, unknown>).items) &&
        ((s as Record<string, unknown>).items as unknown[]).length > 0,
    );
    if (valid.length > 0) {
      result.skills = valid.map((s: unknown) => {
        const entry = s as Record<string, unknown>;
        return {
          category: String(entry.category ?? "").trim(),
          items: Array.isArray(entry.items)
            ? entry.items.map((i: unknown) => String(i).trim()).filter(Boolean)
            : [],
        };
      });
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

/**
 * Run the AI recovery pass.
 *
 * Sends the original resume text + parser output to the LLM for sections
 * that had low coverage, and returns the reconstructed data.
 *
 * Returns an empty RecoveryResult if the LLM call fails (graceful degradation).
 */
export async function recoverSections(
  config: RecoveryConfig,
): Promise<RecoveryResult> {
  const { originalText, parserOutput, lowCoverageSections, provider } = config;

  // Build the prompt
  const { system, user } = buildRecoveryPrompt(
    originalText,
    parserOutput,
    lowCoverageSections,
  );

  try {
    const raw = await callRecoveryLLM(system, user, provider);
    return parseRecoveryResponse(raw);
  } catch (error) {
    // Graceful degradation: log and return empty result
    console.warn(
      "[resume-recovery] AI recovery pass failed, falling back to parser output:",
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Merge logic                                                       */
/* ------------------------------------------------------------------ */

/**
 * Determine whether a section needs AI recovery based on coverage.
 */
function needsRecovery(
  sectionId: string,
  coverage: SectionCoverageItem[],
): boolean {
  const item = coverage.find((c) => c.sectionId === sectionId);
  if (!item) return false;
  return item.ratio < COVERAGE_THRESHOLD;
}

/**
 * Merge parser output with AI recovery data.
 *
 * Rules:
 * - Contact info: always keep parser (email extraction is reliable)
 * - Experience: filter parser fragments, then merge AI entries with dedup
 * - Education: soft-dedup by substring overlap to catch reformatted entries
 * - Projects: deduplicate by name
 * - Skills: use AI categorized skills when parser coverage is low; flatten
 *           with category labels for the string[] domain type
 * - Summary: use AI version if parser coverage < 80%, otherwise keep parser
 * - Certifications: always keep parser (simple list items)
 */
export function mergeRecovery(
  parsed: ParseResult,
  recovered: RecoveryResult,
): MergedResult {
  const base = {
    contact: parsed.parsed.contact,
    summary: parsed.parsed.summary ?? "",
    experience: parsed.parsed.experience ?? [],
    education: parsed.parsed.education ?? [],
    skills: parsed.parsed.skills ?? [],
    certifications: parsed.parsed.certifications ?? [],
    professionalQualities: parsed.parsed.professionalQualities ?? [],
    projects: parsed.parsed.projects ?? [],
  };

  const recoveredSections: string[] = [];

  // ── Summary ──
  if (recovered.summary && needsRecovery("summary", parsed.coverage)) {
    base.summary = recovered.summary;
    recoveredSections.push("summary");
  }

  // ── Experience ──
  if (recovered.experience && needsRecovery("experience", parsed.coverage)) {
    // Replace parser entries entirely with AI-recovered entries.
    // The AI is prompted to only return information explicitly present in
    // the original text and is strictly structured, so its output is the
    // canonical list. Parser fragments with missing company/dates would
    // produce duplicates under dedup-append, inflating counts.
    base.experience = recovered.experience.map((e, i) => ({
      id: `import-exp-recovered-${i + 1}`,
      role: e.role,
      company: e.company ?? "",
      location: "",
      start: e.start ?? "",
      end: e.end ?? "",
      bullets: e.bullets ?? [],
    }));
    recoveredSections.push("experience");
  }

  // ── Education ──
  if (recovered.education && needsRecovery("education", parsed.coverage)) {
    // Replace parser entries entirely with AI-recovered entries.
    // Same reasoning as experience: the AI produces the full canonical list
    // from the original text; soft-dedup by 60% substring overlap still
    // produces duplicates when the parser captured a partial entry.
    base.education = recovered.education.map((e, i) => ({
      id: `import-edu-recovered-${i + 1}`,
      school: e.school,
      degree: e.degree,
      location: "",
      graduation: e.graduation ?? "",
    }));
    if (!recoveredSections.includes("education")) {
      recoveredSections.push("education");
    }
  }

  // ── Projects ──
  if (recovered.projects && needsRecovery("projects", parsed.coverage)) {
    if (base.projects.length === 0) {
      base.projects = recovered.projects.map((p, i) => ({
        id: `import-proj-recovered-${i + 1}`,
        name: p.name,
        description: "",
        bullets: p.bullets ?? [],
      }));
    } else {
      // Deduplicate: add AI projects not already in parser output
      const existingNames = new Set(
        base.projects.map((p) => p.name.toLowerCase()),
      );
      for (const proj of recovered.projects) {
        if (!existingNames.has(proj.name.toLowerCase())) {
          base.projects.push({
            id: `import-proj-recovered-${base.projects.length + 1}`,
            name: proj.name,
            description: "",
            bullets: proj.bullets ?? [],
          });
          existingNames.add(proj.name.toLowerCase());
        }
      }
    }
    recoveredSections.push("projects");
  }

  // ── Skills ──
  if (needsRecovery("skills", parsed.coverage)) {
    if (recovered.skills && recovered.skills.length > 0) {
      // Flatten categorized skills into the string[] domain format.
      // Category labels become prefixes: "Frontend: React", "Backend: Node.js"
      const flatSkills: string[] = [];
      for (const cat of recovered.skills) {
        const prefix = cat.category.trim();
        for (const item of cat.items) {
          const labeled = item.includes(":") || item.startsWith(prefix)
            ? item
            : `${prefix}: ${item}`;
          flatSkills.push(labeled);
        }
      }
      // Replace parser skills entirely with AI-recovered skills.
      // The AI has the full original text and extracts all skills per category.
      base.skills = flatSkills;
    }
    recoveredSections.push("skills");
  }

  return {
    parsed: base,
    recoveredSections,
    aiRecovered: recoveredSections.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Check if any critical section in the coverage data is below the
 * recovery threshold.
 */
export function needsAICoverageRecovery(coverage: SectionCoverageItem[]): boolean {
  return coverage.some(
    (c) => CRITICAL_SECTIONS.has(c.sectionId) && c.ratio < COVERAGE_THRESHOLD,
  );
}
