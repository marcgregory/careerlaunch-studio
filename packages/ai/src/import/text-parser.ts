import type {
  ResumeDocument,
  ResumeSectionId,
  ExperienceItem,
  EducationItem,
  LicenseItem,
} from "@careerlaunch/domain";

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
    id: "volunteer",
    patterns: [
      /\bvolunteer\s+experience\b/i,
      /\bvolunteer\s+work\b/i,
      /\bcommunity\s+service\b/i,
      /\bvolunteering\b/i,
    ],
  },
  {
    id: "education",
    patterns: [/\beducation\b/i, /\bacademic\s+(?:background|history)\b/i],
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
    id: "certifications",
    patterns: [
      /\bcertifications?\b/i,
      /\bcertificates?\b/i,
      /\bcredentials?\b/i,
    ],
  },
  {
    id: "licenses",
    patterns: [
      /\blicenses?\b/i,
      /\bprofessional\s+licenses?\b/i,
      /\bregistrations?\b/i,
      /\bprofessional\s+registrations?\b/i,
    ],
  },
  { id: "achievements", patterns: [/\bachievements?\b/i, /\brecognition\b/i] },
  {
    id: "awards",
    patterns: [/\bawards?\b/i, /\bhono?u?rs?\b/i, /\bhonors\s+and\s+awards\b/i],
  },
  { id: "languages", patterns: [/^languages?\s*$/im, /^languages?\s*:\s*$/im] },
  {
    id: "references",
    patterns: [/\breferences?\b/i, /\breferences?\s+available\b/i],
  },
  {
    id: "memberships",
    patterns: [
      /\bmemberships?\b/i,
      /\bprofessional\s+memberships?\b/i,
      /\baffiliations?\b/i,
    ],
  },
  { id: "publications", patterns: [/\bpublications?\b/i, /\bresearch\b/i] },
  {
    id: "training",
    patterns: [
      /\btraining\b/i,
      /\bprofessional\s+development\b/i,
      /\bworkshops?\b/i,
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
 *
 * Handles cases where multiple headers map to the same section ID
 * (e.g. "Experience" and "Volunteer Experience" both → experience,
 *  "Professional Qualities" and "Achievements" both → professionalQualities).
 * Same-ID headers at different positions extend the section boundary rather
 * than creating duplicate entries.
 */
function detectSections(
  lines: string[],
): Map<ResumeSectionId, { start: number; end: number }> {
  const sections = new Map<ResumeSectionId, { start: number; end: number }>();

  // Build ordered list of ALL matched headers (no seen-set dedup — let same-ID
  // headers through so "Volunteer Experience" is not blocked by "Experience").
  const headers: { index: number; id: ResumeSectionId; header: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^[•\-*]\s/.test(line)) continue;

    for (const { id, patterns } of SECTION_PATTERNS) {
      for (const pattern of patterns) {
        if (id === "experience" && /\bvolunteer\s+experience\b/i.test(line))
          continue;
        const ambiguousHeading =
          id === "awards" ||
          id === "achievements" ||
          id === "certifications" ||
          id === "licenses" ||
          id === "training";
        const wordCount = line.split(/\s+/).filter(Boolean).length;
        const hasItemSignals = /\d|\(|\)/.test(line) || wordCount > 3;
        if (
          pattern.test(line) &&
          line.length < 60 &&
          (!ambiguousHeading || !hasItemSignals)
        ) {
          headers.push({ index: i, id, header: line });
          break;
        }
      }
    }
  }

  // Sort by occurrence in text
  headers.sort((a, b) => a.index - b.index);

  // Merge adjacent same-ID headers: keep the first, skip the rest.
  // This handles "Professional Qualities" followed by "Achievements" (both
  // → professionalQualities) — we keep "Professional Qualities" as the start
  // and "Achievements" is absorbed into the same section.
  const merged: typeof headers = [];
  for (const h of headers) {
    if (merged.length > 0 && merged[merged.length - 1].id === h.id) {
      continue; // same-ID consecutive → skip
    }
    merged.push(h);
  }

  // Build sections map. If the same section ID appears again later (e.g.
  // "Experience" then "Volunteer Experience" both → experience), EXTEND the
  // existing section boundary to include the later content.
  // BUT: don't extend if doing so would overlap with another detected section
  // (e.g. "Projects" at end-of-document after "References" — extending projects
  //  would swallow the references content).
  const allHeaderIndices = new Set(merged.map((h) => h.index));

  for (let i = 0; i < merged.length; i++) {
    const nextDistinctHeader = merged
      .slice(i + 1)
      .find((h) => h.index > merged[i].index);
    const end = nextDistinctHeader ? nextDistinctHeader.index : lines.length;

    if (sections.has(merged[i].id)) {
      const existing = sections.get(merged[i].id)!;
      // Only extend if the new end does not cross another section header
      let overlapsOtherHeader = false;
      for (const hIdx of allHeaderIndices) {
        if (hIdx > existing.end && hIdx < end) {
          overlapsOtherHeader = true;
          break;
        }
      }
      if (!overlapsOtherHeader) {
        sections.set(merged[i].id, {
          start: existing.start,
          end: Math.max(existing.end, end),
        });
      }
    } else {
      sections.set(merged[i].id, {
        start: merged[i].index + 1,
        end,
      });
    }
  }

  return sections;
}

/* ------------------------------------------------------------------ */
/*  Contact extraction                                                 */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+(?:\/?)/;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9._-]+\/?/i;
/** Match domains that look like personal/professional websites or portfolio
 *  links. Uses \b at the start to prevent partial matches of email domains
 *  (e.g. prevents "ail.com" from matching inside "johndoe@gmail.com").
 *  Explicitly excludes common email provider domains, LinkedIn, GitHub, and standalone
 *  email TLD-like fragments. */
const WEBSITE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?!linkedin)(?!github)(?![\w.-]*@)(?!(?:gmail|yahoo|outlook|hotmail|protonmail|icloud|aol|zoho|yandex|mail)\.[a-zA-Z]{2,})[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i;

function extractContact(preambleLines: string[]): {
  contact: Partial<ResumeDocument["contact"]>;
  used: number;
} {
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

    // Route LinkedIn URL to contact.linkedin
    const linkedInMatch = line.match(LINKEDIN_RE);
    if (linkedInMatch && !contact.linkedin) {
      contact.linkedin = linkedInMatch[0];
      continue;
    }

    // Route GitHub URL to contact.github
    const githubMatch = line.match(GITHUB_RE);
    if (githubMatch && !contact.github) {
      contact.github = githubMatch[0];
      continue;
    }

    // General website (only on lines that did NOT match an email address,
    // to prevent partial domain matches like "ail.com" from "johndoe@gmail.com")
    if (!contact.website && !emailMatch) {
      const webMatch = line.match(WEBSITE_RE);
      if (webMatch) {
        contact.website = webMatch[0];
      }
    }

    // Location: line that contains city/state or city/country pattern
    // but no email/phone/URL
    if (
      !contact.location &&
      !emailMatch &&
      !phoneMatch &&
      !linkedInMatch &&
      !line.match(GITHUB_RE) &&
      /^[A-Za-z][A-Za-z\s.-]+,\s*[A-Za-z\s.]{2,}$/.test(line.trim())
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
  /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})\s*\d{0,4})\s*(?:-+|–|—|to)\s*(\w+(?:\s+\d{4})?|\d{4}|present|current|now)/i;
const YEAR_RANGE_RE = /(\d{4})\s*(?:-+|–|—|to)\s*(\d{4}|present|current|now)/i;
const BULLET_RE = /^(?:[•●▪◦*\-]|\d+[.)])\s*/;
function expandInlineBulletLines(lines: string[]): string[] {
  const expanded: string[] = [];
  const inlineBulletRe = /(?=[•●▪◦]\s*)/g;

  for (const line of lines) {
    const trimmed = line.trim();
    const markerCount = (trimmed.match(/[•●▪◦]/g) || []).length;
    if (markerCount > 1) {
      const pieces = trimmed
        .split(inlineBulletRe)
        .map((piece) => piece.trim())
        .filter(Boolean);
      expanded.push(...pieces);
    } else {
      expanded.push(line);
    }
  }

  return expanded;
}
function parseExperience(lines: string[]): {
  experience: ResumeDocument["experience"];
  warnings: string[];
} {
  lines = expandInlineBulletLines(lines);
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
      //   Software Developer            <- role
      //   Volenday Philippines Inc.     <- company
      //   Feb 2023 – May 2025           <- date-only line (was being used as role!)
      const isDateOnly = withoutDate.length === 0;

      if (isDateOnly) {
        // Scan backward from i-1 to find up to 2 non-empty, non-date lines
        // that are NOT section headers
        const lookbehind: string[] = [];
        let j = i - 1;
        while (j >= 0 && lookbehind.length < 2) {
          const prev = lines[j].trim();
          if (
            prev &&
            !isLikelyHeader(prev) &&
            !prev.match(DATE_RANGE_RE) &&
            !prev.match(YEAR_RANGE_RE)
          ) {
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
        role =
          role.replace(DATE_RANGE_RE, "").replace(YEAR_RANGE_RE, "").trim() ||
          "Unknown Role";

        const [start, end] =
          dateMatch[1] && dateMatch[2]
            ? [dateMatch[1].trim(), dateMatch[2].trim()]
            : ["", ""];

        // Collect bullets — accept lines with or without bullet markers,
        // but stop when we detect the start of the next entry.
        i++;
        const bullets: string[] = [];
        let bulletCount = 0;
        while (i < lines.length) {
          const bline = lines[i].trim();
          if (!bline) {
            i++;
            continue;
          }
          if (lines[i].match(DATE_RANGE_RE) || lines[i].match(YEAR_RANGE_RE))
            break;
          if (isLikelyHeader(lines[i])) break;

          const hasMarker = BULLET_RE.test(bline);
          const cleaned = bline.replace(BULLET_RE, "").trim();
          if (!cleaned) {
            i++;
            continue;
          }

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
              if (
                peekLine.match(DATE_RANGE_RE) ||
                peekLine.match(YEAR_RANGE_RE)
              ) {
                nextHasDate = true;
                break;
              }
            }
            // Also check if this line itself looks like a role/company entry
            // (short line without being a continuation phrase)
            const isNextEntry =
              cleaned.length < 80 && !startsWithArticle(cleaned) && nextHasDate;
            if (nextHasDate && isNextEntry) break;
            // Otherwise treat it as a continuation of the last bullet
            bullets[bullets.length - 1] += " " + cleaned;
            bulletCount++;
            i++;
          } else {
            // No bullets collected yet — this is likely the start of the next entry
            // BUT: if the line looks like bullet prose (long, no date peek-ahead),
            // treat it as the first unmarked bullet instead of breaking.
            let nextHasDate = false;
            const peekLimit = Math.min(i + 3, lines.length - 1);
            for (let look = 1; look <= peekLimit - i; look++) {
              const peekLine = lines[i + look].trim();
              if (
                peekLine.match(DATE_RANGE_RE) ||
                peekLine.match(YEAR_RANGE_RE)
              ) {
                nextHasDate = true;
                break;
              }
            }
            if (!nextHasDate && cleaned.length >= 30) {
              // Long unmarked prose line that doesn't precede a date → treat as bullet
              bullets.push(cleaned);
              bulletCount++;
              i++;
            } else {
              break;
            }
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
          company = companyParts
            .join(" | ")
            .replace(/\|\s*$/, "")
            .trim();
        } else {
          const dashSplit = withoutDate.split(/\s+[-–]\s+/);
          if (dashSplit.length >= 2) {
            company = dashSplit[0].trim();
            role = dashSplit.slice(1).join(" - ").trim();
          }
        }
      }

      const [start, end] =
        dateMatch[1] && dateMatch[2]
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
        if (!cleaned) {
          i++;
          continue;
        }

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
            if (
              peekLine.match(DATE_RANGE_RE) ||
              peekLine.match(YEAR_RANGE_RE)
            ) {
              nextHasDate = true;
              break;
            }
          }
          const isNextEntry =
            cleaned.length < 80 && !startsWithArticle(cleaned) && nextHasDate;
          if (nextHasDate && isNextEntry) break;
          bullets[bullets.length - 1] += " " + cleaned;
        } else {
          // No bullets collected yet — check if this looks like unmarked bullet prose
          let nextHasDate = false;
          const peekLimit = Math.min(i + 3, lines.length - 1);
          for (let look = 1; look <= peekLimit - i; look++) {
            const peekLine = lines[i + look].trim();
            if (
              peekLine.match(DATE_RANGE_RE) ||
              peekLine.match(YEAR_RANGE_RE)
            ) {
              nextHasDate = true;
              break;
            }
          }
          if (!nextHasDate && cleaned.length >= 30) {
            bullets.push(cleaned);
          } else {
            break;
          }
        }
        i++;
      }

      // Deduplicate: if role ends with company text, strip company from role
      const cleanRole =
        company && role.toLowerCase().endsWith(company.toLowerCase())
          ? role
              .slice(0, -company.length)
              .replace(/[-–|]\s*$/, "")
              .trim()
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
    warnings.push(
      "Could not detect any work experience entries. Check the format.",
    );
  }

  return { experience, warnings };
}

function atSlice(atSplit: string[], dateMatch: RegExpMatchArray): string {
  const parts = atSplit.slice(1);
  const joined = parts.join(" at ");
  return joined
    .replace(dateMatch[0], "")
    .replace(/[-–]\s*$/, "")
    .trim();
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
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const trimmed = lines[i].trim();
    if (!trimmed || BULLET_RE.test(trimmed)) continue;

    if (
      /\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Doctorate|MBA|MD|JD|Bootcamp|Immersive|Apprenticeship)\b/i.test(
        trimmed,
      )
    ) {
      // --- Step 1: extract graduation year and school from this line ---
      let gradYear = extractGraduationYear(trimmed);
      let school = extractSchoolV2(trimmed);
      let degree = extractDegree(trimmed, school);

      // --- Step 2: look at next line for school/graduation info ---
      if (i + 1 < lines.length) {
        // Peek past blank lines to find the next meaningful non-empty line
        let nextIdx = i + 1;
        while (nextIdx < lines.length && lines[nextIdx].trim().length === 0) {
          nextIdx++;
        }
        const nextLine = nextIdx < lines.length ? lines[nextIdx].trim() : "";
        // If the next line is ALSO a degree line (duplicate in source text),
        // skip this entry — the dup will be handled by the duplicate line itself.
        if (
          nextLine &&
          !BULLET_RE.test(nextLine) &&
          /\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Doctorate|MBA|MD|JD|Bootcamp|Immersive|Apprenticeship)\b/i.test(
            nextLine,
          )
        ) {
          consumed.add(i);
          // Only consume blank lines between the duplicates, not the duplicate itself
          for (let k = i + 1; k < nextIdx && k < lines.length; k++)
            consumed.add(k);
          continue;
        }

        if (nextLine && !BULLET_RE.test(nextLine)) {
          // The next line looks like a school or additional context
          const nextSchool = extractSchoolV2(nextLine);
          const nextGrad = extractGraduationYear(nextLine);

          // If the next line has a school keyword, use it as the school name
          const hasSchoolKeyword =
            /\b(?:University|College|Institute|School|Academy|Polytechnic)\b/i.test(
              nextLine,
            );
          if (hasSchoolKeyword) {
            school = nextSchool;
            // Update gradYear from the school line if present
            if (nextGrad) {
              gradYear = nextGrad;
              // Also clean degree if year was embedded there
              degree = degree
                .replace(new RegExp(`,?\\s*${nextGrad}`), "")
                .trim();
            }
          } else if (nextGrad && !gradYear) {
            // School line has a year but no school keyword — save it
            gradYear = nextGrad;
          } else if (nextSchool && !school) {
            // Fallback: next line looks like a school name (e.g. bootcamp)
            // even without traditional school keywords
            school = nextSchool;
          }

          // Consume the next meaningful line AND any blank lines between it and i
          if (nextIdx > i) {
            for (let k = i + 1; k <= nextIdx && k < lines.length; k++) {
              consumed.add(k);
            }
          }

          // --- Step 2b: check the line after the school line for graduation year ---
          // "University of Texas" then "2016" on its own line
          const thirdIdx = nextIdx + 1;
          if (thirdIdx < lines.length) {
            const thirdLine = lines[thirdIdx].trim();
            if (thirdLine && !consumed.has(thirdIdx)) {
              const thirdGrad = extractGraduationYear(thirdLine);
              if (
                thirdGrad &&
                !gradYear &&
                thirdLine.split(/\s+/).filter(Boolean).length <= 2
              ) {
                gradYear = thirdGrad;
                consumed.add(thirdIdx);
              }
            }
          }
        }
      }
      // Strip graduation year from school if it leaked in
      if (gradYear) {
        if (school.endsWith(`, ${gradYear}`)) {
          school = school.slice(0, -`, ${gradYear}`.length).trim();
        } else if (school.endsWith(` ${gradYear}`)) {
          school = school.slice(0, -` ${gradYear}`.length).trim();
        }
      }
      degree = degree.replace(/[-–,]\s*$/, "").trim();

      const structuralParts = trimmed.includes("|")
        ? trimmed
            .split(/\s*\|\s*/)
            .map((part) => part.trim())
            .filter(Boolean)
        : [];
      if (structuralParts.length >= 2) {
        degree = structuralParts[0]
          .replace(/\(?\b(?:19|20)\d{2}\b\)?/g, "")
          .trim();
        const schoolText = structuralParts.slice(1).join(" - ");
        const structuralGrad = extractGraduationYear(schoolText);
        school = schoolText
          .replace(/\(?\b(?:19|20)\d{2}\b\)?/g, "")
          .replace(new RegExp("[,-]\\s*" + String.fromCharCode(36)), "")
          .trim();
        if (structuralGrad && gradYear === "") gradYear = structuralGrad;
      }

      // --- Step 4: special handling for single-line hyphen format ---
      // "Degree - School, Year" => Degree and School are separated by " - "
      // Check the ORIGINAL degree text (trimmed) for hyphen splits, because
      // extractSchoolV2 may have captured prefix context including the hyphen.
      const splitCandidate = degree.includes(" - ") ? degree : trimmed;
      if (splitCandidate.includes(" - ")) {
        const parts = splitCandidate.split(/\s+[-–]\s+/);
        if (parts.length >= 2) {
          degree = parts[0].trim();
          const combinedSchool = parts.slice(1).join(" - ").trim();
          const yr = extractGraduationYear(combinedSchool);
          if (yr) {
            school = combinedSchool
              .replace(new RegExp(`,?\\s*${yr}`), "")
              .trim();
            // Only update gradYear if it wasn't already set from the next line
            if (!gradYear) gradYear = yr;
          } else {
            school = combinedSchool;
          }
        }
      }

      const extras = extractEducationExtras(
        lines,
        i,
        Math.min(lines.length, i + 5),
      );
      education.push({
        id: "import-edu-" + (education.length + 1),
        school: school || trimmed,
        degree: degree || trimmed,
        location: "",
        graduation: gradYear || "",
        gpa: extras.gpa,
        honors: extras.honors,
      });
    }
  }

  if (education.length === 0) {
    warnings.push("Could not detect education entries.");
  }

  return { education, warnings };
}

/** Extract a 4-digit graduation year from text, returning the matched text or empty string */
function extractGraduationYear(text: string): string {
  const match = text.match(/\b((?:19|20)\d{2})\b/);
  return match ? match[1].trim() : "";
}

/**
 * Extract school/institution name from text.
 *
 * Strategy:
 * 1. If a known school keyword (University, College, etc.) is found,
 *    extract from keyword forward up to 3 comma/dash-delimited tokens.
 * 2. If no keyword found, return empty string (let the caller fall back).
 */
function extractSchoolV2(text: string): string {
  const keywords = [
    "University",
    "College",
    "Institute",
    "School",
    "Academy",
    "Polytechnic",
  ];
  // Also check for bootcamp/institution keywords that aren't traditional school terms
  const otherKeywords = ["Hack", "General Assembly", "Flatiron"];
  for (const keyword of otherKeywords) {
    const index = text.search(new RegExp(`\\b${keyword}\\b`, "i"));
    if (index >= 0) {
      const before = text.slice(0, index).trim();
      const beforeWords = before.split(/\s+/).filter(Boolean);
      const prefix = beforeWords.slice(-2).join(" ");
      // Capture from keyword forward: up to 2 additional words
      const rest = text.slice(index);
      const colonIdx = rest.indexOf(":");
      const effective = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
      const suffixMatch = effective.match(/^[^,-]+(?:[,-][^,-]+){0,1}/);
      const suffix = suffixMatch ? suffixMatch[0].trim() : "";
      const result = (prefix ? prefix + " " + suffix : suffix).trim();
      if (result.length >= 3) return result;
    }
  }

  for (const keyword of keywords) {
    const index = text.search(new RegExp(`\\b${keyword}\\b`, "i"));
    if (index >= 0) {
      // Capture up to 3 words before the keyword, then the keyword and its
      // comma/dash-delimited suffixes. Handles "San Jose State University" (3
      // words before keyword), "Texas State University" (2 words), and
      // "University of Washington, 2016" (keyword-first) alike.
      const before = text.slice(0, index).trim();
      const beforeWords = before.split(/\s+/).filter(Boolean);
      const prefix = beforeWords.slice(-3).join(" ");
      // Capture from keyword forward: up to 3 comma/dash segments or end
      const rest = text.slice(index);
      const colonIdx = rest.indexOf(":");
      const effective = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
      const suffixMatch = effective.match(/^[^,-]+(?:[,-][^,-]+){0,2}/);
      const suffix = suffixMatch ? suffixMatch[0].trim() : "";
      return (prefix ? prefix + " " + suffix : suffix).trim();
    }
  }
  return "";
}

/**
 * Extract degree name from a degree line, removing school and graduation year.
 */
function extractDegree(text: string, school: string): string {
  let degree = text;
  // Remove graduation year
  const yr = extractGraduationYear(text);
  if (yr) {
    degree = degree.replace(new RegExp(`,?\\s*${yr}`), "").trim();
  }
  // Remove school if found embedded.
  // Strip year from school first so it matches post-year-removal degree text.
  const cleanSchool = school.replace(new RegExp(`,?\\s*${yr}`), "").trim();
  if (cleanSchool && cleanSchool.length > 3) {
    const schoolIdx = degree.indexOf(cleanSchool);
    if (schoolIdx > 0) {
      degree = degree
        .slice(0, schoolIdx)
        .replace(/[-–,]\s*$/, "")
        .trim();
    }
  }
  return degree;
}

/* ------------------------------------------------------------------ */
/*  Skills parsing                                                     */
/* ------------------------------------------------------------------ */

function parseSkills(lines: string[]): string[] {
  const skills: string[] = [];
  let currentCategory = "";

  const pushSkill = (skill: string, category = currentCategory) => {
    const value = skill.trim();
    if (!value || value.length <= 1 || value.length >= 80) return;
    skills.push(category ? `${category}: ${value}` : value);
  };

  const categoryLineRe = /^([A-Za-z][A-Za-z0-9 /&+.#-]{1,40})\s{2,}(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const deBulleted = trimmed.replace(BULLET_RE, "").trim();
    const useLine = deBulleted || trimmed;

    const categoryMatch = useLine.match(categoryLineRe);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      for (const item of splitSkillItems(categoryMatch[2]))
        pushSkill(item, currentCategory);
      continue;
    }

    const colonMatch = useLine.match(
      /^([A-Za-z][A-Za-z0-9 /&+.#-]{1,40})\s*:\s*(.+)$/,
    );
    if (colonMatch) {
      currentCategory = colonMatch[1].trim();
      for (const item of splitSkillItems(colonMatch[2]))
        pushSkill(item, currentCategory);
      continue;
    }

    const categoryPrefixMatch = useLine.match(
      /^(Cloud\s*\/\s*Infra(?:\s*\/\s*Tools)?|IT\s*\/\s*Hardware|Coding with AI|Soft Skills?|Technical Skills?|Project Management|Frontend|Backend|DevOps|Database|Testing(?: Tools)?|Tools|Languages?|Frameworks?|Libraries|LLM|Automation|Design|Marketing|Accounting|Finance|Clinical|Leadership|Management)\s+(.+)$/i,
    );
    if (categoryPrefixMatch) {
      currentCategory = categoryPrefixMatch[1].trim();
      for (const item of splitSkillItems(categoryPrefixMatch[2]))
        pushSkill(item, currentCategory);
      continue;
    }

    if (
      useLine.includes(",") ||
      useLine.includes("|") ||
      /[•●▪◦;]/.test(useLine)
    ) {
      for (const item of splitSkillItems(useLine))
        pushSkill(item, currentCategory);
    } else {
      pushSkill(useLine, currentCategory);
    }
  }

  return [...new Set(skills)];
}

function splitSkillItems(value: string): string[] {
  return value
    .split(/[,|;•●▪◦]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function isDividerLine(line: string): boolean {
  return /^[_\-=]{4,}$/.test(line.trim());
}

function looksLikeEducationContentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\(?\d{4}\)?$/.test(trimmed)) return true;
  if (
    /\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Doctorate|MBA|MD|JD|Bootcamp|Immersive|Apprenticeship)\b/i.test(
      trimmed,
    )
  )
    return true;
  if (
    /\b(?:University|College|Institute|School|Academy|Polytechnic)\b/i.test(
      trimmed,
    )
  )
    return true;
  return false;
}
function parseStringList(
  lines: string[],
  options?: { splitDash?: boolean },
): string[] {
  const items: string[] = [];
  for (const raw of lines) {
    const line = raw.trim().replace(BULLET_RE, "").trim();
    if (!line || isDividerLine(line)) continue;
    const pieces = options?.splitDash
      ? line.split(/\s*[–—]\s*/)
      : line.split(/[,;•|]\s*/);
    for (const piece of pieces) {
      const item = piece.trim();
      if (item && item.length > 1) items.push(item);
    }
  }
  return [...new Set(items)];
}

const LICENSE_NUMBER_LABEL_RE =
  /^\s*(?:license\b|lic(?:\.|\b)|registration\b|reg(?:\.|\b)|bar\b)\s*(?:number|no\.?|#)?\s*[:#.]?\s*(.+)$/i;
const EXPIRATION_LABEL_RE =
  /^\s*(?:expires?|expiration|valid\s+through|through)\s*[:#-]?\s*(.+)$/i;
const AUTHORITY_LABEL_RE =
  /^\s*(?:issued\s+by|issuer|issuing\s+authority|authority)\s*[:#-]?\s*(.+)$/i;
const LICENSE_SEPARATOR_RE = /\s*(?:\||–|—)\s*/;

function extractLicenseNumber(line: string): string {
  const match = line.match(LICENSE_NUMBER_LABEL_RE);
  return match ? match[1].trim() : "";
}

function extractExpiration(line: string): string {
  const match = line.match(EXPIRATION_LABEL_RE);
  return match ? match[1].trim() : "";
}

function extractAuthority(line: string): string {
  const match = line.match(AUTHORITY_LABEL_RE);
  return match ? match[1].trim() : "";
}

function looksLikeLicenseLine(line: string): boolean {
  const cleaned = line.trim();
  if (!cleaned) return false;
  if (
    LICENSE_NUMBER_LABEL_RE.test(cleaned) ||
    EXPIRATION_LABEL_RE.test(cleaned) ||
    AUTHORITY_LABEL_RE.test(cleaned)
  )
    return true;
  if (
    /\b(?:licensed|registered|registration|credential|bar)\b/i.test(cleaned) &&
    LICENSE_SEPARATOR_RE.test(cleaned)
  )
    return true;
  if (cleaned.split("|").length >= 3) return true;
  return false;
}

function looksLikeLicenseIdentifier(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^(?:[A-Z]{1,5}[-.]?)?\d{3,}[A-Z0-9.-]*$/i.test(trimmed) ||
    /^[A-Z]{2,}\d{3,}[A-Z0-9.-]*$/i.test(trimmed)
  );
}

function splitLicenseAndCertificationLines(lines: string[]): {
  licenseLines: string[];
  certLines: string[];
} {
  const cleaned = lines
    .map((line) => line.trim().replace(BULLET_RE, "").trim())
    .filter((line) => line && !/^(?:certifications?|licenses?)$/i.test(line));

  const licenseIndexes = new Set<number>();

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    const next = cleaned[i + 1] ?? "";
    const following = cleaned[i + 2] ?? "";

    if (looksLikeLicenseLine(line)) {
      licenseIndexes.add(i);
      if (LICENSE_NUMBER_LABEL_RE.test(line) && i > 0)
        licenseIndexes.add(i - 1);
      continue;
    }

    if (LICENSE_NUMBER_LABEL_RE.test(next)) {
      licenseIndexes.add(i);
      licenseIndexes.add(i + 1);
      continue;
    }

    if (next && LICENSE_NUMBER_LABEL_RE.test(following)) {
      licenseIndexes.add(i);
      licenseIndexes.add(i + 1);
      licenseIndexes.add(i + 2);
    }
  }

  return {
    licenseLines: cleaned.filter((_, index) => licenseIndexes.has(index)),
    certLines: cleaned.filter((_, index) => !licenseIndexes.has(index)),
  };
}

function parseLicenses(lines: string[]): LicenseItem[] {
  const licenses: LicenseItem[] = [];
  const cleaned = lines
    .map((line) => line.trim().replace(BULLET_RE, "").trim())
    .filter((line) => line && !/^(?:certifications?|licenses?)$/i.test(line));

  let current: LicenseItem | null = null;

  const emptyLicense = (): LicenseItem => ({
    id: "",
    name: "",
    issuingAuthority: "",
    licenseNumber: "",
    expirationDate: "",
  });
  const pushCurrent = () => {
    if (current && current.name.trim()) {
      licenses.push({
        ...current,
        id: "import-license-" + (licenses.length + 1),
      });
    }
    current = null;
  };

  for (const line of cleaned) {
    const labeledNumber = extractLicenseNumber(line);
    const labeledExpiration = extractExpiration(line);
    const labeledAuthority = extractAuthority(line);

    if (labeledNumber) {
      current ??= emptyLicense();
      if (!current.licenseNumber) current.licenseNumber = labeledNumber;
      continue;
    }

    if (labeledExpiration) {
      current ??= emptyLicense();
      if (!current.expirationDate) current.expirationDate = labeledExpiration;
      continue;
    }

    if (labeledAuthority) {
      current ??= emptyLicense();
      if (!current.issuingAuthority)
        current.issuingAuthority = labeledAuthority;
      continue;
    }

    const parts = line
      .split(LICENSE_SEPARATOR_RE)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      pushCurrent();
      current = emptyLicense();
      current.name = parts[0];
      current.issuingAuthority = parts[1] ?? "";

      for (const part of parts.slice(2)) {
        const partNumber = extractLicenseNumber(part);
        if (partNumber && !current.licenseNumber) {
          current.licenseNumber = partNumber;
        } else if (!current.licenseNumber && looksLikeLicenseIdentifier(part)) {
          current.licenseNumber = part;
        } else if (!current.issuingAuthority) {
          current.issuingAuthority = part;
        }
      }
      continue;
    }

    if (!current) {
      current = emptyLicense();
      current.name = line;
      continue;
    }

    if (!current.name) {
      current.name = line;
    } else if (!current.issuingAuthority) {
      current.issuingAuthority = line;
    } else {
      pushCurrent();
      current = emptyLicense();
      current.name = line;
    }
  }

  pushCurrent();
  return licenses;
}
function parseProjects(lines: string[]): ResumeDocument["projects"] {
  const projects: ResumeDocument["projects"] = [];
  let currentProject: ResumeDocument["projects"][number] | null = null;
  let expectDescription = false;

  for (const rawLine of lines) {
    const l = rawLine.trim();
    if (!l) continue;
    if (isLikelyHeader(l) && !l.match(/^[•\-*\d.]/) && !/projects?/i.test(l))
      continue;

    const cleaned = l.replace(BULLET_RE, "").trim();
    const technologyMatch = cleaned.match(
      /^(?:technologies|technology|tech\s+stack|tools)\s*:\s*(.+)$/i,
    );
    if (technologyMatch && currentProject) {
      currentProject.technologies = parseStringList([technologyMatch[1]]);
      expectDescription = false;
      continue;
    }

    if (BULLET_RE.test(l)) {
      if (currentProject && cleaned) currentProject.bullets.push(cleaned);
      expectDescription = false;
    } else if (
      currentProject &&
      expectDescription &&
      currentProject.description === ""
    ) {
      if (cleaned.length < 200 && cleaned.split(/\s+/).length < 40)
        currentProject.description = cleaned;
      else currentProject.bullets.push(cleaned);
      expectDescription = false;
    } else {
      projects.push({
        id: "import-proj-" + (projects.length + 1),
        name: cleaned,
        description: "",
        technologies: [],
        bullets: [],
      });
      currentProject = projects[projects.length - 1];
      expectDescription = true;
    }
  }

  return projects;
}

function extractEducationExtras(
  lines: string[],
  start: number,
  end: number,
): { gpa: string; honors: string[] } {
  const windowText = lines.slice(start, Math.min(lines.length, end)).join(" ");
  const gpaMatch = windowText.match(
    /\bGPA\s*[:]?\s*([0-4](?:\.\d{1,2})?(?:\s*\/\s*4(?:\.0)?)?)/i,
  );
  const honors = parseStringList(
    lines.slice(start, Math.min(lines.length, end)),
  ).filter((item) =>
    /\b(?:honou?rs?|cum\s+laude|magna|summa|dean'?s\s+list|distinction)\b/i.test(
      item,
    ),
  );
  return { gpa: gpaMatch ? gpaMatch[1].trim() : "", honors };
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
function groupReferenceLines(lines: string[]): string[] {
  const cleaned = lines
    .map((line) => line.trim().replace(BULLET_RE, "").trim())
    .filter(
      (line) =>
        line && !/^references?\s*(available\s+upon\s+request)?$/i.test(line),
    );
  const grouped: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    const next = cleaned[i + 1] || "";
    const third = cleaned[i + 2] || "";
    const lineHasContact = EMAIL_RE.test(line) || PHONE_RE.test(line);
    const nextHasContact = EMAIL_RE.test(next) || PHONE_RE.test(next);
    const thirdHasContact = EMAIL_RE.test(third) || PHONE_RE.test(third);

    if (
      !lineHasContact &&
      next &&
      nextHasContact &&
      third &&
      !thirdHasContact
    ) {
      grouped.push([line, third, next].join(" | "));
      i += 2;
      continue;
    }

    if (
      !lineHasContact &&
      next &&
      !nextHasContact &&
      third &&
      thirdHasContact
    ) {
      grouped.push([line, next, third].join(" | "));
      i += 2;
      continue;
    }

    grouped.push(line);
  }
  return grouped;
}
function parseReferences(lines: string[]): ResumeDocument["references"] {
  const references: ResumeDocument["references"] = [];

  for (const rawLine of groupReferenceLines(lines)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Skip lines that look like section headers
    if (/^references?\s*(available\s+upon\s+request)?$/i.test(trimmed))
      continue;
    if (trimmed.length > 150) continue;

    const deBulleted = trimmed.replace(BULLET_RE, "").trim();
    const line = deBulleted || trimmed;

    // Try splitting by pipe first (most structured format)
    // "Name | Position, Company | Phone"
    const pipeParts = line
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pipeParts.length >= 2) {
      const ref = refFromParts(pipeParts);
      if (ref) references.push(ref);
      continue;
    }

    // Try splitting by dash with spaces (Name - Title - Company - Phone)
    const dashParts = line
      .split(/\s+[-–]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
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
    const commaParts = line
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (commaParts.length >= 3) {
      const ref = refFromParts(commaParts);
      if (ref) references.push(ref);
      continue;
    }

    // Last resort: just use the whole line as the name
    if (line.length >= 3) {
      references.push({
        id: "import-ref-0",
        name: line,
        title: "",
        company: "",
        phone: "",
        email: "",
        relationship: "",
      });
    }
  }

  references.forEach((reference, index) => {
    reference.id = "import-ref-" + (index + 1);
  });
  return references;
}

/**
 * Map an array of string parts from a parsed reference line into a ReferenceItem.
 * Heuristic: first part is name, last part is typically phone or email.
 * Parts in between are title/company.
 */
function refFromParts(
  parts: string[],
): ResumeDocument["references"][number] | null {
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

    const embeddedEmail = part.match(EMAIL_RE);
    const embeddedPhone = part.match(PHONE_RE);
    if (embeddedEmail || embeddedPhone) {
      if (embeddedEmail && !email) email = embeddedEmail[0];
      if (embeddedPhone && !phone) phone = embeddedPhone[0];
      continue;
    }

    // Email detection
    if (/^[\w.%-]+@[\w.-]+\.[a-z]{2,}$/i.test(part)) {
      if (!email) email = part;
      continue;
    }

    // Phone detection (digits, dashes, dots, parentheses, leading +)
    if (
      /^[\+]?[\d\s\-\(\)\.]{6,20}$/.test(
        part.replace(/[ext\s.]*\d*$/i, "").trim(),
      )
    ) {
      if (!phone) phone = part;
      continue;
    }

    // Looks like a company with common suffixes
    if (
      /\b(?:Corp|Inc|LLC|Ltd|Company|Organization|Dept|Department|University|College|School)\b/i.test(
        part,
      )
    ) {
      company = company ? `${company}, ${part}` : part;
      continue;
    }

    // Looks like a job title (starts with preposition or common title prefix)
    if (
      /^(?:Professor|Dr|Engineer|Nurse|Manager|Director|Supervisor|Specialist|Coordinator|Analyst|Consultant|Officer|Head|Lead|Senior|Junior|Associate|HR|President|CEO|CFO|COO|CTO|VP|VP\s+of|AVP|AVP\s+of)\b/i.test(
        part,
      )
    ) {
      const titleParts = part
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (titleParts.length >= 2) {
        title = title ? title + ", " + titleParts[0] : titleParts[0];
        company = company
          ? company + ", " + titleParts.slice(1).join(", ")
          : titleParts.slice(1).join(", ");
      } else {
        title = title ? title + ", " + part : part;
      }
      continue;
    }
    // Relationship markers
    if (
      /\b(?:colleague|coworker|supervisor|manager|mentor|professor|teacher|client|partner|friend|former)\b/i.test(
        part,
      )
    ) {
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
    id: "import-ref-0",
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
  return /^(?:with|and|through|using|by|for|in|on|at|to|the|a|an|of|its|their|his|her|our|enabling|ensuring|focusing|leveraging|including|providing|while|during|across|within|after|before|under|over|between|throughout|following|resulting)\b/i.test(
    text.trim(),
  );
}

function normalizeDate(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "present" || lower === "current" || lower === "now") {
    return "Present";
  }
  // Normalize month names
  const months: Record<string, string> = {
    jan: "Jan",
    january: "Jan",
    feb: "Feb",
    february: "Feb",
    mar: "Mar",
    march: "Mar",
    apr: "Apr",
    april: "Apr",
    may: "May",
    jun: "Jun",
    june: "Jun",
    jul: "Jul",
    july: "Jul",
    aug: "Aug",
    august: "Aug",
    sep: "Sep",
    september: "Sep",
    oct: "Oct",
    october: "Oct",
    nov: "Nov",
    november: "Nov",
    dec: "Dec",
    december: "Dec",
  };

  for (const [key, val] of Object.entries(months)) {
    if (lower.startsWith(key)) {
      return value.replace(new RegExp(key, "i"), val);
    }
  }

  return value;
}

function repairMojibake(value: string): string {
  return value
    .replaceAll("\u00e2\u20ac\u201d", "\u2014")
    .replaceAll("\u00e2\u20ac\u0153", "\u2013")
    .replaceAll("\u00e2\u20ac\u00a2", "\u2022")
    .replaceAll("\u00c2\u00b7", "\u00b7")
    .replaceAll("\u00c3\u201a\u00c2\u00b7", "\u00b7")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d", "\u2014")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153", "\u2013")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2", "\u2022")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2", "\u2019");
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
    case "summary":
      parsedWordCount = countWords(parsed.summary || "");
      break;
    case "experience":
      for (const exp of parsed.experience || []) {
        parsedWordCount +=
          countWords(exp.role) +
          countWords(exp.company) +
          countWords(exp.location);
        for (const b of exp.bullets) parsedWordCount += countWords(b);
      }
      break;
    case "volunteer":
      for (const exp of parsed.volunteer || []) {
        parsedWordCount +=
          countWords(exp.role) +
          countWords(exp.company) +
          countWords(exp.location);
        for (const b of exp.bullets) parsedWordCount += countWords(b);
      }
      break;
    case "education":
      for (const edu of parsed.education || []) {
        parsedWordCount +=
          countWords(edu.degree) +
          countWords(edu.school) +
          countWords(edu.location) +
          countWords(edu.graduation) +
          countWords(edu.gpa ?? "");
        for (const h of edu.honors ?? []) parsedWordCount += countWords(h);
      }
      break;
    case "skills":
      for (const s of parsed.skills || []) parsedWordCount += countWords(s);
      break;
    case "projects":
      for (const p of parsed.projects || []) {
        parsedWordCount += countWords(p.name) + countWords(p.description);
        for (const t of p.technologies ?? []) parsedWordCount += countWords(t);
        for (const b of p.bullets) parsedWordCount += countWords(b);
      }
      break;
    case "certifications":
      for (const c of parsed.certifications || [])
        parsedWordCount += countWords(c);
      break;
    case "licenses":
      for (const l of parsed.licenses || []) {
        parsedWordCount +=
          countWords(l.name) +
          countWords(l.issuingAuthority) +
          countWords(l.licenseNumber) +
          countWords(l.expirationDate);
      }
      break;
    case "achievements":
    case "professionalQualities":
      for (const q of (parsed.achievements?.length
        ? parsed.achievements
        : parsed.professionalQualities) || [])
        parsedWordCount += countWords(q);
      break;
    case "languages":
      for (const l of parsed.languages || []) parsedWordCount += countWords(l);
      break;
    case "references":
      for (const r of parsed.references || []) {
        parsedWordCount +=
          countWords(r.name) +
          countWords(r.title) +
          countWords(r.company) +
          countWords(r.phone) +
          countWords(r.email) +
          countWords(r.relationship);
      }
      break;
    case "awards":
    case "memberships":
    case "publications":
    case "training": {
      const list =
        sectionId === "awards"
          ? parsed.awards || []
          : sectionId === "memberships"
            ? parsed.memberships || []
            : sectionId === "publications"
              ? parsed.publications || []
              : parsed.training || [];
      for (const item of list) parsedWordCount += countWords(item);
      break;
    }
  }

  const ratio =
    originalWordCount > 0
      ? Math.min(1, parsedWordCount / originalWordCount)
      : 1;
  const status: CoverageStatus =
    ratio >= 0.8
      ? "good"
      : ratio >= 0.4
        ? "partial"
        : ratio >= 0.1
          ? "poor"
          : "missing";

  return { sectionId, originalWordCount, parsedWordCount, ratio, status };
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
    case "languages": {
      // Languages are absorbed into skills — confidence is derived from
      // the overall skills count
      const skills = parsed.skills || [];
      if (skills.length >= 5) return "high";
      if (skills.length >= 1) return "medium";
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
export function deriveImportQuality(
  coverage: SectionCoverageItem[],
): ImportQuality {
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

  text = repairMojibake(text);
  if (!text || text.trim().length === 0) {
    const emptyConfidence: Record<string, SectionConfidence> = {};
    for (const sid of [
      "summary",
      "experience",
      "education",
      "skills",
      "certifications",
      "professionalQualities",
      "projects",
      "languages",
      "references",
    ]) {
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
  const BOILERPLATE_RE =
    /references?\s+(available|furnished)\s+(upon\s+)?(request)?/i;
  // Only match page-number patterns like "- 1 -", "-1-", "- 42-", page "2"
  // explicitly with a leading dash/prefix, NOT standalone 4-digit years (2016)
  // or numbered list items.
  const PAGE_NUMBER_RE = /^-?\d+\s*-$/;
  for (let i = 0; i < lines.length; i++) {
    if (
      BOILERPLATE_RE.test(lines[i].trim()) ||
      PAGE_NUMBER_RE.test(lines[i].trim())
    ) {
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
      linkedin: contact.linkedin || "",
      github: contact.github || "",
    },
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    licenses: [],
    volunteer: [],
    achievements: [],
    languages: [],
    awards: [],
    memberships: [],
    publications: [],
    training: [],
    professionalQualities: [],
    projects: [],
    references: [],
    summary: "",
  };

  /** Volunteer experience — parsed separately from paid experience */
  const volunteer: ExperienceItem[] = [];

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
        const { experience, warnings: expWarnings } =
          parseExperience(sectionLines);
        if (experience.length > 0) {
          parsed.experience = experience;
        }
        // Track unparsed content: if experience was detected but parsed word
        // count is suspiciously low, store the raw lines.
        const rawText = sectionLines.join("\n").trim();
        const parsedWords = experience.reduce(
          (sum, e) =>
            sum + e.bullets.join(" ").split(/\s+/).filter(Boolean).length,
          0,
        );
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        if (
          rawText &&
          rawWords > 0 &&
          (parsedWords < 3 || parsedWords < rawWords * 0.3)
        ) {
          unparsedContent.experience = rawText;
        }
        warnings.push(...expWarnings);
        totalFields++;
        break;
      }
      case "education": {
        const { education, warnings: eduWarnings } =
          parseEducation(sectionLines);
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
        const { licenseLines, certLines } =
          splitLicenseAndCertificationLines(sectionLines);
        const licenses = parseLicenses(licenseLines);
        const certs = parseStringList(certLines)
          .filter((item) => !/^certifications?$/i.test(item))
          .filter((item) => !looksLikeEducationContentLine(item));
        if (licenses.length > 0)
          parsed.licenses = [...(parsed.licenses || []), ...licenses];
        if (certs.length > 0) parsed.certifications = certs;
        const rawText = sectionLines.join("\n").trim();
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        if (
          rawText &&
          rawWords > 5 &&
          certs.length === 0 &&
          licenses.length === 0
        ) {
          unparsedContent.certifications = rawText;
        }
        totalFields++;
        break;
      }
      case "licenses": {
        const licenses = parseLicenses(sectionLines);
        if (licenses.length > 0)
          parsed.licenses = [...(parsed.licenses || []), ...licenses];
        totalFields++;
        break;
      }
      case "professionalQualities": {
        const qualities = parseStringList(sectionLines, { splitDash: true });
        if (qualities.length > 0) {
          parsed.professionalQualities = qualities;
        }
        totalFields++;
        break;
      }
      case "achievements": {
        const achievements = parseStringList(sectionLines, { splitDash: true });
        if (achievements.length > 0) {
          parsed.achievements = achievements;
        }
        totalFields++;
        break;
      }
      case "awards": {
        const awards = parseStringList(sectionLines, { splitDash: true });
        if (awards.length > 0) {
          parsed.awards = awards;
        }
        totalFields++;
        break;
      }
      case "memberships": {
        const memberships = parseStringList(sectionLines);
        if (memberships.length > 0) parsed.memberships = memberships;
        totalFields++;
        break;
      }
      case "publications": {
        const publications = parseStringList(sectionLines, {
          splitDash: false,
        });
        if (publications.length > 0) parsed.publications = publications;
        totalFields++;
        break;
      }
      case "training": {
        const training = parseStringList(sectionLines, { splitDash: false });
        if (training.length > 0) parsed.training = training;
        totalFields++;
        break;
      }
      case "volunteer": {
        const { experience: volEntries } = parseExperience(sectionLines);
        if (volEntries.length > 0) volunteer.push(...volEntries);
        totalFields++;
        break;
      }
      case "languages": {
        const languages = parseStringList(sectionLines);
        if (languages.length > 0) parsed.languages = languages;
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
        const projects = parseProjects(sectionLines);
        parsed.projects = projects;
        const rawText = sectionLines.join("\n").trim();
        const rawWords = rawText.split(/\s+/).filter(Boolean).length;
        const parsedWords = projects.reduce(
          (sum, p) =>
            sum +
            [p.name, p.description, ...(p.technologies ?? []), ...p.bullets]
              .join(" ")
              .split(/\s+/)
              .filter(Boolean).length,
          0,
        );
        if (rawText && rawWords > 10 && parsedWords < rawWords * 0.3) {
          unparsedContent.projects = rawText;
        }
        totalFields++;
        break;
      }
    }
  }

  // Store volunteer entries separately so volunteer work does not appear under paid Experience.
  if (volunteer.length > 0) {
    parsed.volunteer = volunteer.map((v, i) => ({
      ...v,
      id: "import-vol-" + (i + 1),
    }));
  }
  const volunteerLike = (parsed.experience || []).filter((entry) =>
    /volunteer/i.test(entry.role),
  );
  if (volunteerLike.length > 0) {
    parsed.experience = (parsed.experience || []).filter(
      (entry) => !/volunteer/i.test(entry.role),
    );
    parsed.volunteer = [
      ...(parsed.volunteer || []),
      ...volunteerLike.map((entry, i) => ({
        ...entry,
        id: "import-vol-" + ((parsed.volunteer?.length || 0) + i + 1),
      })),
    ];
  }
  // Deduplicate education entries (same degree string appearing on consecutive lines
  // or duplicated from the original text). Keeps the entry with the most data.
  if (parsed.education && parsed.education.length > 1) {
    const seen = new Map<string, EducationItem>();
    for (const edu of parsed.education) {
      const key = edu.degree.toLowerCase().replace(/\s+/g, " ").trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, edu);
      } else {
        // Keep the one with more non-empty fields
        const existingScore =
          (existing.school ? 1 : 0) + (existing.graduation ? 1 : 0);
        const newScore = (edu.school ? 1 : 0) + (edu.graduation ? 1 : 0);
        if (newScore > existingScore) {
          // Copy school and graduation from the better entry
          existing.school = edu.school || existing.school;
          existing.graduation = edu.graduation || existing.graduation;
          existing.degree = edu.degree || existing.degree;
        }
      }
    }
    parsed.education = [...seen.values()];
  }

  // Deduplicate project entries with identical names (from duplicate section headers)
  if (parsed.projects && parsed.projects.length > 1) {
    const seen = new Set<string>();
    const deduped: ResumeDocument["projects"] = [];
    for (const proj of parsed.projects) {
      const key = proj.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(proj);
      }
    }
    parsed.projects = deduped;
  }

  // Calculate confidence by section
  const allSectionIds: ResumeSectionId[] = [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "licenses",
    "volunteer",
    "achievements",
    "awards",
    "languages",
    "references",
    "memberships",
    "publications",
    "training",
    "professionalQualities",
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

  return {
    parsed,
    confidence,
    confidenceBySection,
    importQuality,
    warnings,
    unparsedContent,
    coverage,
    layouts,
  };
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
  score: (
    lines: string[],
    sections: Map<string, { start: number; end: number }>,
  ) => number;
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
      const datePipeLines = pipeLines.filter((l) => /\b(19|20)\d{2}\b/.test(l));
      if (datePipeLines.length === 0) return 0;
      return Math.min(1, datePipeLines.length / 3);
    },
  },
  {
    // Table/category format: "Category,Skill1,Skill2" or "Category|Skill1|Skill2"
    id: "table-format",
    label: "Category Table Format",
    score: (lines) => {
      const delimLines = lines.filter((l) => {
        const trimmed = l.trim();
        const commaCount = (trimmed.match(/,/g) || []).length;
        const pipeCount = (trimmed.match(/\|/g) || []).length;
        return commaCount >= 2 || pipeCount >= 2;
      });
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
      const colonHeaders = lines.filter((l) =>
        /^(Skills|Languages|Certifications|Education|Experience|Summary|About)\s*:/i.test(
          l.trim(),
        ),
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
      const bulletLines = nonEmpty.filter((l) =>
        /^[•\-*\d.]+\s/.test(l.trim()),
      );
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
export function classifyLayout(
  text: string,
  sections: Map<string, { start: number; end: number }>,
): string[] {
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
