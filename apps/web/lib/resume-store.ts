import { defaultSectionOrder, sampleResume, type ResumeDocument, type ResumeSectionId, type ResumeTemplateId } from "@careerlaunch/domain";
import type { Prisma } from "@prisma/client";

export function createStarterResume(): ResumeDocument {
  return {
    ...sampleResume,
    id: "new-resume",
    title: sampleResume.title,
    templateId: sampleResume.templateId,
    sectionOrder: [...sampleResume.sectionOrder],
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
    templateId: normalizeTemplateId(resume.templateId),
    contact: resume.contact,
    summary: resume.summary,
    sectionOrder: normalizeSectionOrder(resume.sectionOrder),
    experience: resume.experience,
    education: resume.education,
    skills: resume.skills,
    certifications: resume.certifications,
    projects: resume.projects
  };
}

export function fromStoredResume(record: { id: string; title: string; targetRole: string | null; body: Prisma.JsonValue }): ResumeDocument {
  const body = record.body as unknown as Partial<ResumeDocument>;
  return {
    ...createStarterResume(),
    ...body,
    id: record.id,
    title: record.title,
    targetRole: record.targetRole ?? body.targetRole ?? "",
    templateId: normalizeTemplateId(body.templateId),
    sectionOrder: normalizeSectionOrder(body.sectionOrder)
  };
}

export function parseResumePayload(value: unknown): ResumeDocument {
  const resume = value as Partial<ResumeDocument>;
  const starter = createStarterResume();

  if (!resume || typeof resume !== "object" || typeof resume.title !== "string") {
    throw new Error("Resume title is required.");
  }

  return {
    ...starter,
    ...resume,
    contact: { ...starter.contact, ...resume.contact },
    templateId: normalizeTemplateId(resume.templateId),
    sectionOrder: normalizeSectionOrder(resume.sectionOrder),
    experience: Array.isArray(resume.experience) ? resume.experience : [],
    education: Array.isArray(resume.education) ? resume.education : [],
    skills: Array.isArray(resume.skills) ? resume.skills : [],
    certifications: Array.isArray(resume.certifications) ? resume.certifications : [],
    projects: Array.isArray(resume.projects) ? resume.projects : []
  };
}

function normalizeSectionOrder(value: unknown): ResumeSectionId[] {
  if (!Array.isArray(value)) return [...defaultSectionOrder];
  const allowed = new Set<ResumeSectionId>(defaultSectionOrder);
  const ordered = value.filter((section): section is ResumeSectionId => allowed.has(section as ResumeSectionId));
  return [...ordered, ...defaultSectionOrder.filter((section) => !ordered.includes(section))];
}

function normalizeTemplateId(value: unknown): ResumeTemplateId {
  return value === "executive" || value === "minimal" || value === "ats" || value === "modern" ? value : "modern";
}