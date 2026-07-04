import type { CoverLetterInput, GeneratedCoverLetter } from "./types";
import type { ResumeDocument } from "@careerlaunch/domain";
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
 */
export function deterministicGenerateCoverLetter(input: CoverLetterInput): GeneratedCoverLetter {
  const { resume, jobDescription } = input;
  const name = resume.contact.fullName || "the candidate";
  const role = resume.targetRole || "the position";
  const firstName = name.split(" ")[0] || name;

  // Select up to 3 relevant skills
  const skills = resume.skills.length > 0
    ? pickSkills(resume.skills, 3)
    : ["relevant skills"];

  // Select an experience highlight if available
  const experienceHighlight = pickExperienceHighlight(resume);

  // Build the opening paragraph
  let opening = `I am writing to express my strong interest in the ${role} opportunity`;
  if (jobDescription) {
    opening += ` as described in your recent posting`;
  }
  opening += `. With my background in ${resume.experience.length > 0 ? resume.experience[0].role.toLowerCase() : "professional work"} and expertise in ${skills.join(", ")}, I am confident I can contribute meaningfully to your team.`;

  // Build the body paragraph
  const bodyParts: string[] = [];

  if (experienceHighlight) {
    bodyParts.push(
      `In my most recent role as ${experienceHighlight.role} at ${experienceHighlight.company}, ${experienceHighlight.highlight}`
    );
  }

  bodyParts.push(
    `My proficiency in ${skills.join(", ")} has been central to my professional growth and impact. I thrive in environments where I can apply these capabilities to solve meaningful problems and drive measurable results.`
  );

  if (jobDescription) {
    bodyParts.push(
      `After reviewing your requirements, I am particularly drawn to how my experience aligns with the needs of this role. I am eager to bring my background to your organization and contribute to your continued success.`
    );
  }

  // Build closing
  const closingParagraph = `Thank you for considering my application. I would welcome the opportunity to discuss how my experience, skills, and enthusiasm can benefit your team. I look forward to hearing from you regarding next steps.`;

  const body = [opening, ...bodyParts, closingParagraph].join("\n\n");

  return {
    body,
    salutation: "Dear Hiring Manager,",
    closing: "Sincerely,",
  };
}

function pickSkills(skills: string[], count: number): string[] {
  // Pick deterministic skills (first ones tend to be most relevant)
  return skills.slice(0, Math.min(count, skills.length));
}

function pickExperienceHighlight(
  resume: CoverLetterInput["resume"]
): { role: string; company: string; highlight: string } | null {
  if (resume.experience.length === 0) return null;

  const exp = resume.experience[0];
  const bullet = exp.bullets.filter((b) => b.trim().length > 0)[0];

  if (bullet) {
    return {
      role: exp.role,
      company: exp.company || "your organization",
      highlight: `I ${bullet.charAt(0).toLowerCase() + bullet.slice(1)}`,
    };
  }

  return {
    role: exp.role,
    company: exp.company || "your organization",
    highlight: `I developed skills in team collaboration, project management, and delivering results.`,
  };
}
