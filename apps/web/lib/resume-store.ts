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

export function toStoredResume(resume: ResumeDocument): ResumeDocument {
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

export function normalizeResume(value: Partial<ResumeDocument>): ResumeDocument {
  const starter = sampleResume;
  const achievements = normalizeAchievementList(value.achievements);
  const legacyAchievements = normalizeAchievementList(value.professionalQualities);

  return {
    ...starter,
    ...value,
    id: value.id ?? starter.id,
    title: normalizeTextValue(value.title ?? starter.title),
    targetRole: normalizeTextValue(value.targetRole ?? ''),
    templateId: normalizeTemplateId(value.templateId),
    contact: normalizeContact({ ...starter.contact, ...value.contact }),
    summary: normalizeTextValue(value.summary ?? ''),
    sectionOrder: normalizeSectionOrder(value.sectionOrder),
    experience: normalizeExperienceItems(value.experience),
    education: dedupById(Array.isArray(value.education) ? value.education : [], 'school').map((item) => ({ ...item, honors: item.honors ?? [] })),
    skills: normalizeStringList(value.skills),
    projects: normalizeProjects(value.projects),
    certifications: normalizeStringList(value.certifications),
    licenses: normalizeLicenses(value.licenses),
    volunteer: normalizeExperienceItems(value.volunteer),
    achievements,
    languages: normalizeStringList(value.languages),
    references: normalizeReferences(value.references),
    awards: normalizeStringList(value.awards),
    memberships: normalizeStringList(value.memberships),
    publications: normalizeStringList(value.publications),
    training: normalizeStringList(value.training),
    professionalQualities: legacyAchievements,
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

const INLINE_BULLET_MARKER_RE =
  /(?:[\u2022\u25cf\u25aa\u25e6]|\u00e2(?:\u20ac\u00a2|\u2014[\u008f\u00a6]|\u2013\u00aa))/;
const LINE_START_BULLET_MARKER_RE = new RegExp(
  `(?:${INLINE_BULLET_MARKER_RE.source}|[*\\-]|\\d+[.)])`,
);
const BULLET_RE = new RegExp(`^${LINE_START_BULLET_MARKER_RE.source}\\s*`);
const EMBEDDED_BULLET_RE = new RegExp(`(?=${INLINE_BULLET_MARKER_RE.source}\\s*)`, 'g');

function normalizeExperienceItems(value: unknown): ResumeDocument['experience'] {
  if (!Array.isArray(value)) return [];
  return dedupById(
    value
      .filter((item): item is Partial<ResumeDocument['experience'][number]> => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id ?? 'experience-' + (index + 1),
        role: normalizeTextValue(item.role ?? ''),
        company: normalizeTextValue(item.company ?? ''),
        location: normalizeTextValue(item.location ?? ''),
        start: normalizeTextValue(item.start ?? ''),
        end: normalizeTextValue(item.end ?? ''),
        bullets: normalizeBulletList(item.bullets),
      })),
  );
}

function normalizeBulletList(value: unknown): string[] {
  const source = normalizeStringList(value);
  const normalized: string[] = [];

  for (const bullet of source) {
    const pieces = bullet
      .split(EMBEDDED_BULLET_RE)
      .map((piece) => piece.replace(BULLET_RE, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (const piece of pieces) {
      const lastIndex = normalized.length - 1;
      if (lastIndex >= 0 && isOrphanBulletContinuation(piece, normalized[lastIndex])) {
        normalized[lastIndex] = normalized[lastIndex] + ' ' + piece;
      } else {
        normalized.push(piece);
      }
    }
  }

  return normalized;
}

function isOrphanBulletContinuation(text: string, previous: string): boolean {
  if (!previous) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5) return false;
  if (/^(?:and|or|with|through|by|for|to|from|in|on|at|of)\b/i.test(text)) return true;
  return /^[a-z]/.test(text) && /[.!?]$/.test(text);
}
function normalizeContact(value: ResumeDocument['contact']): ResumeDocument['contact'] {
  return {
    fullName: normalizeTextValue(value.fullName ?? ''),
    email: normalizeTextValue(value.email ?? ''),
    phone: normalizeTextValue(value.phone ?? ''),
    location: normalizeTextValue(value.location ?? ''),
    website: normalizeTextValue(value.website ?? ''),
    linkedin: normalizeTextValue(value.linkedin ?? ''),
    github: normalizeTextValue(value.github ?? ''),
  };
}

function normalizeReferences(value: unknown): ResumeDocument['references'] {
  if (!Array.isArray(value)) return [];
  return dedupById(
    value
      .filter((item): item is Partial<ResumeDocument['references'][number]> => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id ?? 'ref-' + (index + 1),
        name: normalizeTextValue(item.name ?? ''),
        title: normalizeTextValue(item.title ?? ''),
        company: normalizeTextValue(item.company ?? ''),
        phone: normalizeTextValue(item.phone ?? ''),
        email: normalizeTextValue(item.email ?? ''),
        relationship: normalizeTextValue(item.relationship ?? ''),
      })),
  );
}

function normalizeProjects(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return dedupById(
    value
      .filter((item): item is Partial<ProjectItem> => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id ?? 'project-' + (index + 1),
        name: normalizeTextValue(item.name ?? ''),
        description: normalizeTextValue(item.description ?? ''),
        technologies: normalizeStringList(item.technologies),
        bullets: normalizeStringList(item.bullets),
      })),
    'name',
  );
}

function normalizeLicenses(value: unknown): LicenseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): LicenseItem | null => {
      if (typeof item === 'string') {
        return { id: 'license-' + (index + 1), name: normalizeTextValue(item), issuingAuthority: '', licenseNumber: '', expirationDate: '' };
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<LicenseItem>;
      return {
        id: record.id ?? 'license-' + (index + 1),
        name: normalizeTextValue(record.name ?? ''),
        issuingAuthority: normalizeTextValue(record.issuingAuthority ?? ''),
        licenseNumber: normalizeTextValue(record.licenseNumber ?? ''),
        expirationDate: normalizeTextValue(record.expirationDate ?? ''),
      };
    })
    .filter((item): item is LicenseItem => !!item && item.name.trim().length > 0);
}

function normalizeStringList(value: unknown): string[] {
  if (typeof value === 'string') return normalizeDelimitedList(value);
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeTextValue)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
}

function normalizeAchievementList(value: unknown): string[] {
  const source = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return source
    .filter((item): item is string => typeof item === 'string')
    .flatMap((item) => splitAchievementValue(normalizeTextValue(item)))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeDelimitedList(value: string): string[] {
  return normalizeTextValue(value)
    .split(/[,;|\u2022]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitAchievementValue(value: string): string[] {
  return value
    .split(/\s*[\u2014\u2013]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeTextValue(value: string): string {
  return value
    .replaceAll('\u00e2\u20ac\u201d', '\u2014')
    .replaceAll('\u00e2\u20ac\u0153', '\u2013')
    .replaceAll('\u00e2\u20ac\u00a2', '\u2022')
    .replaceAll('\u00c2\u00b7', '\u00b7')
    .replaceAll('\u00c3\u201a\u00c2\u00b7', '\u00b7')
    .replaceAll('\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d', '\u2014')
    .replaceAll('\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153', '\u2013')
    .replaceAll('\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2', '\u2022')
    .replaceAll('\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2', '\u2019');
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