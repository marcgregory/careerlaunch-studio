import type { CoverLetterInput, GeneratedCoverLetter, CoverLetterContext } from "./types";
import { buildCoverLetterContext } from "./context";
import { getProvider } from "../providers/index";

/**
 * Generate a cover letter draft from resume data and optional job description.
 *
 * Delegates to the configured AI provider if it supports `generateCoverLetter`.
 * Falls back to a deterministic, template-based generator if the provider
 * doesn't implement the method (or isn't configured).
 *
 * The output is structured as a standard business letter: opening statement,
 * body paragraphs highlighting relevant experience and skills, and a closing.
 */
export async function generateCoverLetter(
  input: CoverLetterInput,
  options?: { providerName?: string },
): Promise<GeneratedCoverLetter> {
  // Try the AI provider first (gracefully handles no provider registered)
  try {
    const provider = options?.providerName ? getProvider(options.providerName) : getProvider();

    if (provider.generateCoverLetter) {
      try {
        return await provider.generateCoverLetter(input);
      } catch {
        // Fall through to deterministic generator on error
      }
    }
  } catch {
    // No provider registered — fall through to deterministic
  }

  // Fallback to deterministic template
  return deterministicGenerateCoverLetter(input);
}

/**
 * Deterministic, template-based cover letter generator.
 *
 * Produces a realistic placeholder that the user can then edit manually.
 * Zero AI calls — used as a fallback when no AI provider is configured.
 *
 * Uses the curated CoverLetterContext so it follows the same quality rules
 * as the AI-powered path (no raw skill dumps, no date-as-role, no repetition).
 */
export function deterministicGenerateCoverLetter(input: CoverLetterInput): GeneratedCoverLetter {
  const { resume, targetRole, jobDescription } = input;
  const ctx: CoverLetterContext = buildCoverLetterContext(resume, targetRole, jobDescription);

  // ── Build the opening paragraph ────────────────────────────────────
  // Opening mentions role/background but NOT specific skills (avoids repetition)
  let opening = `I am writing to express my strong interest in the ${ctx.targetRole} opportunity`;
  if (jobDescription) {
    opening += ` as described in your recent posting`;
  }

  const titleToUse = ctx.currentTitle
    ? ctx.currentTitle.toLowerCase()
    : ctx.targetRole.toLowerCase();

  opening += `. With my background as a ${titleToUse}, I am confident I can contribute meaningfully to your team.`;

  // ── Build the body paragraph(s) ────────────────────────────────────
  const bodyParts: string[] = [];

  // Achievement + skills combined paragraph (skills mentioned once here)
  const skillPhrase = ctx.topRelevantSkills.length > 0
    ? ctx.topRelevantSkills.join(", ")
    : null;

  if (ctx.bestAchievements.length > 0 && ctx.currentEmployer) {
    const achievementText = ctx.bestAchievements
      .slice(0, 2)
      .map((a) => a.charAt(0).toLowerCase() + a.slice(1))
      .join(", and ");
    if (skillPhrase) {
      bodyParts.push(
        `In my most recent role as ${ctx.currentTitle} at ${ctx.currentEmployer}, I ${achievementText}. Drawing on expertise in ${skillPhrase}, I am well-prepared to deliver strong results in this position.`,
      );
    } else {
      bodyParts.push(
        `In my most recent role as ${ctx.currentTitle} at ${ctx.currentEmployer}, I ${achievementText}. These experiences have prepared me to deliver strong results in this position.`,
      );
    }
  } else if (ctx.bestAchievements.length > 0) {
    const achievementText = ctx.bestAchievements
      .slice(0, 2)
      .map((a) => a.charAt(0).toLowerCase() + a.slice(1))
      .join(", and ");
    if (skillPhrase) {
      bodyParts.push(
        `In my professional experience, I ${achievementText}. My proficiency in ${skillPhrase} has been central to this work, and I thrive in environments where I can apply these capabilities.`,
      );
    } else {
      bodyParts.push(
        `In my professional experience, I ${achievementText}. These achievements reflect my ability to deliver strong results.`,
      );
    }
  } else if (skillPhrase) {
    bodyParts.push(
      `My proficiency in ${skillPhrase} has been central to my professional growth and impact. I thrive in environments where I can apply these capabilities to solve meaningful problems and drive measurable results.`,
    );
  }

  // JD alignment paragraph
  if (jobDescription) {
    bodyParts.push(
      `After reviewing your requirements, I am particularly drawn to how my experience aligns with the needs of this role. I am eager to bring my background to your organization and contribute to your continued success.`,
    );
  }

  // ── Build closing ──────────────────────────────────────────────────
  const closingParagraph = `Thank you for considering my application. I would welcome the opportunity to discuss how my experience, skills, and enthusiasm can benefit your team. I look forward to hearing from you regarding next steps.`;

  const body = [opening, ...bodyParts, closingParagraph].join("\n\n");

  return {
    body,
    salutation: "Dear Hiring Manager,",
    closing: "Sincerely,",
  };
}
