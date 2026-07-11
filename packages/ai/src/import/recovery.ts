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
  /** Certifications recovered from the original text. */
  certifications?: string[];
  /** Professional qualities recovered from the original text. */
  professionalQualities?: string[];
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

const CRITICAL_SECTIONS = new Set([
  "experience",
  "education",
  "projects",
  "certifications",
  "professionalQualities",
]);
const COVERAGE_THRESHOLD = 0.8; // 80% — sections below this trigger recovery

const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const INLINE_BULLET_MARKER_RE =
  /(?:[\u2022\u25cf\u25aa\u25e6]|\u00e2(?:\u20ac\u00a2|\u2014[\u008f\u00a6]|\u2013\u00aa))/;
const LINE_START_BULLET_MARKER_RE = new RegExp(
  `(?:${INLINE_BULLET_MARKER_RE.source}|[*\\-]|\\d+[.)])`,
);
const BULLET_RE = new RegExp(`^${LINE_START_BULLET_MARKER_RE.source}\\s*`);
const EMBEDDED_BULLET_RE = new RegExp(`(?=${INLINE_BULLET_MARKER_RE.source}\\s*)`, "g");

function cleanBulletText(value: string): string {
  return value.replace(BULLET_RE, "").replace(/\s+/g, " ").trim();
}

function isOrphanBulletContinuation(text: string, previous: string): boolean {
  if (!previous) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5) return false;
  if (/^(?:and|or|with|through|by|for|to|from|in|on|at|of)\b/i.test(text)) return true;
  return /^[a-z]/.test(text) && /[.!?]$/.test(text);
}

function normalizeRecoveredBullets(bullets: string[] = []): string[] {
  const normalized: string[] = [];

  for (const bullet of bullets) {
    const pieces = bullet
      .split(EMBEDDED_BULLET_RE)
      .map(cleanBulletText)
      .filter(Boolean);

    for (const piece of pieces) {
      const lastIndex = normalized.length - 1;
      if (lastIndex >= 0 && isOrphanBulletContinuation(piece, normalized[lastIndex])) {
        normalized[lastIndex] = `${normalized[lastIndex]} ${piece}`;
      } else {
        normalized.push(piece);
      }
    }
  }

  return normalized;
}

/** Groq fallback model list (first available is tried first). */
const GROQ_DEFAULT_MODELS = [
  process.env.GROQ_MODEL,
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
].filter(Boolean) as string[];

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
  "You are a resume reconstruction expert. Your task is to recover missing or fragmented information from a resume that was only partially parsed by an automated system.",
  "",
  "You will receive:",
  "1. The **original resume text** — the full text the user pasted (may contain OCR artifacts or line breaks)",
  "2. The **parser output** — what the automated parser extracted (may be incomplete, truncated, or fragmented)",
  "3. A list of **low-coverage sections** — sections where the parser preserved less than 80% of the content",
  "",
  "For EACH low-coverage section, carefully read the original resume text and extract ALL available information.",
  "Be thorough and complete — recover fragmented entries, merge wrapped lines, and extract full text even when split across multiple lines.",
  "",
  "## Critical Rules",
  "- Return ONLY information that is explicitly present in the original text",
  "- Do NOT invent, infer, or rewrite content",
  "- Preserve the exact wording from the original text",
  "- When extracting bullet points: if a bullet appears to end mid-sentence or with a preposition (through, with, by, etc.),",
  "  look for continuation text on the next line and merge them into a complete sentence.",
  "",
  "## Anti-Hallucination Rules — STRICTLY ENFORCED",
  "- NEVER invent metrics, percentages, or numbers not in the original text",
  "- NEVER invent job titles, companies, or employment periods not in the original text",
  "- NEVER invent certification names or credential details not in the original text",
  "- NEVER invent project names or descriptions not in the original text",
  "- NEVER invent dates, years, or timeframes not explicitly present",
  "- If uncertain about any detail, omit it rather than guessing",
  "- It is BETTER to return an empty array than to include fabricated content",
  "- If a section is truly absent from the resume, return an empty result for that key (omit the key entirely)",
  "",
  "## Section-Specific Instructions",
  "",
  "### Experience Bullets",
  "- Each bullet is a complete accomplishment or responsibility statement",
  "- If a bullet appears truncated (ends with 'through', 'with', 'by', 'for', etc.), merge with the next line to complete it",
  "- Clean up artifacts (extra spaces, line breaks within sentences)",
  "- Maintain the original order",
  "",
  "### Skills",
  "- Extract ALL skill categories present in the original text — do not skip any category",
  "- Preserve category names EXACTLY as written in the original (e.g., 'LLM / Automation', not 'LLM')",
  "- Do NOT merge or combine categories — each distinct category label is preserved separately",
  "- Examples of distinct categories that must be kept separate:",
  "  * 'Cloud / Infra / Tools' (not merged into 'Backend')",
  "  * 'Coding with AI' (not merged into 'LLM')",
  "  * 'LLM / Automation' (preserve the slash and full label)",
  "- Within each category, list individual skill items separated cleanly (no parentheses artifacts)",
  "- Example output:",
  "  [",
  "    { category: 'Frontend', items: ['React', 'TypeScript', 'Next.js'] },",
  "    { category: 'Cloud / Infra / Tools', items: ['AWS (EC2, S3, Lambda)', 'Docker'] },",
  "    { category: 'Coding with AI', items: ['GitHub Copilot', 'Claude Code'] }",
  "  ]",
  "- Fix fragmented skills: if you see 'AWS (EC2', 'S3', 'Lambda)' as separate items, merge into 'AWS (EC2, S3, Lambda)'",
  "",
  "### Contact Information",
  "- Extract email, phone, LinkedIn, GitHub, and any portfolio/personal website URLs from the resume header",
  "- Common patterns:",
  "  * Email: emails@example.com",
  "  * Phone: (123) 456-7890, +1-800-CALL-NOW, 123-456-7890",
  "  * LinkedIn: linkedin.com/in/username or https://linkedin.com/in/username",
  "  * GitHub: github.com/username or https://github.com/username",
  "  * Portfolio: portfolioname.com, myportfolio.io, or any personal website URL",
  "  * Certificates: certificate-link.com or explicitly labeled certificate URLs",
  "- Do NOT invent contact details — only extract what is explicitly present in the original text",
  "",
  "### Certifications & Professional Qualities",
  "- Extract each as a separate, clean string item",
  "- No empty arrays — omit the key entirely if section has no data",
  "",
  "### Entry Requirements",
  "- For experience: role, company, start date, end date, and at least one bullet point",
  "- For education: school, degree, and graduation year",
  "- For projects: project name (bullets optional)",
  "",
  "Return ONLY valid JSON in this format — no markdown, no code fences, no additional text:",
  "{",
  '  "experience": [',
  '    { "role": "Job Title", "company": "Company Name", "start": "Month Year", "end": "Month Year or Present", "bullets": ["Complete accomplishment statement"] }',
  "  ],",
  '  "education": [',
  '    { "school": "University Name", "degree": "Full Degree Name", "graduation": "Year" }',
  "  ],",
  '  "skills": [',
  '    { "category": "Frontend", "items": ["React", "TypeScript", "Next.js"] },',
  '    { "category": "Backend", "items": ["Node.js", "PostgreSQL"] },',
  '    { "category": "Cloud / Infrastructure", "items": ["AWS (EC2, S3, Lambda)", "Docker"] }',
  "  ],",
  '  "projects": [',
  '    { "name": "Project Name", "bullets": ["Complete project description or detail"] }',
  "  ],",
  '  "summary": "Full professional summary text",',
  '  "certifications": ["Certification Name 1", "Certification Name 2"],',
  '  "professionalQualities": ["Quality 1", "Quality 2"]',
  "}",
  "",
  "IMPORTANT: Omit any section key that you could not recover or that is empty.",
  "Do NOT include empty arrays — only include keys with actual data.",
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
  const truncatedText =
    originalText.length > 12000
      ? originalText.slice(0, 12000) +
        "\n\n[...truncated at 12000 chars for token limits]"
      : originalText;

  // Build a compact summary of parser output for the prompt
  const parserSummary = JSON.stringify(
    {
      contact: parserOutput.parsed.contact,
      summary: parserOutput.parsed.summary
        ? parserOutput.parsed.summary.slice(0, 500)
        : null,
      experienceCount: parserOutput.parsed.experience?.length ?? 0,
      experiencePreview: (parserOutput.parsed.experience ?? []).map(
        (e: { role: string; company: string; bullets: string[] }) => ({
          role: e.role,
          company: e.company,
          bullets: e.bullets.length,
        }),
      ),
      educationCount: parserOutput.parsed.education?.length ?? 0,
      educationPreview: (parserOutput.parsed.education ?? []).map(
        (e: { degree: string; school: string }) => ({
          degree: e.degree,
          school: e.school,
        }),
      ),
      skillsCount: parserOutput.parsed.skills?.length ?? 0,
      certificationsCount: parserOutput.parsed.certifications?.length ?? 0,
      professionalQualitiesCount:
        parserOutput.parsed.professionalQualities?.length ?? 0,
      projectsCount: parserOutput.parsed.projects?.length ?? 0,
    },
    null,
    2,
  );

  const user = [
    "## Original Resume Text",
    truncatedText,
    "",
    "## Parser Output (Incomplete)",
    parserSummary,
    "",
    "## Low Coverage Sections",
    coverageSummary,
    "",
    "Return ONLY valid JSON — no markdown, no code fences, no additional text.",
    "Omit any section key that you could not recover.",
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
      model: provider.model ?? GROQ_DEFAULT_MODELS,
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
      result.experience = valid.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        return {
          role: String(entry.role ?? "").trim(),
          company: String(entry.company ?? "").trim(),
          start: String(entry.start ?? "").trim(),
          end: String(entry.end ?? "").trim(),
          bullets: Array.isArray(entry.bullets)
            ? entry.bullets
                .map((b: unknown) => String(b).trim())
                .filter(Boolean)
            : [],
        };
      });
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
            ? entry.bullets
                .map((b: unknown) => String(b).trim())
                .filter(Boolean)
            : [],
        };
      });
    }
  }

  // Validate summary (string)
  if (typeof data.summary === "string" && data.summary.trim().length > 0) {
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

  // Validate certifications (array of strings)
  if (Array.isArray(data.certifications)) {
    const valid = data.certifications
      .map((c: unknown) => (typeof c === "string" ? c.trim() : ""))
      .filter((c: string) => c.length > 0);
    if (valid.length > 0) {
      result.certifications = valid;
    }
  }

  // Validate professionalQualities (array of strings)
  if (Array.isArray(data.professionalQualities)) {
    const valid = data.professionalQualities
      .map((q: unknown) => (typeof q === "string" ? q.trim() : ""))
      .filter((q: string) => q.length > 0);
    if (valid.length > 0) {
      result.professionalQualities = valid;
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
 * - Education: replace parser entries entirely with AI entries when recovered
 * - Projects: deduplicate by name
 * - Skills: use AI categorized skills when parser coverage is low; flatten
 *           with category labels for the string[] domain type
 * - Summary: use AI version if parser coverage < 80%, otherwise keep parser
 * - Certifications: use AI recovered list if parser coverage was low
 * - Professional Qualities: use AI recovered list if parser coverage was low
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
    references: parsed.parsed.references ?? [],
  };

  const recoveredSections: string[] = [];

  // ── Summary ──
  if (recovered.summary && needsRecovery("summary", parsed.coverage)) {
    base.summary = recovered.summary;
    recoveredSections.push("summary");
  }

  // ── Experience ──
  if (
    recovered.experience &&
    recovered.experience.length > 0 &&
    needsRecovery("experience", parsed.coverage)
  ) {
    base.experience = recovered.experience.map((e, i) => ({
      id: `import-exp-recovered-${i + 1}`,
      role: e.role,
      company: e.company ?? "",
      location: "",
      start: e.start ?? "",
      end: e.end ?? "",
      bullets: normalizeRecoveredBullets(e.bullets),
    }));
    recoveredSections.push("experience");
  }

  // ── Education ──
  if (
    recovered.education &&
    recovered.education.length > 0 &&
    needsRecovery("education", parsed.coverage)
  ) {
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
  if (
    recovered.projects &&
    recovered.projects.length > 0 &&
    needsRecovery("projects", parsed.coverage)
  ) {
    if (base.projects.length === 0) {
      base.projects = recovered.projects.map((p, i) => ({
        id: `import-proj-recovered-${i + 1}`,
        name: p.name,
        description: "",
        bullets: normalizeRecoveredBullets(p.bullets),
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
            bullets: normalizeRecoveredBullets(proj.bullets),
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
      // Flatten categorized skills into clean atomic items.
      // Category metadata is preserved via `recoveredSkillCategories` on the
      // ParseResult for the grouped pill display in the import preview.
      // The flat array stores skill names ONLY — no "Category: Skill" prefixes.
      const flatSkills: string[] = [];
      for (const cat of recovered.skills) {
        for (const item of cat.items) {
          // Strip any residual prefix the LLM may have embedded
          const cleaned = item.replace(/^[^:]+:\s*/, "").trim();
          if (cleaned) flatSkills.push(cleaned);
        }
      }
      // Replace parser skills entirely with AI-recovered skills.
      base.skills = flatSkills;
    }
    recoveredSections.push("skills");
  }

  // ── Certifications ──
  if (
    recovered.certifications &&
    recovered.certifications.length > 0 &&
    needsRecovery("certifications", parsed.coverage)
  ) {
    base.certifications = recovered.certifications;
    recoveredSections.push("certifications");
  }

  // ── Professional Qualities ──
  if (
    recovered.professionalQualities &&
    recovered.professionalQualities.length > 0 &&
    needsRecovery("professionalQualities", parsed.coverage)
  ) {
    base.professionalQualities = recovered.professionalQualities;
    recoveredSections.push("professionalQualities");
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
export function needsAICoverageRecovery(
  coverage: SectionCoverageItem[],
): boolean {
  return coverage.some(
    (c) => CRITICAL_SECTIONS.has(c.sectionId) && c.ratio < COVERAGE_THRESHOLD,
  );
}
