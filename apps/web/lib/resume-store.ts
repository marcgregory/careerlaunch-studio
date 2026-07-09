import { defaultSectionOrder, sampleResume, type ResumeDocument, type ResumeSectionId, type ResumeTemplateId } from "@careerlaunch/domain";
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
    professionalQualities: [...sampleResume.professionalQualities],
    projects: sampleResume.projects.map((item) => ({ ...item, bullets: [...item.bullets] })),
    references: []
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toStoredResume(resume: ResumeDocument): any {
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
    professionalQualities: resume.professionalQualities,
    projects: resume.projects,
    references: resume.references
  };
}

export function fromStoredResume(record: { id: string; title: string; targetRole: string | null; body: unknown }): ResumeDocument {
  const body = record.body as unknown as Partial<ResumeDocument>;
  return {
    ...createStarterResume(),
    ...body,
    id: record.id,
    title: record.title,
    targetRole: record.targetRole ?? body.targetRole ?? "",
    templateId: normalizeTemplateId(body.templateId),
    sectionOrder: normalizeSectionOrder(body.sectionOrder),
    experience: dedupById(Array.isArray(body.experience) ? body.experience : []),
    education: dedupById(Array.isArray(body.education) ? body.education : [], "school"),
    projects: dedupById(Array.isArray(body.projects) ? body.projects : [], "name"),
    references: dedupById(Array.isArray(body.references) ? body.references : [])
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
    experience: dedupById(Array.isArray(resume.experience) ? resume.experience : []),
    education: dedupById(Array.isArray(resume.education) ? resume.education : [], "school"),
    skills: Array.isArray(resume.skills) ? resume.skills : [],
    certifications: Array.isArray(resume.certifications) ? resume.certifications : [],
    professionalQualities: Array.isArray(resume.professionalQualities) ? resume.professionalQualities : [],
    projects: dedupById(Array.isArray(resume.projects) ? resume.projects : [], "name"),
    references: dedupById(Array.isArray(resume.references) ? resume.references : [])
  };
}

/** Deduplicate an array of items with `id` fields, keeping the first occurrence.
 *  Uses id by default, falling back to name-based dedup for projects and
 *  education where id-based dedup may miss duplicates from old parser runs. */
function dedupById<T extends { id: string }>(items: T[], nameField?: keyof T): T[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    // Name-based dedup for projects/education: same name = duplicate
    if (nameField) {
      const name = String(item[nameField] ?? "").toLowerCase().trim();
      if (name && seenNames.has(name)) continue;
      if (name) seenNames.add(name);
    }
    result.push(item);
  }
  return result;
}

function normalizeSectionOrder(value: unknown): ResumeSectionId[] {
  if (!Array.isArray(value)) return [...defaultSectionOrder];
  const allowed = new Set<ResumeSectionId>(defaultSectionOrder);
  const ordered = value.filter((section): section is ResumeSectionId => allowed.has(section as ResumeSectionId));
  const unique = [...new Set(ordered)];
  return [...unique, ...defaultSectionOrder.filter((section) => !unique.includes(section))];
}

function normalizeTemplateId(value: unknown): ResumeTemplateId {
  return value === "executive" || value === "minimal" || value === "ats" || value === "modern" ? value : "modern";
}
