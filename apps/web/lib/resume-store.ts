import { sampleResume, type ResumeDocument } from "@careerlaunch/domain";
import type { Prisma } from "@prisma/client";

export function createStarterResume(): ResumeDocument {
  return {
    ...sampleResume,
    id: "new-resume",
    title: sampleResume.title,
    experience: sampleResume.experience.map((item) => ({ ...item, bullets: [...item.bullets] })),
    education: sampleResume.education.map((item) => ({ ...item })),
    skills: [...sampleResume.skills],
    certifications: [...sampleResume.certifications],
    projects: sampleResume.projects.map((item) => ({ ...item, bullets: [...item.bullets] }))
  };
}

export function toStoredResume(resume: ResumeDocument): Prisma.InputJsonObject {
  return {
    id: resume.id,
    title: resume.title,
    targetRole: resume.targetRole,
    contact: resume.contact,
    summary: resume.summary,
    experience: resume.experience,
    education: resume.education,
    skills: resume.skills,
    certifications: resume.certifications,
    projects: resume.projects
  };
}

export function fromStoredResume(record: { id: string; title: string; targetRole: string | null; body: Prisma.JsonValue }): ResumeDocument {
  const body = record.body as unknown as ResumeDocument;
  return {
    ...createStarterResume(),
    ...body,
    id: record.id,
    title: record.title,
    targetRole: record.targetRole ?? body.targetRole ?? ""
  };
}

export function parseResumePayload(value: unknown): ResumeDocument {
  const resume = value as Partial<ResumeDocument>;

  if (!resume || typeof resume !== "object" || typeof resume.title !== "string") {
    throw new Error("Resume title is required.");
  }

  return {
    ...createStarterResume(),
    ...resume,
    contact: { ...createStarterResume().contact, ...resume.contact },
    experience: Array.isArray(resume.experience) ? resume.experience : [],
    education: Array.isArray(resume.education) ? resume.education : [],
    skills: Array.isArray(resume.skills) ? resume.skills : [],
    certifications: Array.isArray(resume.certifications) ? resume.certifications : [],
    projects: Array.isArray(resume.projects) ? resume.projects : []
  };
}
