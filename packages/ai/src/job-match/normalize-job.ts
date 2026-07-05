import type { NormalizedJob } from "./types";

/**
 * Known skills dictionary for MVP job-match extraction.
 *
 * These are common resume-worthy skills matched case-insensitively against
 * the job description text. The dictionary approach is deterministic,
 * testable, and requires no AI calls.
 *
 * Future: replace with AI extraction for broader coverage.
 */
const SKILL_DICTIONARY = new Set([
  // Frontend
  "react", "angular", "vue", "svelte", "next.js", "nextjs", "typescript",
  "javascript", "html", "css", "scss", "tailwind", "bootstrap", "webpack",
  "redux", "graphql", "rest", "api", "ajax", "jquery",
  // Backend
  "node.js", "nodejs", "express", "django", "flask", "ruby on rails",
  "spring", "asp.net", "go", "golang", "rust", "c#", "java", "python",
  "php", "laravel", "swift", "kotlin",
  // Database
  "sql", "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
  "dynamodb", "cassandra", "bigquery", "snowflake", "sqlite",
  // Cloud & DevOps
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform",
  "ansible", "jenkins", "ci/cd", "github actions", "gitlab ci",
  // Data & ML
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
  "pandas", "numpy", "scikit-learn", "jupyter", "spark", "airflow", "dbt",
  // Tools & Methods
  "git", "github", "gitlab", "jira", "confluence", "figma", "sketch",
  "agile", "scrum", "kanban", "saas", "microservices", "serverless",
  // Soft skills (match only in context of "skills: X, Y, Z" sections)
  "leadership", "communication", "project management", "cross-functional",
  "stakeholder management", "mentoring", "team building",
  // Business
  "a/b testing", "analytics", "product management", "product strategy",
  "growth", "seo", "sem", "crm", "erp",
  // Customer / Support
  "customer success", "customer support", "salesforce", "hubspot", "zendesk",
  "intercom", "freshdesk",
]);

/**
 * Extract skills from raw text using dictionary matching.
 * Matches case-insensitively and returns matched skill strings
 * in their canonical form from the dictionary.
 */
/**
 * Build a regex from a dictionary entry that matches on word boundaries.
 * Single-word skills use \b word boundaries; multi-word skills use the whole phrase.
 */
function skillPattern(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped.replace(/\s+/g, "\\s+")}\\b`, "i");
}

function extractSkills(text: string): string[] {
  return Array.from(SKILL_DICTIONARY)
    .filter((skill) => skillPattern(skill).test(text))
    .sort();
}

/**
 * Tokenize text: lowercase, strip punctuation, split on whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/#+_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/^[#.]+|[#.]+$/g, ""))
    .filter(Boolean);
}

/**
 * Extract experience-level indicators (years, common seniority terms).
 */
function extractExperience(text: string): string[] {
  const lower = text.toLowerCase();
  const indicators: string[] = [];

  // Years of experience patterns
  const yearPatterns = [
    /(\d+)\+?\s*years?\s*(?:of\s+)?experience/gi,
    /(\d+)\+?\s*yr\s*(?:of\s+)?exp/gi,
    /(\d+)\+?\s*y\s*exp/gi,
  ];

  for (const pattern of yearPatterns) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      indicators.push(`${m[1]}+ years`);
    }
  }

  // Seniority keywords
  const seniorityKeywords = [
    "entry level", "junior", "mid-level", "senior", "staff",
    "principal", "lead", "manager", "director", "head of", "vp", "c-level",
    "intern", "associate",
  ];

  for (const keyword of seniorityKeywords) {
    if (lower.includes(keyword)) {
      indicators.push(keyword);
    }
  }

  return [...new Set(indicators)].sort();
}

/**
 * Normalize a raw job description into a structured, tokenized form.
 *
 * Returns tokens, extracted skills, and experience indicators.
 * The result is fully deterministic — the same text always produces the same output.
 */
export function normalizeJobDescription(text: string): NormalizedJob {
  const trimmed = text.trim();

  if (!trimmed) {
    return { tokens: [], skills: [], experience: [] };
  }

  return {
    tokens: tokenize(trimmed),
    skills: extractSkills(trimmed),
    experience: extractExperience(trimmed),
  };
}
