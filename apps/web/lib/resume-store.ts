import { defaultSectionOrder, sampleResume, type LicenseItem, type ProjectItem, type ResumeDocument, type ResumeSectionId, type ResumeTemplateId } from '@careerlaunch/domain';

export function createStarterResume(): ResumeDocument {
  return normalizeResume({
    ...sampleResume,
    id: 'new-resume',
    title: sampleResume.title,
    templateId: sampleResume.templateId,
    sectionOrder: [...sampleResume.sectionOrder],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toStoredResume(resume: ResumeDocument): any {
  const normalized = normalizeResume(resume);
  return {
    id: normalized.id,
    title: normalized.title,
    targetRole: normalized.targetRole,
    templateId: normalized.templateId,
    contact: normalized.contact,
    summary: normalized.summary,
    sectionOrder: normalized.sectionOrder,
    experience: normalized.experience,
    education: normalized.education,
    skills: normalized.skills,
    projects: normalized.projects,
    certifications: normalized.certifications,
    licenses: normalized.licenses,
    volunteer: normalized.volunteer,
    achievements: normalized.achievements,
    languages: normalized.languages,
    references: normalized.references,
    awards: normalized.awards,
    memberships: normalized.memberships,
    publications: normalized.publications,
    training: normalized.training,
    professionalQualities: normalized.professionalQualities,
  };
}

export function fromStoredResume(record: { id: string; title: string; targetRole: string | null; body: unknown }): ResumeDocument {
  const body = record.body as unknown as Partial<ResumeDocument>;
  return normalizeResume({
    ...body,
    id: record.id,
    title: record.title,
    targetRole: record.targetRole ?? body.targetRole ?? '',
  });
}

export function parseResumePayload(value: unknown): ResumeDocument {
  const resume = value as Partial<ResumeDocument>;
  if (!resume || typeof resume !== 'object' || typeof resume.title !== 'string') {
    throw new Error('Resume title is required.');
  }
  return normalizeResume(resume);
}

function normalizeResume(value: Partial<ResumeDocument>): ResumeDocument {
  const starter = sampleResume;
  const achievements = normalizeStringList(value.achievements);
  const legacyAchievements = normalizeStringList(value.professionalQualities);

  return {
    ...starter,
    ...value,
    id: value.id ?? starter.id,
    title: value.title ?? starter.title,
    targetRole: value.targetRole ?? '',
    templateId: normalizeTemplateId(value.templateId),
    contact: { ...starter.contact, ...value.contact },
    summary: value.summary ?? '',
    sectionOrder: normalizeSectionOrder(value.sectionOrder),
    experience: dedupById(Array.isArray(value.experience) ? value.experience : []),
    education: dedupById(Array.isArray(value.education) ? value.education : [], 'school').map((item) => ({ ...item, honors: item.honors ?? [] })),
    skills: normalizeStringList(value.skills),
    projects: normalizeProjects(value.projects),
    certifications: normalizeStringList(value.certifications),
    licenses: normalizeLicenses(value.licenses),
    volunteer: dedupById(Array.isArray(value.volunteer) ? value.volunteer : []),
    achievements: achievements.length > 0 ? achievements : legacyAchievements,
    languages: normalizeStringList(value.languages),
    references: dedupById(Array.isArray(value.references) ? value.references : []),
    awards: normalizeStringList(value.awards),
    memberships: normalizeStringList(value.memberships),
    publications: normalizeStringList(value.publications),
    training: normalizeStringList(value.training),
    professionalQualities: legacyAchievements.length > 0 ? legacyAchievements : achievements,
  };
}

/** Deduplicate an array of items with id fields, keeping the first occurrence.
 *  Uses id by default, falling back to name-based dedup for projects and
 *  education where id-based dedup may miss duplicates from old parser runs. */
function dedupById<T extends { id: string }>(items: T[], nameField?: keyof T): T[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    if (nameField) {
      const name = String(item[nameField] ?? '').toLowerCase().trim();
      if (name && seenNames.has(name)) continue;
      if (name) seenNames.add(name);
    }
    result.push(item);
  }
  return result;
}

function normalizeProjects(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return dedupById(
    value
      .filter((item): item is Partial<ProjectItem> => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id ?? 'project-' + (index + 1),
        name: item.name ?? '',
        description: item.description ?? '',
        technologies: Array.isArray(item.technologies) ? item.technologies.filter((v): v is string => typeof v === 'string') : [],
        bullets: Array.isArray(item.bullets) ? item.bullets.filter((v): v is string => typeof v === 'string') : [],
      })),
    'name',
  );
}

function normalizeLicenses(value: unknown): LicenseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): LicenseItem | null => {
      if (typeof item === 'string') {
        return { id: 'license-' + (index + 1), name: item, issuingAuthority: '', licenseNumber: '', expirationDate: '' };
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<LicenseItem>;
      return {
        id: record.id ?? 'license-' + (index + 1),
        name: record.name ?? '',
        issuingAuthority: record.issuingAuthority ?? '',
        licenseNumber: record.licenseNumber ?? '',
        expirationDate: record.expirationDate ?? '',
      };
    })
    .filter((item): item is LicenseItem => !!item && item.name.trim().length > 0);
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function normalizeSectionOrder(value: unknown): ResumeSectionId[] {
  if (!Array.isArray(value)) return [...defaultSectionOrder];
  const allowed = new Set<ResumeSectionId>(defaultSectionOrder);
  const ordered = value.filter((section): section is ResumeSectionId => allowed.has(section as ResumeSectionId));
  const unique = [...new Set(ordered)];
  return [...unique, ...defaultSectionOrder.filter((section) => !unique.includes(section))];
}

function normalizeTemplateId(value: unknown): ResumeTemplateId {
  return value === 'executive' || value === 'minimal' || value === 'ats' || value === 'modern' ? value : 'modern';
}