import type { ResumeDocument, ResumeSectionId } from "@careerlaunch/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ParseResult = {
  parsed: Partial<ResumeDocument>;
  confidence: number;
  warnings: string[];
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
      /^(?:personal\s+)?projects?$/im,
      /\bpersonal\s+projects?\b/i,
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
const WEBSITE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?!linkedin)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/;

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
    } else if (!contact.website) {
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
  /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})\s*\d{0,4})\s*[-–to]+\s*(\w+|\d{4}|present|current|now)/i;
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
      // The role/company line
      const fullText = line;
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
        if (cleaned && !isLikelyHeader(cleaned)) bullets.push(cleaned);
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || BULLET_RE.test(trimmed)) continue;

    if (
      /\b(?:B\.?(?:A|S|Sc|Eng)|M\.?(?:A|S|Sc|Eng|BA|FA)|Ph\.?D\.?|Bachelor|Master|Associate|Doctorate|MBA|MD|JD)\b/i.test(
        trimmed,
      )
    ) {
      const gradMatch = trimmed.match(GRAD_RE);
      education.push({
        id: `import-edu-${education.length + 1}`,
        school: extractSchool(trimmed),
        degree: trimmed.replace(gradMatch?.[0] || "", "").trim(),
        location: "",
        graduation: gradMatch ? gradMatch[1].trim() : "",
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
    if (!trimmed || BULLET_RE.test(trimmed)) continue;

    // Split on comma, pipe, bullet, or newline within the skills section
    const candidates = trimmed
      .split(/[,|•;]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 60);

    if (trimmed.includes(",") || trimmed.includes("|")) {
      skills.push(...candidates);
    } else {
      skills.push(trimmed);
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
    .filter((l) => l.length > 0 && !BULLET_RE.test(l))
    .join(" ")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

export function parseResumeText(text: string): ParseResult {
  const warnings: string[] = [];

  if (!text || text.trim().length === 0) {
    return {
      parsed: {},
      confidence: 0,
      warnings: ["No text provided"],
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
    summary: "",
  };

  let totalFields = 0;

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
        totalFields++;
        break;
      }
      case "certifications": {
        const certs = sectionLines
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !BULLET_RE.test(l));
        if (certs.length > 0) {
          parsed.certifications = certs;
        }
        totalFields++;
        break;
      }
      case "professionalQualities": {
        const quals = sectionLines
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !BULLET_RE.test(l));
        if (quals.length > 0) {
          parsed.professionalQualities = quals;
        }
        totalFields++;
        break;
      }
      case "references": {
        // References are intentionally excluded from resume output.
        // Do not include in resume export by default.
        totalFields++;
        break;
      }
      case "projects": {
        const names = sectionLines
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !BULLET_RE.test(l) &&
              !isLikelyHeader(l) &&
              !/^[•\-*\d.]+/.test(l),
          );
        if (names.length > 0) {
          parsed.projects = names.map((name, i) => ({
            id: `import-proj-${i + 1}`,
            name,
            description: "",
            bullets: [],
          }));
        }
        totalFields++;
        break;
      }
    }
  }

  // Calculate confidence
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

  return { parsed, confidence, warnings };
}
