export {
  resumeTemplates,
  getResumeTemplate,
  type TemplateDefinition,
} from "./templates";

import type React from "react";
import { defaultSectionOrder, type ResumeDocument, type ResumeSectionId } from "@careerlaunch/domain";
import { getResumeTemplate, type TemplateDefinition } from "./templates";

/* ------------------------------------------------------------------ */
/*  Utility helpers that map semantic properties to Tailwind classes  */
/* ------------------------------------------------------------------ */

function headerBorderClass(style: TemplateDefinition["headerStyle"]): string {
  switch (style) {
    case "accent-bar":
      return "border-b-[5px] border-[#b9ff66] pb-6";
    case "double-rule":
      return "border-b-2 border-[#c9a44c] pb-6";
    case "thin-rule":
      return "border-b border-black/25 pb-5";
    case "simple":
      return "border-b border-[#111] pb-5";
  }
}

function nameClass(style: TemplateDefinition["nameStyle"]): string {
  switch (style) {
    case "display":
      return "font-signal text-5xl font-black tracking-[-0.06em]";
    case "large-serif":
      return "font-signal text-5xl font-black tracking-[-0.06em]";
    case "plain":
      return "text-4xl font-bold tracking-normal";
  }
}

function roleClass(style: TemplateDefinition["roleStyle"]): string {
  switch (style) {
    case "uppercase-mono":
      return "font-mono text-xs font-black uppercase tracking-[0.2em]";
    case "uppercase-small":
      return "text-xs font-black uppercase tracking-[0.12em]";
    case "plain":
      return "text-xs font-bold";
  }
}

function contactClass(nameStyle: TemplateDefinition["nameStyle"]): string {
  return nameStyle === "plain"
    ? "font-medium text-[#333]"
    : "font-black text-[#4b4b4b]";
}

function headingBorderClass(
  headerStyle: TemplateDefinition["headerStyle"],
  headingClass: string,
): string {
  if (headerStyle === "simple") {
    return `border-b border-[#111] pb-1 text-sm tracking-normal ${headingClass}`;
  }
  return `resume-heading ${headingClass}`;
}

function itemTitleClass(nameStyle: TemplateDefinition["nameStyle"]): string {
  return nameStyle === "plain"
    ? "text-lg font-bold leading-tight"
    : "font-signal text-xl font-black tracking-[-0.04em] leading-tight";
}

function educationDegreeClass(nameStyle: TemplateDefinition["nameStyle"]): string {
  return nameStyle === "plain"
    ? "font-bold"
    : "font-signal font-black tracking-[-0.03em]";
}

function projectTitleClass(nameStyle: TemplateDefinition["nameStyle"]): string {
  return nameStyle === "plain"
    ? "text-base font-bold leading-tight"
    : "font-signal text-lg font-black tracking-[-0.04em] leading-tight";
}

/* ------------------------------------------------------------------ */
/*  Preview component                                                 */
/* ------------------------------------------------------------------ */

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  const template = getResumeTemplate(resume.templateId);

  return (
    <article
      className={`mx-auto min-h-[980px] w-full print:bg-white print:shadow-none print:ring-0 ${template.containerClass}`}
      data-template={template.id}
    >
      <header className={headerBorderClass(template.headerStyle)}>
        {resume.targetRole && (
          <p className={`leading-none ${roleClass(template.roleStyle)} ${template.headingClass}`}>
            {resume.targetRole}
          </p>
        )}
        <h1 className={`mt-4 leading-none ${nameClass(template.nameStyle)}`}>
          {resume.contact.fullName || "Your Name"}
        </h1>
        <div
          className={`mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm ${contactClass(template.nameStyle)}`}
        >
          {[
            resume.contact.email,
            resume.contact.phone,
            resume.contact.location,
            resume.contact.website,
            resume.contact.linkedin,
            resume.contact.github,
          ]
            .filter(Boolean)
            .map((item) => (
              <span key={item}>{item}</span>
            ))}
        </div>
      </header>

      {normalizeSectionOrder(resume.sectionOrder).map((section) =>
        renderSection(section, resume, template),
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Section renderers                                                 */
/* ------------------------------------------------------------------ */

function renderSection(
  section: ResumeSectionId,
  resume: ResumeDocument,
  template: TemplateDefinition,
) {
  if (section === "summary")
    return <SummarySection key={section} resume={resume} template={template} />;
  if (section === "experience")
    return (
      <ExperienceSection key={section} resume={resume} template={template} />
    );
  if (section === "education")
    return (
      <EducationSection key={section} resume={resume} template={template} />
    );
  if (section === "skills")
    return <SkillsSection key={section} resume={resume} template={template} />;
  if (section === 'certifications')
    return (
      <CertificationsSection
        key={section}
        resume={resume}
        template={template}
      />
    );
  if (section === 'licenses')
    return <LicensesSection key={section} resume={resume} template={template} />;
  if (section === 'volunteer')
    return <VolunteerSection key={section} resume={resume} template={template} />;
  if (section === 'achievements' || section === 'professionalQualities')
    return (
      <ProfessionalQualitiesSection
        key={section}
        resume={resume}
        template={template}
      />
    );
  if (section === 'awards')
    return <StringListSection key={section} title='Awards' items={resume.awards} template={template} />;
  if (section === 'memberships')
    return <StringListSection key={section} title='Professional Memberships' items={resume.memberships} template={template} />;
  if (section === 'publications')
    return <StringListSection key={section} title='Publications' items={resume.publications} template={template} />;
  if (section === 'training')
    return <StringListSection key={section} title='Training' items={resume.training} template={template} />;
  if (section === 'languages')
    return <StringListSection key={section} title='Languages' items={resume.languages} template={template} />;
  if (section === 'references')
    return (
      <ReferencesSection key={section} resume={resume} template={template} />
    );
  if (section === "projects")
    return (
      <ProjectsSection key={section} resume={resume} template={template} />
    );
  return null;
}

function ResumeHeading({
  children,
  template,
}: {
  children: React.ReactNode;
  template: TemplateDefinition;
}) {
  return (
    <h2
      className={headingBorderClass(
        template.headerStyle,
        template.headingClass,
      )}
    >
      {children}
    </h2>
  );
}

function SummarySection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  if (!resume.summary.trim()) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Profile</ResumeHeading>
      <p className="mt-3 text-[15px] font-medium leading-7 text-[#33343b]">
        {resume.summary}
      </p>
    </section>
  );
}

function ExperienceSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  if (resume.experience.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Experience</ResumeHeading>
      <div className="mt-4 space-y-6">
        {resume.experience.map((item) => (
          <div key={item.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3
                  className={`leading-tight ${itemTitleClass(template.nameStyle)}`}
                >
                  {item.role}
                </h3>
                <p className="text-[15px] font-black text-[#4b4b4b]">
                  {[item.company, item.location].filter(Boolean).join(" - ")}
                </p>
              </div>
              <p className="text-[15px] font-black text-[#777]">
                {[item.start, item.end].filter(Boolean).join(" - ")}
              </p>
            </div>
            {item.bullets.filter(Boolean).length > 0 && (
              <ul
                className={`mt-3 list-disc space-y-1.5 pl-5 text-[15px] font-medium leading-7 text-[#33343b] ${template.markerClass}`}
              >
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  if (resume.education.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Education</ResumeHeading>
      <div className="mt-4 space-y-3">
        {resume.education.map((item) => (
          <div key={item.id} className="text-[15px]">
            <p
              className={`${educationDegreeClass(template.nameStyle)}`}
            >
              {item.degree}
            </p>
            <p className="font-medium text-[#4b4b4b]">
              {[item.school, item.location].filter(Boolean).join(" - ")}
            </p>
            <p className="font-black text-[#777]">{item.graduation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VolunteerSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  if (resume.volunteer.length === 0) return null;
  return (
    <section className='mt-8'>
      <ResumeHeading template={template}>Volunteer Experience</ResumeHeading>
      <div className='mt-4 space-y-6'>
        {resume.volunteer.map((item) => (
          <div key={item.id}>
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <div>
                <h3 className='text-lg font-bold leading-tight'>{item.role}</h3>
                <p className='text-[15px] font-black text-[#4b4b4b]'>{[item.company, item.location].filter(Boolean).join(' - ')}</p>
              </div>
              <p className='text-[15px] font-black text-[#777]'>{[item.start, item.end].filter(Boolean).join(' - ')}</p>
            </div>
            {item.bullets.filter(Boolean).length > 0 && (
              <ul className='mt-3 list-disc space-y-1.5 pl-5 text-[15px] font-medium leading-7 text-[#33343b]'>
                {item.bullets.filter(Boolean).map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function LicensesSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const licenses = resume.licenses.filter((item) => item.name.trim());
  if (licenses.length === 0) return null;
  return (
    <section className='mt-8'>
      <ResumeHeading template={template}>Licenses</ResumeHeading>
      <ul className='mt-3 space-y-2 text-[15px] font-medium text-[#33343b]'>
        {licenses.map((item) => (
          <li key={item.id}>
            <span className='font-black text-[#4b4b4b]'>{item.name}</span>
            {[item.issuingAuthority, item.licenseNumber && 'License Number: ' + item.licenseNumber, item.expirationDate && 'Expires: ' + item.expirationDate]
              .filter(Boolean)
              .map((detail) => (
                <div key={detail} className='text-[#555]'>{detail}</div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StringListSection({
  title,
  items,
  template,
}: {
  title: string;
  items: string[];
  template: TemplateDefinition;
}) {
  const values = items.filter(Boolean);
  if (values.length === 0) return null;
  return (
    <section className='mt-8'>
      <ResumeHeading template={template}>{title}</ResumeHeading>
      <ul className='mt-3 list-disc space-y-1.5 pl-5 text-[15px] font-medium leading-7 text-[#33343b]'>
        {values.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
function ProfessionalQualitiesSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const quals = resume.professionalQualities.filter(Boolean);
  if (quals.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Achievements</ResumeHeading>
      <p className="mt-3 text-[15px] font-medium leading-7 text-[#33343b]">
        {quals.map((q, i) => (
          <span key={q}>
            {i > 0 && <span className="mx-2 text-[#bbb]">â€”</span>}
            {q}
          </span>
        ))}
      </p>
    </section>
  );
}

function SkillsSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const skills = resume.skills.filter(Boolean);
  if (skills.length === 0) return null;

  // Group "Category: Skill" prefixed skills for structured display
  const groups = groupSkills(skills);
  const MAX_VISIBLE = 4;

  // Single group or no categorized skills â†’ flat pill layout with +N more indicator
  if (groups.length <= 1) {
    const items = groups[0]?.items ?? skills;
    const visible = items.slice(0, MAX_VISIBLE);
    const hidden = items.length - MAX_VISIBLE;

    return (
      <section className="mt-8">
        <ResumeHeading template={template}>Skills</ResumeHeading>
        <div className="mt-4 flex flex-wrap gap-2">
          {visible.map((skill) => (
            <span key={skill} className={template.skillClass}>
              {skill}
            </span>
          ))}
          {hidden > 0 && (
            <span
              className="inline-flex items-center rounded-full border border-[#123c3a]/20 bg-white/60 px-3 py-1.5 text-xs font-bold text-[#4b4b4b]"
              title={`${items.length} total â€” ${hidden} more: ${items.slice(MAX_VISIBLE).join(", ")}`}
            >
              +{hidden} more
            </span>
          )}
        </div>
      </section>
    );
  }

  // Multiple categories â€” show first 4 per group with +N more indicator
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Skills</ResumeHeading>
      <div className="mt-4 space-y-4">
        {groups.map((g) => {
          const visible = g.items.slice(0, MAX_VISIBLE);
          const hidden = g.items.length - MAX_VISIBLE;

          return (
            <div key={g.category}>
              <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#555]">
                {g.category} <span className="font-normal text-[#999]">({g.items.length})</span>
              </h3>
              <p className="text-[15px] font-medium leading-7 text-[#33343b]">
                {visible.map((skill, i) => (
                  <span key={skill}>
                    {i > 0 && <span className="mx-1.5 text-[#bbb]">â€¢</span>}
                    {skill}
                  </span>
                ))}
              </p>
              {hidden > 0 && (
                <p className="mt-0.5 text-xs font-bold text-[#00796f]">
                  +{hidden} more
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CertificationsSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const certifications = resume.certifications.filter(Boolean);
  if (certifications.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Certifications</ResumeHeading>
      <ul className="mt-3 space-y-1 text-[15px] font-medium text-[#33343b]">
        {certifications.map((cert) => (
          <li key={cert} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
            {cert}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  if (resume.projects.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Projects</ResumeHeading>
      <div className="mt-4 space-y-5">
        {resume.projects.map((item) => (
          <div key={item.id}>
            <h3
              className={`leading-tight ${projectTitleClass(template.nameStyle)}`}
            >
              {item.name}
            </h3>
            {item.description && (
              <p className="mt-1 text-[15px] font-medium leading-6 text-[#4b4b4b]">
                {item.description}
              </p>
            )}
            {item.bullets.filter(Boolean).length > 0 && (
              <ul
                className={`mt-2 list-disc space-y-1.5 pl-5 text-[15px] font-medium leading-7 text-[#33343b] ${template.markerClass}`}
              >
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReferencesSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const refs = resume.references.filter((r) => r.name.trim());
  if (refs.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>References</ResumeHeading>
      <div className="mt-4 space-y-3">
        {refs.map((item) => (
          <div key={item.id} className="text-[15px] leading-relaxed">
            <p className="font-black text-[#4b4b4b]">{item.name}</p>
            <p className="font-medium text-[#33343b]">
              {[item.title, item.company].filter(Boolean).join(", ")}
            </p>
            <p className="text-[#555]">
              {[item.phone, item.email].filter(Boolean).join(" Â· ")}
            </p>
            {item.relationship && (
              <p className="mt-0.5 text-sm text-[#777]">{item.relationship}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Skills grouping helpers                                           */
/* ------------------------------------------------------------------ */

type SkillGroup = { category: string; items: string[] };

/**
 * Reconstruct category groups from "Category: Skill" prefixed strings
 * produced by the AI recovery pipeline's flattened skill format.
 */
function groupSkills(skills: string[]): SkillGroup[] {
  const groups = new Map<string, string[]>();
  const uncategorized: string[] = [];

  for (const skill of skills) {
    const colonIdx = skill.indexOf(": ");
    if (colonIdx > 0) {
      const cat = skill.slice(0, colonIdx).trim();
      const item = skill.slice(colonIdx + 2).trim();
      if (cat && item) {
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(item);
        continue;
      }
    }
    uncategorized.push(skill);
  }

  const result: SkillGroup[] = [];
  for (const [category, items] of groups) {
    result.push({ category, items });
  }
  result.sort((a, b) => a.category.localeCompare(b.category));

  if (uncategorized.length > 0) {
    result.push({ category: "Skills", items: uncategorized });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function normalizeSectionOrder(
  value: ResumeSectionId[] | undefined,
): ResumeSectionId[] {
  const ordered = Array.isArray(value)
    ? value.filter((s): s is ResumeSectionId =>
        defaultSectionOrder.includes(s),
      )
    : [];
  const unique = [...new Set(ordered)];
  return [
    ...unique,
    ...defaultSectionOrder.filter((s) => !unique.includes(s)),
  ];
}
