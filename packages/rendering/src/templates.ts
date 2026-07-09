import { defaultSectionOrder, type ResumeTemplateId } from "@careerlaunch/domain";

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
    premium: true,
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
    premium: true,
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

export { defaultSectionOrder, type ResumeTemplateId };
