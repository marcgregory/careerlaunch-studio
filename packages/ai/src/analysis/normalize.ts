import type { ResumeDocument } from "@careerlaunch/domain";
import type { NormalizedResume, NormalizedSection, NormalizedProject } from "./types";

/**
 * Normalize a ResumeDocument into the internal analysis format.
 *
 * This decouples analysis logic from the shape of the persisted resume.
 * Changes to the ResumeDocument schema only require updating this one
 * mapping function — all analysis dimensions continue to work unchanged.
 */
export function normalizeResume(resume: ResumeDocument): NormalizedResume {
  const sections: NormalizedSection[] = [
    ...resume.experience.map(
      (exp): NormalizedSection => ({
        id: exp.id,
        type: "experience",
        role: exp.role,
        company: exp.company,
        bullets: exp.bullets,
        dateRange: {
          start: exp.start,
          end: exp.end,
        },
      }),
    ),
    ...resume.education.map(
      (edu): NormalizedSection => ({
        id: edu.id,
        type: "education",
        school: edu.school,
        degree: edu.degree,
        bullets: [],
        dateRange: {
          start: edu.graduation,
          end: edu.graduation,
        },
      }),
    ),
  ];

  const projects: NormalizedProject[] = resume.projects.map((proj) => ({
    name: proj.name,
    description: proj.description,
    bullets: proj.bullets,
  }));

  return {
    contact: { ...resume.contact },
    summary: resume.summary,
    sections,
    skills: [...resume.skills],
    certifications: [...resume.certifications],
    projects,
  };
}
