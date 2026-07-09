import type { ResumeDocument, ResumeSectionId, ExperienceItem, EducationItem } from "@careerlaunch/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SectionConfidence = "high" | "medium" | "low";

export type CoverageStatus = "good" | "partial" | "poor" | "missing";

/**
 * Overall import quality — derived from per-section coverage ratios.
 * This is the source of truth for the import UI headline and CTA behavior.
 */
export type ImportQuality = "excellent" | "good" | "fair" | "poor" | "failed";

export type SectionCoverageItem = {
  sectionId: ResumeSectionId;
  originalWordCount: number;
  parsedWordCount: number;
  ratio: number;
  status: CoverageStatus;
};

export type ParseResult = {
  parsed: Partial<ResumeDocument>;
  /** Legacy overall confidence (0–100). Replaced by `importQuality` for
   *  user-facing display. Kept for analytics backward-compatibility. */
  confidence: number;
  confidenceBySection: Record<string, SectionConfidence>;
  /** Overall import quality — the source of truth for headline display
   *  and CTA behavior. Derived from per-section coverage ratios of
   *  critical sections (experience, education, skills). */
  importQuality: ImportQuality;
  warnings: string[];
  /** Raw text from sections where the parser could not fully structure the content.
   *  Keyed by section ID. This allows the UI to show what was lost. */
  unparsedContent: Record<string, string>;
  /** Per-section coverage analysis comparing input vs parsed content */
  coverage: SectionCoverageItem[];
  /** Layout classification for analytics. Identifies the resume format
   *  (pipe-experience, table-format, linkedin-export, standard-bullets, etc.)
   *  so the team can measure import success rates per layout type. */
  layouts: string[];
  /** Whether the AI recovery pass was applied (only present after recovery) */
  aiRecovered?: boolean;
  /** Which sections were reconstructed by the AI recovery pass */
  aiRecoveredSections?: string[];
  /** Rich AI recovery diagnostic object. Replaces the older flat aiRecoveryStatus
   *  string. Provides transparent info on which provider was used and which failed. */
  aiRecovery?: {
    status: "skipped" | "attempted" | "succeeded" | "fallback" | "failed";
    primaryProvider: string | null;
    usedProvider: string | null;
    failedProviders: string[];
    reason?: string;
  };
  /** Categorized skills from AI recovery, preserved for the UI to render
   *  grouped skill display (headings with pills per category).
   *  Only populated when the AI recovery pass provided categorized skills. */
  recoveredSkillCategories?: Array<{ category: string; items: string[] }>;
  /** Pre-recovery data snapshot for the comparison UI toggle.
   *  Only populated when AI recovery was applied. Maps sectionId to the
   *  pre-recovery content so users can see what changed. */
  preRecoveryData?: {
    summary: string;
    experience: ExperienceItem[];
    education: EducationItem[];
    skills: string[];
  };
};

/* ------------------------------------------------------------------ */
/*  Section header detection                                           */
/* ------------------------------------------------------------------ */

const SECTION_PATTERNS: { id: ResumeSectionId; patterns: RegExp[] }[] = [
  {
    id: "summary",
    patterns: [
      /\b(?:professional\s+)?summary\b/i,
      /\bprofile\b/i,
      /\babout\s+me\b/i,
      /\bobjective\b/i,
      /\bcareer\s+overview\b/i,
    ],
  },
  {
    id: "experience",
    patterns: [
      /\b(?:work\s+)?experience\b/i,
      /\bemployment\b/i,
      /\bwork\s+history\b/i,
      /\bprofessional\s+experience\b/i,
      /\brelevant\s+experience\b/i,
    ],
  },
  {
    id: "education",
    patterns: [
      /\beducation\b/i,
      /\bacademic\s+(?:background|history)\b/i,
    ],
  },
  {
    id: "skills",
    patterns: [
      /\bskills\b/i,
      /\b(?:core\s+)?competencies\b/i,
      /\btechnical\s+skills\b/i,
      /\bproficiency\b/i,
      /\bcategory\s+proficiency\b/i,
    ],
  },
  {
    id: "certifications",
    patterns: [
      /\bcertifications?\b/i,
      /\bcertificates?\b/i,
      /\blicenses?\b/i,
      /\bcredentials?\b/i,
    ],
  },
  {
    id: "projects",
    patterns: [
      /^(?:personal\s+)?projects?\s*$/im,
      /^(?:personal\s+)?projects?:/im,
      /\b(?:personal|key|technical|academic|side|other|relevant|software|open[- ]source)\s+projects?\b/i,
      /\bprojects?\s+undertaken\b/i,
      /\bprojects?\s+include\b/i,
    ],
  },
  {
    id: "references",
    patterns: [
      /\breferences?\b/i,
      /\breferences?\s+available\b/i,
    ],
  },
  {
    id: "professionalQualities",
    patterns: [
      /\bprofessional\s+qualities\b/i,
      /\bprofessional\s+qualifications\b/i,
      /\bcore\s+qualifications\b/i,
      /\bqualifications\b/i,
    ],
  },
];

/**
 * Find section boundaries in plain text.
 * Returns a map of section id → { start, end } line indices.
 */
function detectSections(
  lines: string[],
): Map<ResumeSectionId, { start: number; end: number }> {
  const sections = new Map<
    ResumeSectionId,
    { start: number; end: number }
  >();

  // Track which section IDs have been matched (not the same as the sections
  // map, which we build AFTER collecting all candidates).
  const seen = new Set<ResumeSectionId>();

  // Build ordered list of all matched headers (first match wins per section)
  const headers: { index: number; id: ResumeSectionId; header: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^[•\-*]\s/.test(line)) continue;

    for (const { id, patterns } of SECTION_PATTERNS) {
      if (seen.has(id)) continue; // first match wins per section
      for (const pattern of patterns) {
        if (pattern.test(line) && line.length < 60) {
          seen.add(id);
          headers.push({ index: i, id, header: line });
          break;
        }
      }
    }
  }

  // Sort by occurrence in text and set boundaries
  headers.sort((a, b) => a.index - b.index);

  for (let i = 0; i < headers.length; i++) {
    const end =
      i + 1 < headers.length ? headers[i + 1].index : lines.length;
    sections.set(headers[i].id, {
      start: headers[i].index + 1,
      end,
    });
  }

  return sections;
}

/* ------------------------------------------------------------------ */
/*  Contact extraction                                                 */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE =
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[a-zA-Z0-9_-]+\/?/;
/** Match domains that look like personal/professional websites or portfolio
 *  links. Uses \b at the start to prevent partial matches of email domains
 *  (e.g. prevents "ail.com" from matching inside "johndoe@gmail.com").
 *  Explicitly excludes common email provider domains, LinkedIn, and standalone
 *  email TLD-like fragments. */
const WEBSITE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?!linkedin)\b(?![\w.-]*@)(?!(?:gmail|yahoo|outlook|hotmail|protonmail|icloud|aol|zoho|yandex|mail)\.[a-zA-Z]{2,})[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/;

function extractContact(
  preambleLines: string[],
): { contact: Partial<ResumeDocument["contact"]>; used: number } {
  const contact: Partial<ResumeDocument["contact"]> = {};
  let used = 0;

  // First non-empty line is likely the name
  const nameLine = preambleLines.find((l) => l.trim().length > 0);
  if (nameLine) {
    contact.fullName = nameLine.trim();
    used = 1;
  }

  for (const line of preambleLines) {
    const emailMatch = line.match(EMAIL_RE);
    if (emailMatch && !contact.email) {
      contact.email = emailMatch[0];
    }

    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch && !contact.phone) {
      contact.phone = phoneMatch[0];
    }

    const linkedInMatch = line.match(LINKEDIN_RE);
    if (linkedInMatch && !contact.website) {
      contact.website = linkedInMatch[0];
    } else if (!contact.website && !emailMatch) {
      // Only attempt website extraction on lines that did NOT match an email.
      // Otherwise a partial domain match (e.g. "ail.com" from inside "johndoe@gmail.com")
      // would produce a spurious website artifact.
      const webMatch = line.match(WEBSITE_RE);
      if (webMatch) {
        contact.website = webMatch[0];
      }
    }

    // Location: line that contains city/state pattern but no email/phone
    if (
      !contact.location &&
      /\b[A-Z][a-z]+(?:,\s*[A-Z]{2})\b/.test(line)
    ) {
      contact.location = line.trim();
    }
  }

  return { contact, used };
}

/* ------------------------------------------------------------------ */
/*  Experience parsing                                                 */
/* ------------------------------------------------------------------ */

const DATE_RANGE_RE =
  /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})\s*\d{0,4})\s*[-–to]+\s*(\w+(?:\s+\d{4})?|\d{4}|present|current|now)/i;
const YEAR_RANGE_RE =
  /(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i;
const BULLET_RE = /^[•\-*\d.]+(?:\s+|$)/;

function parseExperience(lines: string[]): {
  experience: ResumeDocument["experience"];
  warnings: string[];
} {
  const experience: ResumeDocument["experience"] = [];
  const warnings: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if this line looks like a role/company header (has dates)
    const dateMatch = line.match(DATE_RANGE_RE) || line.match(YEAR_RANGE_RE);

    if (dateMatch) {
      const fullText = line;
      const withoutDate = fullText.replace(dateMatch[0], "").trim();

      // BUG FIX: When a line contains ONLY a date range ("Feb 2023 – May 2025")
      // with no role/company text on the same line, look backward at preceding
      // non-empty lines to find the role and company.
      // Common resume format:
      //   Software Developer            ← role
      //   Volenday Philippines Inc.     ← company
      //   Feb 2023 – May 2025           ← date-only line (was being used as role!)
      const isDateOnly = withoutDate.length === 0;

      if (isDateOnly) {
        // Scan backward from i-1 to find up to 2 non-empty, non-date lines
        // that are NOT section headers
        const lookbehind: string[] = [];
        let j = i - 1;
        while (j >= 0 && lookbehind.length < 2) {
          const prev = lines[j].trim();
          if (prev && !isLikelyHeader(prev) && !prev.match(DATE_RANGE_RE) && !prev.match(YEAR_RANGE_RE)) {
            lookbehind.unshift(prev);
          }
          j--;
        }

        let role = lookbehind[0] ?? "Unknown Role";
        let company = lookbehind[1] ?? "";

        // If the role line contains "at" or "|", split for company
        const atSplit = role.split(/\s+at\s+/);
        if (atSplit.length >= 2) {
          role = atSplit[0].trim();
          company = atSplit.slice(1).join(" at ").trim() || company;
        } else {
          const pipeSplit = role.split(/\s*\|\s*/);
          if (pipeSplit.length >= 2) {
            role = pipeSplit[0].trim();
            company = pipeSplit.slice(1).join(" | ").trim() || company;
          }
        }

        // Role may still carry date text from a prior bad parse — clean it
        role = role.replace(DATE_RANGE_RE, "").replace(YEAR_RANGE_RE, "").trim() || "Unknown Role";

        const [start, end] = dateMatch[1] && dateMatch[2]
          ? [dateMatch[1].trim(), dateMatch[2].trim()]
          : ["", ""];

        // Collect bullets — accept lines with or without bullet markers,
        // but stop when we detect the start of the next entry.
        i++;
        const bullets: string[] = [];
        let bulletCount = 0;
        while (i < lines.length) {
          const bline = lines[i].trim();
          if (!bline) { i++; continue; }
          if (lines[i].match(DATE_RANGE_RE) || lines[i].match(YEAR_RANGE_RE)) break;
          if (isLikelyHeader(lines[i])) break;

          const hasMarker = BULLET_RE.test(bline);
          const cleaned = bline.replace(BULLET_RE, "").trim();
          if (!cleaned) { i++; continue; }

          if (hasMarker) {
            bullets.push(cleaned);
            bulletCount++;
            i++;
          } else if (bulletCount > 0) {
            // Unmarked continuation line after a bullet marker.
            // Check if this is actually the start of the next entry by
            // peeking ahead for a date range in the next 1-3 lines.
            let nextHasDate = false;
            const peekLimit = Math.min(i + 3, lines.length - 1);
            for (let look = 1; look <= peekLimit - i; look++) {
              const peekLine = lines[i + look].trim();
              if (peekLine.match(DATE_RANGE_RE) || peekLine.match(YEAR_RANGE_RE)) {
                nextHasDate = true;
                break;
              }
            }
            // Also check if this line itself looks like a role/company entry
            // (short line without being a continuation phrase)
            const isNextEntry = cleaned.length < 80 && !startsWithArticle(cleaned) && nextHasDate;
            if (nextHasDate && isNextEntry) break;
            // Otherwise treat it as a continuation of the last bullet
            bullets[bullets.length - 1] += " " + cleaned;
            bulletCount++;
            i++;
          } else {
            // No bullets collected yet — this is likely the start of the next entry
            break;
          }
        }

        experience.push({
          id: `import-exp-${experience.length + 1}`,
          role,
          company,
          location: "",
          start: normalizeDate(start),
          end: normalizeDate(end),
          bullets,
        });
        continue;
      }

      // Normal case: date is on the same line as role/company
      let role = fullText;
      let company = "";

      // Try to split on " at " or " | " or " - "
      const atSplit = fullText.split(/\s+at\s+/);

      if (atSplit.length >= 2) {
        role = atSplit[0].trim();
        company = atSlice(atSplit, dateMatch);
      } else {
        const withoutDate = fullText.replace(dateMatch[0], "").trim();
        // Try pipe split first: "Role | Company | Dates"
        const pipeSplit = withoutDate.split(/\s*\|\s*/);
        if (pipeSplit.length >= 2) {
          role = pipeSplit[0].trim();
          // For "Role | Company | (dates removed)", take the middle parts
          const companyParts = pipeSplit.slice(1).filter(Boolean);
          company = companyParts.join(" | ").replace(/\|\s*$/, "").trim();
        } else {
          const dashSplit = withoutDate.split(/\s+[-–]\s+/);
          if (dashSplit.length >= 2) {
            company = dashSplit[0].trim();
            role = dashSplit.slice(1).join(" - ").trim();
          }
        }
      }

      const [start, end] = dateMatch[1] && dateMatch[2]
        ? [dateMatch[1].trim(), dateMatch[2].trim()]
        : ["", ""];

      // Collect bullets
      i++;
      const bullets: string[] = [];
      while (i < lines.length) {
        const bline = lines[i].trim();
        if (!bline) {
          i++;
          continue;
        }
        // Check if the next line starts a new entry (has a date pattern)
        if (lines[i].match(DATE_RANGE_RE) || lines[i].match(YEAR_RANGE_RE)) {
          break;
        }
        // Check if next line is a section header
        if (isLikelyHeader(lines[i])) {
          break;
        }
        const cleaned = bline.replace(BULLET_RE, "").trim();
        if (!cleaned) { i++; continue; }

        // If this is a bullet marker line, add as new bullet
        if (BULLET_RE.test(bline)) {
          bullets.push(cleaned);
        } else if (bullets.length > 0) {
          // Unmarked continuation — merge with the previous bullet
          // Check if it looks like the start of the next entry (role/company name)
          let nextHasDate = false;
          const peekLimit = Math.min(i + 3, lines.length - 1);
          for (let look = 1; look <= peekLimit - i; look++) {
            const peekLine = lines[i + look].trim();
            if (peekLine.match(DATE_RANGE_RE) || peekLine.match(YEAR_RANGE_RE)) {
              nextHasDate = true;
              break;
            }
          }
          const isNextEntry = cleaned.length < 80 && !startsWithArticle(cleaned) && nextHasDate;
          if (nextHasDate && isNextEntry) break;
          bullets[bullets.length - 1] += " " + cleaned;
        } else {
          break;
        }
        i++;
      }

      // Deduplicate: if role ends with company text, strip company from role
      const cleanRole = company && role.toLowerCase().endsWith(company.toLowerCase())
        ? role.slice(0, -company.length).replace(/[-–|]\s*$/, "").trim()
        : role;

      experience.push({
        id: `import-exp-${experience.length + 1}`,
        role: cleanRole || "Unknown Role",
        company,
        location: "",
        start: normalizeDate(start),
        end: normalizeDate(end),
        bullets,
      });
    } else {
      i++;
    }
  }

  if (experience.length === 0) {
    warnings.push("Could not detect any work experience entries. Check the format.");
  }

  return { experience, warnings };
}

function atSlice(atSplit: string[], dateMatch: RegExpMatchArray): string {
  const parts = atSplit.slice(1);
  const joined = parts.join(" at ");
  return joined.replace(dateMatch[0], "").replace(/[-–]\s*$/, "").trim();
}

/* ------------------------------------------------------------------ */
/*  Education parsing                                                  */
/* ------------------------------------------------------------------ */

function parseEducation(lines: string[]): {
  education: ResumeDocument["education"];
  warnings: string[];
} {
  const education: ResumeDocument["education"] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || BULLET_RE.test(trimmed)) continue;

    if (
      /\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Associate|Doctorate|MBA|MD|JD)\b/i.test(
        trimmed,
      )
    ) {
      const gradMatch = trimmed.match(GRAD_RE);
      // Look ahead for the school line (non-degree, non-empty line that follows)
      let school = extractSchool(trimmed);
      let gradYear = gradMatch ? gradMatch[1].trim() : "";

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          !BULLET_RE.test(nextLine) &&
          !/\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Associate|Doctorate|MBA|MD|JD)\b/i.test(nextLine)
        ) {
          // The next line looks like a school/institution name
          const lookaheadSchool = extractSchool(nextLine);
          // If extractSchool finds a known institution keyword, prefer it
          if (lookaheadSchool !== nextLine) {
            school = lookaheadSchool;
          } else if (school === trimmed) {
            school = nextLine;
          }
          // Extract graduation year from the school line and strip it from school
          const nextGrad = nextLine.match(GRAD_RE);
          if (nextGrad) {
            gradYear = nextGrad[1].trim();
          }
        }
      }

      // Strip graduation year from school field if embedded
      if (gradYear && school.endsWith(`, ${gradYear}`)) {
        school = school.slice(0, -`, ${gradYear}`.length).trim();
      } else if (gradYear && school.endsWith(` ${gradYear}`)) {
        school = school.slice(0, -` ${gradYear}`.length).trim();
      }

      // Build degree text — strip school only if it's embedded
      let degree = gradMatch
        ? trimmed.replace(gradMatch[0], "").replace(/[-–,;]\s*$/, "").trim()
        : trimmed;

      // For multi-line: ensure school isn't embedded in degree text
      // e.g. "Bachelor of Science in Information Technology - University of Santo Tomas, 2019"
      // becomes school="University of Santo Tomas", degree="Bachelor of Science in Information Technology"
      if (school !== trimmed) {
        // Find where the school name starts in the trimmed line
        const schoolIndex = trimmed.indexOf(school);
        if (schoolIndex > 0) {
          // School is embedded after a degree title — extract the degree
          degree = trimmed.slice(0, schoolIndex).replace(/[-–,]\s*$/, "").trim();
        }
        // If schoolIndex === 0, the school spans the whole line (no degree prefix),
        // so the degree was already correctly computed as the trimmed grad year
      }
      // Final cleanup: ensure degree doesn't end with stray punctuation
      degree = degree.replace(/[-–,]\s*$/, "").trim();

      education.push({
        id: `import-edu-${education.length + 1}`,
        school,
        degree: degree || trimmed,
        location: "",
        graduation: gradYear,
      });
    }
  }

  if (education.length === 0) {
    warnings.push("Could not detect education entries.");
  }

  return { education, warnings };
}

const GRAD_RE = /(\b(?:19|20)\d{2})\b/;

function extractSchool(text: string): string {
  const universities = [
    "University",
    "College",
    "Institute",
    "School",
    "Academy",
    "Polytechnic",
  ];
  for (const keyword of universities) {
    const index = text.search(
      new RegExp(`\\b${keyword}\\b`, "i"),
    );
    if (index >= 0) {
      const match = text.slice(index).match(/^[^,-]+(?:[,-][^,-]+){0,3}/);
      if (match) return match[0].trim();
    }
  }
  return text;
}

/* ------------------------------------------------------------------ */
/*  Skills parsing                                                     */
/* ------------------------------------------------------------------ */

function parseSkills(lines: string[]): string[] {
  const skills: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Strip bullet markers if present — skills are often listed as bullet items
    const deBulleted = trimmed.replace(BULLET_RE, "").trim();
    const useLine = deBulleted || trimmed;

    // Detect table-format skills with category labels separated by 2+ spaces
    // "Frontend                    HTML, CSS, TypeScript"
    const cols = useLine.split(/\s{2,}/).filter(Boolean);
    // Take the last column (actual skills) — earlier columns are category labels
    const target = cols.length > 1 ? cols[cols.length - 1] : useLine;

    // Split on comma, pipe, bullet, or newline within the skills section
    const candidates = target
      .split(/[,|•;]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 60);

    if (target.includes(",") || target.includes("|")) {
      skills.push(...candidates);
    } else {
      // For single values, still prefer the last column from table format
      skills.push(target);
    }
  }

  return [...new Set(skills)];
}

/* ------------------------------------------------------------------ */
/*  Summary parsing                                                    */
/* ------------------------------------------------------------------ */

function parseSummary(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter((l) => {
      if (l.length === 0) return false;
      // Filter out table-format lines (2+ consecutive spaces indicating columns)
      // These belong to skills tables, not summary prose.
      if (/\s{3,}/.test(l)) return false;
      return true;
    })
    .join(" ")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  References parsing                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse reference entries from section lines.
 *
 * Supports common formats:
 *   Name | Title, Company | Phone
 *   Name | Title | Company | Phone | Email
 *   Name - Title - Company - Phone
 *   Name, Title, Company, Email, Phone
 *
 * Also handles simple bullet lists of names with contact info.
 */
function parseReferences(lines: string[]): ResumeDocument["references"] {
  const references: ResumeDocument["references"] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Skip lines that look like section headers
    if (/^references?\s*(available\s+upon\s+request)?$/i.test(trimmed)) continue;
    if (trimmed.length > 150) continue;

    const deBulleted = trimmed.replace(BULLET_RE, "").trim();
    const line = deBulleted || trimmed;

    // Try splitting by pipe first (most structured format)
    // "Name | Position, Company | Phone"
    const pipeParts = line.split("|").map((s) => s.trim()).filter(Boolean);
    if (pipeParts.length >= 2) {
      const ref = refFromParts(pipeParts);
      if (ref) references.push(ref);
      continue;
    }

    // Try splitting by dash with spaces (Name - Title - Company - Phone)
    const dashParts = line.split(/\s+[-–]\s+/).map((s) => s.trim()).filter(Boolean);
    if (dashParts.length >= 3) {
      const ref = refFromParts(dashParts);
      if (ref) references.push(ref);
      continue;
    }

    // Try splitting by 2+ spaces (Name    Title    Phone)
    const spaceCols = line.split(/\s{3,}/).filter(Boolean);
    if (spaceCols.length >= 2) {
      const ref = refFromParts(spaceCols);
      if (ref) references.push(ref);
      continue;
    }

    // Fallback: treat single-line entries with comma separation
    const commaParts = line.split(",").map((s) => s.trim()).filter(Boolean);
    if (commaParts.length >= 3) {
      const ref = refFromParts(commaParts);
      if (ref) references.push(ref);
      continue;
    }

    // Last resort: just use the whole line as the name
    if (line.length >= 3) {
      references.push({
        id: `import-ref-${references.length + 1}`,
        name: line,
        title: "",
        company: "",
        phone: "",
        email: "",
        relationship: "",
      });
    }
  }

  return references;
}

/**
 * Map an array of string parts from a parsed reference line into a ReferenceItem.
 * Heuristic: first part is name, last part is typically phone or email.
 * Parts in between are title/company.
 */
function refFromParts(parts: string[]): ResumeDocument["references"][number] | null {
  if (parts.length === 0) return null;

  const name = parts[0];
  if (!name || name.length < 2) return null;

  let title = "";
  let company = "";
  let phone = "";
  let email = "";
  let relationship = "";

  // Categorize the remaining parts
  const remaining = parts.slice(1);

  for (const part of remaining) {
    if (!part) continue;

    // Email detection
    if (/^[\w.%-]+@[\w.-]+\.[a-z]{2,}$/i.test(part)) {
      if (!email) email = part;
      continue;
    }

    // Phone detection (digits, dashes, dots, parentheses, leading +)
    if (/^[\+]?[\d\s\-\(\)\.]{6,20}$/.test(part.replace(/[ext\s.]*\d*$/i, "").trim())) {
      if (!phone) phone = part;
      continue;
    }

    // Looks like a company with common suffixes
    if (/\b(?:Corp|Inc|LLC|Ltd|Company|Organization|Dept|Department|University|College|School)\b/i.test(part)) {
      company = company ? `${company}, ${part}` : part;
      continue;
    }

    // Looks like a job title (starts with preposition or common title prefix)
    if (/^(?:Professor|Dr|Engineer|Manager|Director|Supervisor|Specialist|Coordinator|Analyst|Consultant|Officer|Head|Lead|Senior|Junior|Associate|HR|President|CEO|CFO|COO|CTO|VP|VP\s+of|AVP|AVP\s+of)\b/i.test(part)) {
      title = title ? `${title}, ${part}` : part;
      continue;
    }

    // Relationship markers
    if (/\b(?:colleague|coworker|supervisor|manager|mentor|professor|teacher|client|partner|friend|former)\b/i.test(part)) {
      relationship = relationship ? `${relationship}, ${part}` : part;
      continue;
    }

    // Everything else: if title is empty, assume this is title+company combined
    if (!title && !company) {
      // Check for comma-separated "Title, Company" pattern
      const subParts = part.split(",").map((s) => s.trim());
      if (subParts.length >= 2) {
        title = subParts[0];
        company = subParts.slice(1).join(", ");
      } else {
        title = part;
      }
    } else if (!company) {
      company = part;
    } else {
      // Already have both, treat as relationship or append to notes
      relationship = relationship ? `${relationship}, ${part}` : part;
    }
  }

  return {
    id: `import-ref-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    name,
    title,
    company,
    phone,
    email,
    relationship,
  };
}

function isLikelyHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  for (const { patterns } of SECTION_PATTERNS) {
    for (const p of patterns) {
      if (p.test(trimmed)) return true;
    }
  }
  return false;
}

/**
 * Check if text starts with a lowercase article, preposition, or conjunction
 * — a sign this line is a continuation of the previous bullet, not a new entry.
 */
function startsWithArticle(text: string): boolean {
  return /^(?:with|and|through|using|by|for|in|on|at|to|the|a|an|of|its|their|his|her|our|enabling|ensuring|focusing|leveraging|including|providing|while|during|across|within|after|before|under|over|between|throughout|following|resulting)\b/i.test(text.trim());
}

function normalizeDate(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "present" || lower === "current" || lower === "now") {
    return "Present";
  }
  // Normalize month names
  const months: Record<string, string> = {
    jan: "Jan", january: "Jan",
    feb: "Feb", february: "Feb",
    mar: "Mar", march: "Mar",
    apr: "Apr", april: "Apr",
    may: "May",
    jun: "Jun", june: "Jun",
    jul: "Jul", july: "Jul",
    aug: "Aug", august: "Aug",
    sep: "Sep", september: "Sep",
    oct: "Oct", october: "Oct",
    nov: "Nov", november: "Nov",
    dec: "Dec", december: "Dec",
  };

  for (const [key, val] of Object.entries(months)) {
    if (lower.startsWith(key)) {
      return value.replace(new RegExp(key, "i"), val);
    }
  }

  return value;
}

/* ------------------------------------------------------------------ */
/*  Main parser                                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Coverage analysis                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute per-section coverage by comparing original text word count
 * against parsed content word count.
 */
function computeSectionCoverage(
  sectionId: ResumeSectionId,
  sectionLines: string[],
  parsed: Partial<ResumeDocument>,
): SectionCoverageItem {
  const originalWordCount = sectionLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  let parsedWordCount = 0;

  switch (sectionId) {
    case "summary": {
      parsedWordCount = countWords(parsed.summary || "");
      break;
    }
    case "experience": {
      for (const exp of parsed.experience || []) {
        parsedWordCount += countWords(exp.role);
        parsedWordCount += countWords(exp.company);
        parsedWordCount += countWords(exp.location);
        for (const b of exp.bullets) parsedWordCount += countWords(b);
      }
      break;
    }
    case "education": {
      for (const edu of parsed.education || []) {
        parsedWordCount += countWords(edu.degree);
        parsedWordCount += countWords(edu.school);
        parsedWordCount += countWords(edu.location);
      }
      break;
    }
    case "skills": {
      for (const s of parsed.skills || []) parsedWordCount += countWords(s);
      break;
    }
    case "certifications": {
      for (const c of parsed.certifications || []) parsedWordCount += countWords(c);
      break;
    }
    case "professionalQualities": {
      for (const q of parsed.professionalQualities || []) parsedWordCount += countWords(q);
      break;
    }
    case "projects": {
      for (const p of parsed.projects || []) {
        parsedWordCount += countWords(p.name);
        parsedWordCount += countWords(p.description);
        for (const b of p.bullets) parsedWordCount += countWords(b);
      }
      break;
    }
    case "references": {
      for (const r of parsed.references || []) {
        parsedWordCount += countWords(r.name);
        parsedWordCount += countWords(r.title);
        parsedWordCount += countWords(r.company);
        parsedWordCount += countWords(r.phone);
        parsedWordCount += countWords(r.email);
        parsedWordCount += countWords(r.relationship);
      }
      break;
    }
  }

  const ratio = originalWordCount > 0
    ? Math.min(1, parsedWordCount / originalWordCount)
    : 1;

  let status: CoverageStatus;
  if (ratio >= 0.8) status = "good";
  else if (ratio >= 0.4) status = "partial";
  else if (ratio >= 0.1) status = "poor";
  else status = "missing";

  return {
    sectionId,
    originalWordCount,
    parsedWordCount,
    ratio,
    status,
  };
}

/* ------------------------------------------------------------------ */
/*  Section confidence scoring                                        */
/* ------------------------------------------------------------------ */

type SectionQuality = {
  headerDetected: boolean;
  parsedCount: number;
  hasStructure: boolean;
  textLength: number;
};

function evaluateSection(
  sectionId: ResumeSectionId,
  sectionLines: string[],
  parsed: Partial<ResumeDocument>,
  headerDetected: boolean,
): SectionConfidence {
  if (!headerDetected) return "low";

  const nonEmptyLines = sectionLines.filter((l) => l.trim().length > 0);

  switch (sectionId) {
    case "summary": {
      const text = parsed.summary || "";
      if (text.length >= 30) return "high";
      if (text.length >= 10) return "medium";
      return "low";
    }
    case "experience": {
      const entries = parsed.experience || [];
      if (entries.length === 0) return "low";
      const wellStructured = entries.every(
        (e) => e.role && e.role !== "Unknown Role" && e.company,
      );
      if (entries.length >= 1 && wellStructured) return "high";
      return "medium";
    }
    case "education": {
      const entries = parsed.education || [];
      if (entries.length === 0) return "low";
      const wellStructured = entries.every((e) => e.degree && e.school);
      if (entries.length >= 1 && wellStructured) return "high";
      return "medium";
    }
    case "skills": {
      const skills = parsed.skills || [];
      if (skills.length >= 5) return "high";
      if (skills.length >= 1) return "medium";
      return "low";
    }
    case "certifications": {
      const certs = parsed.certifications || [];
      if (certs.length >= 2 && certs.every((c) => c.split(/\s+/).length >= 2))
        return "high";
      if (certs.length >= 1) return "medium";
      return "low";
    }
    case "professionalQualities": {
      const quals = parsed.professionalQualities || [];
      if (quals.length >= 3) return "high";
      if (quals.length >= 1) return "medium";
      return "low";
    }
    case "projects": {
      const projs = parsed.projects || [];
      if (projs.length >= 1 && projs.every((p) => p.name)) return "high";
      if (projs.length >= 1) return "medium";
      return "low";
    }
    case "references": {
      const refs = parsed.references || [];
      if (refs.length >= 1 && refs.every((r) => r.name)) return "high";
      if (refs.length >= 1) return "medium";
      if (nonEmptyLines.length >= 1) return "low";
      return "low";
    }
    default:
      return "low";
  }
}

/* ------------------------------------------------------------------ */
/*  Import quality (coverage-derived, not heuristic)                  */
/* ------------------------------------------------------------------ */

const CRITICAL_SECTIONS = new Set(["experience", "education", "skills"]);

/**
 * Derive overall import quality from per-section coverage.
 *
 * The quality reflects the worst-performing critical section, so the
 * headline never contradicts what the coverage table shows.
 *
 * Thresholds:
 *   excellent  – all critical sections ≥ 90%
 *   good       – all critical sections ≥ 80%
 *   fair       – all critical sections ≥ 50%
 *   poor       – no critical section is "missing" but some are below 50%
 *   failed     – any critical section is completely "missing" (ratio === 0)
 */
export function deriveImportQuality(coverage: SectionCoverageItem[]): ImportQuality {
  const critical = coverage.filter((c) => CRITICAL_SECTIONS.has(c.sectionId));
  if (critical.length === 0) return "fair";

  // If any critical section is completely missing, the import failed
  const anyMissing = critical.some((c) => c.ratio === 0);
  if (anyMissing) return "failed";

  // Find the minimum ratio across critical sections
  const minRatio = Math.min(...critical.map((c) => c.ratio));

  if (minRatio >= 0.9) return "excellent";
  if (minRatio >= 0.8) return "good";
  if (minRatio >= 0.5) return "fair";
  return "poor";
}

export function parseResumeText(text: string): ParseResult {
  const warnings: string[] = [];

  if (!text || text.trim().length === 0) {
    const emptyConfidence: Record<string, SectionConfidence> = {};
    for (const sid of ["summary","experience","education","skills","certifications","professionalQualities","projects","references"]) {
      emptyConfidence[sid] = "low";
    }
    return {
      parsed: {},
      confidence: 0,
      confidenceBySection: emptyConfidence,
      importQuality: "failed",
      warnings: ["No text provided"],
      unparsedContent: {},
      coverage: [],
      layouts: ["empty"],
    };
  }

  const lines = text.split("\n");

  // Filter out known non-resume boilerplate lines
  const BOILERPLATE_RE = /references?\s+(available|furnished)\s+(upon\s+)?(request)?/i;
  const PAGE_NUMBER_RE = /^-?\d+\s*-?$/;
  for (let i = 0; i < lines.length; i++) {
    if (BOILERPLATE_RE.test(lines[i].trim()) || PAGE_NUMBER_RE.test(lines[i].trim())) {
      lines[i] = "";
    }
  }

  // Detect sections
  const sections = detectSections(lines);

  // Everything before the first detected section is the preamble (contact)
  const firstSectionIndex =
    sections.size > 0
      ? Math.min(...Array.from(sections.values()).map((s) => s.start - 1))
      : lines.length;

  const preambleLines = lines
    .slice(0, Math.max(0, firstSectionIndex))
    .map((l) => l.trim())
    .filter(Boolean);

  const { contact } = extractContact(preambleLines);

  // Parse each section
  const parsed: Partial<ResumeDocument> = {
    contact: {
      fullName: contact.fullName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      location: contact.location || "",
      website: contact.website || "",
    },
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    professionalQualities: [],
    projects: [],
    references: [],
    summary: "",
  };

  // Track which section IDs were explicitly detected via headers,
  // vs sections whose content was parsed from an adjacent/ambiguous location.
  const headerDetected = new Set<ResumeSectionId>(sections.keys());

  let totalFields = 0;

  // Collect raw section lines for confidence evaluation and coverage (before mutation)
  const sectionLinesMap = new Map<string, string[]>();
  for (const [sectionId, bounds] of sections) {
    sectionLinesMap.set(sectionId, lines.slice(bounds.start, bounds.end));
  }

  // Track unparsed content per section — raw text that the structured parser could not fit.
  const unparsedContent: Record<string, string> = {};

  for (const [sectionId, bounds] of sections) {
    const sectionLines = lines.slice(bounds.start, bounds.end);

    switch (sectionId) {
      case "summary": {
        const summary = parseSummary(sectionLines);
        if (summary) {
          parsed.summary = summary;
        }
        totalFields++;
        break;
      }
      case "experience": {
        const { experience, warnings: expWarnings } = parseExperience(
          sectionLines,
        );
        if (experience.length > 0) {
          parsed.experience = experience;
        }
        // Track unparsed content: if experience was detected but parsed word
        // count is suspiciously low, store the raw lines.
        const rawText = sectionLines.join("\n").trim();
        const parsedWords = experience.reduce(
          (sum, e) => sum + e.bullets.join(" ").split(/\s+/).filter(Boolean).length,
          0,
        );
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        if (rawText && rawWords > 0 && (parsedWords < 3 || parsedWords < rawWords * 0.3)) {
          unparsedContent.experience = rawText;
        }
        warnings.push(...expWarnings);
        totalFields++;
        break;
      }
      case "education": {
        const { education, warnings: eduWarnings } = parseEducation(
          sectionLines,
        );
        if (education.length > 0) {
          parsed.education = education;
        }
        warnings.push(...eduWarnings);
        totalFields++;
        break;
      }
      case "skills": {
        const skills = parseSkills(sectionLines);
        if (skills.length > 0) {
          parsed.skills = skills;
        }
        // Track unparsed content: if raw section has lots of text but few skills parsed
        const rawText = sectionLines.join("\n").trim();
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        if (rawText && rawWords > 10 && skills.length < 3) {
          unparsedContent.skills = rawText;
        }
        totalFields++;
        break;
      }
      case "certifications": {
        const certs = sectionLines
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .map((l) => l.replace(BULLET_RE, "").trim())
          .filter(Boolean);
        if (certs.length > 0) {
          parsed.certifications = certs;
        }
        // Track unparsed content
        const rawText = sectionLines.join("\n").trim();
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        if (rawText && rawWords > 5 && certs.length === 0) {
          unparsedContent.certifications = rawText;
        }
        totalFields++;
        break;
      }
      case "professionalQualities": {
        const quals = sectionLines
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .map((l) => l.replace(BULLET_RE, "").trim())
          .filter(Boolean);
        if (quals.length > 0) {
          parsed.professionalQualities = quals;
        }
        totalFields++;
        break;
      }
      case "references": {
        const references = parseReferences(sectionLines);
        if (references.length > 0) {
          parsed.references = references;
        }
        // Track unparsed content
        const rawRefText = sectionLines.join("\n").trim();
        const rawRefWords = rawRefText.split(/\s+/).filter(Boolean).length;
        if (rawRefText && rawRefWords > 5 && references.length === 0) {
          unparsedContent.references = rawRefText;
        }
        totalFields++;
        break;
      }
      case "projects": {
        // Parse project entries: name lines followed by bullet lines
        const projects: ResumeDocument["projects"] = [];
        let currentProject: ResumeDocument["projects"][number] | null = null;
        for (const rawLine of sectionLines) {
          const l = rawLine.trim();
          if (!l) { currentProject = null; continue; }
          // Skip lines that look like OTHER section headers (not projects itself)
          if (isLikelyHeader(l) && !l.match(/^[•\-*\d.]/) && !/projects?/i.test(l)) continue;

          // Check if this is a bullet line
          if (/^[•\-*\d.]+\s/.test(l)) {
            const cleaned = l.replace(/^[•\-*\d.]+\s+/, "").trim();
            if (currentProject && cleaned) {
              currentProject.bullets.push(cleaned);
            }
          } else {
            // Non-bullet line — start a new project
            projects.push({
              id: `import-proj-${projects.length + 1}`,
              name: l,
              description: "",
              bullets: [],
            });
            currentProject = projects[projects.length - 1];
          }
        }
        parsed.projects = projects;
        // Track unparsed content when projects exist but parsed coverage is low
        const rawText = sectionLines.join("\n").trim();
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        const parsedWords = projects.reduce(
          (sum, p) => sum + p.bullets.join(" ").split(/\s+/).filter(Boolean).length,
          0,
        );
        if (rawText && rawWords > 10 && parsedWords < 3) {
          unparsedContent.projects = rawText;
        }
        totalFields++;
        break;
      }
    }
  }

  // Calculate confidence by section
  const allSectionIds: ResumeSectionId[] = [
    "summary", "experience", "education", "skills",
    "certifications", "professionalQualities", "projects", "references",
  ];

  const confidenceBySection: Record<string, SectionConfidence> = {};
  for (const sectionId of allSectionIds) {
    const rawLines = sectionLinesMap.get(sectionId) ?? [];
    confidenceBySection[sectionId] = evaluateSection(
      sectionId,
      rawLines,
      parsed,
      headerDetected.has(sectionId),
    );
  }

  // Compute per-section coverage
  const coverage: SectionCoverageItem[] = [];
  for (const sectionId of allSectionIds) {
    const rawLines = sectionLinesMap.get(sectionId) ?? [];
    coverage.push(computeSectionCoverage(sectionId, rawLines, parsed));
  }

  // Derive overall import quality from coverage (source of truth)
  const importQuality = deriveImportQuality(coverage);

  // Calculate overall confidence
  const emailFound = !!contact.email;
  const experienceCount = parsed.experience?.length ?? 0;

  let confidence = 0;
  if (emailFound && experienceCount >= 1) {
    confidence = 90;
  } else if (emailFound || experienceCount >= 1) {
    confidence = 60;
  } else if (totalFields > 0) {
    confidence = 30;
  }

  if (totalFields === 0) {
    warnings.push(
      "Could not detect standard resume sections. A blank draft will be created.",
    );
  }

  if (!contact.email) {
    warnings.push("Could not extract an email address from the text.");
  }

  if (experienceCount === 0 && warnings.length < 2) {
    warnings.push(
      "Could not detect work experience entries. Check that dates are included.",
    );
  }

  // Add coverage-based warnings
  for (const c of coverage) {
    if (c.sectionId === "references") continue; // Intentionally excluded
    if (c.originalWordCount === 0) continue; // Not detected
    if (c.status === "poor" || c.status === "missing") {
      warnings.push(
        `Low import quality for "${c.sectionId}": ${Math.round(c.ratio * 100)}% coverage (${c.parsedWordCount}/${c.originalWordCount} words preserved).`,
      );
    }
  }

  // Classify the layout for analytics
  const layouts = classifyLayout(text, sections);

  return { parsed, confidence, confidenceBySection, importQuality, warnings, unparsedContent, coverage, layouts };
}

/* ------------------------------------------------------------------ */
/*  Layout classification for analytics                                */
/* ------------------------------------------------------------------ */

/**
 * Layout signatures that distinguish resume formats.
 * Each signature is a function that scores 0–1 for how strongly the
 * input text matches a known layout pattern.
 *
 * A resume may match multiple signatures (e.g. "standard-bullets" and
 * "skills-before-experience"). The classifier returns ALL signatures
 * that score ≥ 0.5 so analytics can slice by multiple dimensions.
 */
type LayoutSignature = {
  id: string;
  label: string;
  score: (lines: string[], sections: Map<string, { start: number; end: number }>) => number;
};

const LAYOUT_SIGNATURES: LayoutSignature[] = [
  {
    // Pipe-separated 3-line entries: "Jun 2021 - Present | Role | Company"
    id: "pipe-experience",
    label: "Pipe-Separated Experience",
    score: (lines) => {
      const pipeLines = lines.filter((l) => l.trim().split("|").length >= 3);
      if (pipeLines.length === 0) return 0;
      // How many pipe-lines follow a date-range pattern?
      const datePipeLines = pipeLines.filter((l) =>
        /\b(19|20)\d{2}\b/.test(l),
      );
      if (datePipeLines.length === 0) return 0;
      return Math.min(1, datePipeLines.length / 3);
    },
  },
  {
    // Table/category format: "Category,Skill1,Skill2" or "Category|Skill1|Skill2"
    id: "table-format",
    label: "Category Table Format",
    score: (lines) => {
      const delimLines = lines.filter(
        (l) => {
          const trimmed = l.trim();
          const commaCount = (trimmed.match(/,/g) || []).length;
          const pipeCount = (trimmed.match(/\|/g) || []).length;
          return commaCount >= 2 || pipeCount >= 2;
        },
      );
      if (delimLines.length < 3) return 0;
      // Check that at least some lines start with a category-like word (not a date)
      const categoryLines = delimLines.filter(
        (l) => !/\b(19|20)\d{2}\b/.test(l) && !l.trim().match(/^-?\d+\.?\s*$/),
      );
      return Math.min(1, categoryLines.length / 4);
    },
  },
  {
    // Skills section before Experience section
    id: "skills-before-experience",
    label: "Skills Before Experience",
    score: (_lines, sections) => {
      const skillsStart = sections.get("skills")?.start;
      const expStart = sections.get("experience")?.start;
      if (skillsStart === undefined || expStart === undefined) return 0;
      return skillsStart < expStart ? 1 : 0;
    },
  },
  {
    // LinkedIn export: colon-based headers like "Skills:", "Languages:"
    id: "linkedin-export",
    label: "LinkedIn Export",
    score: (lines) => {
      const colonHeaders = lines.filter(
        (l) => /^(Skills|Languages|Certifications|Education|Experience|Summary|About)\s*:/i.test(l.trim()),
      );
      return colonHeaders.length >= 3 ? 1 : 0;
    },
  },
  {
    // Standard bullet-point experience (traditional resume)
    id: "standard-bullets",
    label: "Standard Bullet-Point Resume",
    score: (lines) => {
      const bulletLines = lines.filter((l) => /^[•\-*\d.]+\s/.test(l.trim()));
      if (bulletLines.length === 0) return 0;
      const roleLines = lines.filter((l) => /—/.test(l) || /\bat\b/i.test(l));
      return bulletLines.length >= 3 && roleLines.length >= 1 ? 1 : 0;
    },
  },
  {
    // Minimal/short resume — fewer than 30 non-empty lines and no bullet content
    id: "minimal",
    label: "Minimal Resume",
    score: (lines) => {
      const nonEmpty = lines.filter((l) => l.trim().length > 0);
      if (nonEmpty.length > 30) return 0;
      const bulletLines = nonEmpty.filter((l) => /^[•\-*\d.]+\s/.test(l.trim()));
      return bulletLines.length === 0 ? 1 : 0.3;
    },
  },
  {
    // References-heavy: a references section with named entries
    id: "references-heavy",
    label: "References-Heavy",
    score: (_lines, sections) => {
      return sections.has("references") ? 1 : 0;
    },
  },
  {
    // Certifications as bullet lines under Education (no separate cert section)
    id: "certs-under-education",
    label: "Certifications Under Education",
    score: (lines, sections) => {
      const eduBounds = sections.get("education");
      if (!eduBounds) return 0;
      if (sections.has("certifications")) return 0; // Has its own section — not this layout
      const eduLines = lines.slice(eduBounds.start, eduBounds.end);
      const certKeywords = eduLines.filter((l) =>
        /\b(certified|certification|credential|license)\b/i.test(l),
      );
      return certKeywords.length >= 1 ? 1 : 0;
    },
  },
];

/**
 * Classify the layout of an imported resume.
 *
 * Returns an array of layout identifiers that match the input text.
 * A resume can match multiple signatures (e.g. "standard-bullets" and
 * "linkedin-export").
 *
 * This is used for import analytics so the team can answer:
 * "What formats do real users upload, and which ones fail most often?"
 */
export function classifyLayout(text: string, sections: Map<string, { start: number; end: number }>): string[] {
  if (!text || text.trim().length === 0) return ["unknown"];
  const lines = text.split("\n");

  const matches: string[] = [];
  for (const sig of LAYOUT_SIGNATURES) {
    const s = sig.score(lines, sections);
    if (s >= 0.5) {
      matches.push(sig.id);
    }
  }

  // If nothing matched and the resume has structure, default to standard
  if (matches.length === 0) {
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    matches.push(nonEmpty.length > 5 ? "standard-bullets" : "minimal");
  }

  return matches;
}
