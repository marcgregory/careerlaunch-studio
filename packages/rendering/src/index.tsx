import type React from "react";
import {
  defaultSectionOrder,
  type ResumeDocument,
  type ResumeSectionId,
  type ResumeTemplateId,
} from "@careerlaunch/domain";

type TemplateTone = "Editorial" | "Executive" | "Minimal" | "ATS";

/** Describes the header's bottom decoration. */
type HeaderStyle = "accent-bar" | "double-rule" | "thin-rule" | "simple";
/** Affects the candidate name font weight and tracking. */
type NameStyle = "display" | "large-serif" | "plain";
/** Affects the target-role label above the name. */
type RoleStyle = "uppercase-mono" | "uppercase-small" | "plain";

export type TemplateDefinition = {
  id: ResumeTemplateId;
  name: string;
  tone: TemplateTone;
  description: string;
  /** True if the template is only available on a paid plan. */
  premium: boolean;
  /** Brand accent colour used for hover / selection states in the gallery. */
  accentColor: string;
  /** Up to 3 colour swatches shown in the gallery card. */
  swatches: string[];

  /* --- Semantic layout properties (add a template = pick these, no renderer changes) --- */
  headerStyle: HeaderStyle;
  nameStyle: NameStyle;
  roleStyle: RoleStyle;

  /* --- Pre-computed Tailwind class strings --- */
  /** Container classes applied to the root <article>. */
  containerClass: string;
  /** Classes for <h2> section headings. */
  headingClass: string;
  /** Classes for <ul> list markers. */
  markerClass: string;
  /** Classes for <span> skill pills. */
  skillClass: string;
};

export const resumeTemplates: TemplateDefinition[] = [
  {
    id: "modern",
    name: "Signal Modern",
    tone: "Editorial",
    description:
      "Bold nameplate, sharp accent bar, and compact proof points for high-signal applications.",
    premium: false,
    accentColor: "#b9ff66",
    swatches: ["#123c3a", "#b9ff66", "#00796f"],
    headerStyle: "accent-bar",
    nameStyle: "display",
    roleStyle: "uppercase-mono",
    containerClass:
      "bg-white p-10 text-[#123c3a] shadow-[0_30px_80px_rgba(18,60,58,0.16)] ring-1 ring-black/10",
    headingClass: "text-[#0f766e]",
    markerClass: "marker:text-[#00796f]",
    skillClass:
      "rounded-full bg-[#b9ff66] px-3 py-1.5 text-xs font-black text-[#123c3a]",
  },
  {
    id: "executive",
    name: "Executive Ledger",
    tone: "Executive",
    description:
      "A boardroom-ready layout with a refined rule system and restrained navy-gold contrast.",
    premium: false,
    accentColor: "#c9a44c",
    swatches: ["#162033", "#c9a44c", "#eef1f4"],
    headerStyle: "double-rule",
    nameStyle: "display",
    roleStyle: "uppercase-mono",
    containerClass:
      "bg-[#fbfaf7] p-10 text-[#162033] shadow-[0_30px_80px_rgba(22,32,51,0.15)] ring-1 ring-[#162033]/15",
    headingClass: "text-[#8a6a22]",
    markerClass: "marker:text-[#c9a44c]",
    skillClass:
      "border border-[#c9a44c]/35 bg-white px-3 py-1.5 text-xs font-black uppercase text-[#162033]",
  },
  {
    id: "minimal",
    name: "Quiet Grid",
    tone: "Minimal",
    description:
      "Precise spacing, monochrome type hierarchy, and calm structure for design-aware roles.",
    premium: false,
    accentColor: "#202124",
    swatches: ["#202124", "#f2f2ee", "#6f7478"],
    headerStyle: "thin-rule",
    nameStyle: "display",
    roleStyle: "uppercase-mono",
    containerClass:
      "bg-[#fffffb] p-10 text-[#202124] shadow-[0_30px_80px_rgba(32,33,36,0.12)] ring-1 ring-black/10",
    headingClass: "text-[#202124]",
    markerClass: "marker:text-[#202124]",
    skillClass:
      "border border-[#202124]/15 bg-[#f2f2ee] px-3 py-1.5 text-xs font-bold text-[#202124]",
  },
  {
    id: "ats",
    name: "ATS Classic",
    tone: "ATS",
    description:
      "Single-column, parser-friendly formatting that keeps typography and section order conservative.",
    premium: false,
    accentColor: "#d9dde3",
    swatches: ["#111111", "#ffffff", "#d9dde3"],
    headerStyle: "simple",
    nameStyle: "plain",
    roleStyle: "plain",
    containerClass:
      "bg-white p-10 text-[#111111] shadow-[0_30px_80px_rgba(17,17,17,0.10)] ring-1 ring-black/10",
    headingClass: "text-[#111111]",
    markerClass: "marker:text-[#111111]",
    skillClass:
      "border border-[#d9dde3] bg-white px-3 py-1.5 text-xs font-bold text-[#111111]",
  },
];

export function getResumeTemplate(
  templateId: ResumeTemplateId | undefined,
): TemplateDefinition {
  return (
    resumeTemplates.find((t) => t.id === templateId) ?? resumeTemplates[0]
  );
}

/* ------------------------------------------------------------------ */
/*  Utility helpers that map semantic properties to Tailwind classes  */
/* ------------------------------------------------------------------ */

function headerBorderClass(style: HeaderStyle): string {
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

function nameClass(style: NameStyle): string {
  switch (style) {
    case "display":
      return "font-signal text-5xl font-black tracking-[-0.06em]";
    case "large-serif":
      return "font-signal text-5xl font-black tracking-[-0.06em]";
    case "plain":
      return "text-4xl font-bold tracking-normal";
  }
}

function roleClass(style: RoleStyle): string {
  switch (style) {
    case "uppercase-mono":
      return "font-mono text-xs font-black uppercase tracking-[0.2em]";
    case "uppercase-small":
      return "text-xs font-black uppercase tracking-[0.12em]";
    case "plain":
      return "text-xs font-bold";
  }
}

function contactClass(nameStyle: NameStyle): string {
  return nameStyle === "plain"
    ? "font-medium text-[#333]"
    : "font-black text-[#4b4b4b]";
}

function headingBorderClass(
  headerStyle: HeaderStyle,
  headingClass: string,
): string {
  if (headerStyle === "simple") {
    return `border-b border-[#111] pb-1 text-sm tracking-normal ${headingClass}`;
  }
  return `resume-heading ${headingClass}`;
}

function itemTitleClass(nameStyle: NameStyle): string {
  return nameStyle === "plain"
    ? "text-lg font-bold leading-tight"
    : "font-signal text-xl font-black tracking-[-0.04em] leading-tight";
}

function educationDegreeClass(nameStyle: NameStyle): string {
  return nameStyle === "plain"
    ? "font-bold"
    : "font-signal font-black tracking-[-0.03em]";
}

function projectTitleClass(nameStyle: NameStyle): string {
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
      className={`mx-auto min-h-[980px] w-full max-w-[760px] print:bg-white print:shadow-none print:ring-0 ${template.containerClass}`}
      data-template={template.id}
    >
      <header className={headerBorderClass(template.headerStyle)}>
        <p className={`leading-none ${roleClass(template.roleStyle)} ${template.headingClass}`}>
          {resume.targetRole || "Target Role"}
        </p>
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
  if (section === "certifications")
    return (
      <CertificationsSection
        key={section}
        resume={resume}
        template={template}
      />
    );
  return (
    <ProjectsSection key={section} resume={resume} template={template} />
  );
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
      <p className="mt-3 text-sm font-medium leading-7 text-[#33343b]">
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
                <p className="text-sm font-black text-[#4b4b4b]">
                  {[item.company, item.location].filter(Boolean).join(" - ")}
                </p>
              </div>
              <p className="text-sm font-black text-[#777]">
                {[item.start, item.end].filter(Boolean).join(" - ")}
              </p>
            </div>
            {item.bullets.filter(Boolean).length > 0 && (
              <ul
                className={`mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-7 text-[#33343b] ${template.markerClass}`}
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
          <div key={item.id} className="text-sm">
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

function SkillsSection({
  resume,
  template,
}: {
  resume: ResumeDocument;
  template: TemplateDefinition;
}) {
  const skills = resume.skills.filter(Boolean);
  if (skills.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>Skills</ResumeHeading>
      <div className="mt-4 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className={template.skillClass}>
            {skill}
          </span>
        ))}
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
      <p className="mt-3 text-sm font-medium text-[#33343b]">
        {certifications.join(", ")}
      </p>
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
              <p className="mt-1 text-sm font-medium leading-6 text-[#4b4b4b]">
                {item.description}
              </p>
            )}
            {item.bullets.filter(Boolean).length > 0 && (
              <ul
                className={`mt-2 list-disc space-y-1.5 pl-5 text-sm font-medium leading-7 text-[#33343b] ${template.markerClass}`}
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
  return [
    ...ordered,
    ...defaultSectionOrder.filter((s) => !ordered.includes(s)),
  ];
}
