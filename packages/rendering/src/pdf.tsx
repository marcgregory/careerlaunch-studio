import {
  defaultSectionOrder,
  type ResumeDocument,
  type ResumeSectionId,
} from "@careerlaunch/domain";
import { getResumeTemplate, type TemplateDefinition } from "./index";
import { renderHtmlToPdf } from "./render";

export type PdfOptions = {
  /**
   * When true, a semi-transparent watermark is rendered behind the
   * resume content.  Used for the Free plan.
   */
  watermarked?: boolean;
};

/**
 * Render a resume to a PDF buffer using an in-process Playwright browser.
 *
 * For local development — on Vercel you should set `PDF_RENDERER_URL`
 * and use `resumeToHtml()` + external renderer instead.
 */
export async function renderResumePdf(
  resume: ResumeDocument,
  options?: PdfOptions,
): Promise<ArrayBuffer> {
  const html = resumeToHtml(resume, options);
  return renderHtmlToPdf(html);
}

/**
 * Generate the full HTML document (including <style> and scaffolding)
 * for a resume.  Use this when you want to send the HTML to an external
 * PDF renderer service instead of rendering in-process.
 */
export function resumeToHtml(resume: ResumeDocument, options?: PdfOptions): string {
  const html = renderInlineHtml(resume, options);
  return html;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function renderInlineHtml(resume: ResumeDocument, options?: PdfOptions): string {
  const template = getResumeTemplate(resume.templateId);
  const markup = buildResumeHtml(resume);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(resume.title || "Resume")}</title>
    <style>
      @page { size: Letter; margin: 0.35in; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ${template.nameStyle === "plain" ? "Arial, Helvetica, sans-serif" : "Inter, Arial, Helvetica, sans-serif"};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      ${pdfCss(template)}
      ${options?.watermarked ? watermarkCss() : ""}
    </style>
  </head>
  <body data-template-name="${escapeHtml(template.name)}">
    ${options?.watermarked ? watermarkOverlay() : ""}
    ${markup}
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  HTML construction from renderToStaticMarkup                        */
/* ------------------------------------------------------------------ */

function buildResumeHtml(resume: ResumeDocument): string {
  const template = getResumeTemplate(resume.templateId);

  const sections = normalizeSectionOrder(resume.sectionOrder)
    .map((section) => renderPdfSection(section, resume))
    .filter(Boolean)
    .join("\n");

  return `<main class="pdf-root">
    <header class="pdf-header">
      ${resume.targetRole ? `<p class="pdf-role">${escapeHtml(resume.targetRole)}</p>` : ""}
      <h1>${escapeHtml(resume.contact.fullName || "Your Name")}</h1>
      <div class="pdf-contact">
        ${[resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.website, resume.contact.linkedin, resume.contact.github]
          .filter(Boolean)
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("")}
      </div>
    </header>
    ${sections}
  </main>`;
}

function renderPdfSection(section: string, resume: ResumeDocument): string | null {
  if (section === "summary" && resume.summary.trim()) {
    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Profile</h2></div>
      <p class="pdf-summary">${escapeHtml(resume.summary)}</p>
    </section>`;
  }

  if (section === "experience" && resume.experience.length > 0) {
    const entries = resume.experience.map((item) => `
      <article class="pdf-entry">
        <div class="pdf-entry-top">
          <div>
            <h3>${escapeHtml(item.role)}</h3>
            <p class="pdf-muted">${[item.company, item.location].filter(Boolean).map(escapeHtml).join(" - ")}</p>
          </div>
          <p class="pdf-dates">${[item.start, item.end].filter(Boolean).map(escapeHtml).join(" - ")}</p>
        </div>
        ${item.bullets.filter(Boolean).length > 0 ? `<ul>${item.bullets.filter(Boolean).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
      </article>`).join("\n");

    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Experience</h2></div>
      ${entries}
    </section>`;
  }

  if (section === "education" && resume.education.length > 0) {
    const items = resume.education.map((item) => `
      <div class="pdf-edu-item">
        <strong>${escapeHtml(item.degree)}</strong>
        <div>${[item.school, item.location].filter(Boolean).map(escapeHtml).join(" - ")}</div>
        <div>${escapeHtml(item.graduation)}</div>
      </div>`).join("\n");

    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Education</h2></div>
      ${items}
    </section>`;
  }

  if (section === "skills" && resume.skills.filter(Boolean).length > 0) {
    const groups = groupSkills(resume.skills.filter(Boolean));
    const totalGroups = groups.length;

    // Premium two-column layout: each column is a flex column with skill groups.
    // Within each group, skills are rendered as dot-separated inline text
    // instead of bulky pills — cleaner and more compact.
    const rendered = totalGroups <= 2
      ? // 1-2 groups: side by side in a two-column grid
        `<div class="pdf-skills-grid">${groups.map((g) => `
          <div class="pdf-skill-group">
            <h3 class="pdf-skill-category">${escapeHtml(g.category)}</h3>
            <p class="pdf-skill-items">${g.items.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</p>
          </div>`).join("\n")}</div>`
      : // 3+ groups: stack vertically, still with dot-separated inline skills
        `<div class="pdf-skills-stack">${groups.map((g) => `
          <div class="pdf-skill-group">
            <h3 class="pdf-skill-category">${escapeHtml(g.category)}</h3>
            <p class="pdf-skill-items">${g.items.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</p>
          </div>`).join("\n")}</div>`;

    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Skills</h2></div>
      ${rendered}
    </section>`;
  }

  if (section === "certifications" && resume.certifications.filter(Boolean).length > 0) {
    const items = resume.certifications.filter(Boolean).map((c) => `<li>${escapeHtml(c)}</li>`).join("");
    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Certifications</h2></div>
      <ul class="pdf-cert-list">${items}</ul>
    </section>`;
  }

  if (section === "professionalQualities") {
    const rendered = renderPdfStringList("Professional Qualities", resume.professionalQualities);
    if (rendered) return rendered;
  }

  if (section === 'licenses' && resume.licenses.filter((item) => item.name.trim()).length > 0) {
    const items = resume.licenses
      .filter((item) => item.name.trim())
      .map((item) => '<li><strong>' + escapeHtml(item.name) + '</strong>'
        + (item.issuingAuthority ? '<div class=\'pdf-muted\'>' + escapeHtml(item.issuingAuthority) + '</div>' : '')
        + (item.licenseNumber ? '<div class=\'pdf-ref-contact\'>License Number: ' + escapeHtml(item.licenseNumber) + '</div>' : '')
        + (item.expirationDate ? '<div class=\'pdf-ref-contact\'>Expires: ' + escapeHtml(item.expirationDate) + '</div>' : '')
        + '</li>')
      .join('');
    return '<section><div class=\'pdf-section-title-wrap\'><h2 class=\'pdf-section-title\'>Licenses</h2></div><ul class=\'pdf-cert-list\'>' + items + '</ul></section>';
  }

  if (section === 'volunteer' && resume.volunteer.length > 0) {
    const entries = resume.volunteer.map((item) => '<article class=\'pdf-entry\'>'
      + '<div class=\'pdf-entry-top\'><div><h3>' + escapeHtml(item.role) + '</h3><p class=\'pdf-muted\'>' + [item.company, item.location].filter(Boolean).map(escapeHtml).join(' - ') + '</p></div>'
      + '<p class=\'pdf-dates\'>' + [item.start, item.end].filter(Boolean).map(escapeHtml).join(' - ') + '</p></div>'
      + (item.bullets.filter(Boolean).length > 0 ? '<ul>' + item.bullets.filter(Boolean).map((b) => '<li>' + escapeHtml(b) + '</li>').join('') + '</ul>' : '')
      + '</article>').join('\n');
    return '<section><div class=\'pdf-section-title-wrap\'><h2 class=\'pdf-section-title\'>Volunteer Experience</h2></div>' + entries + '</section>';
  }

  if (section === 'achievements') {
    const rendered = renderPdfStringList('Achievements', resume.achievements);
    if (rendered) return rendered;
  }

  if (section === 'awards') {
    const rendered = renderPdfStringList('Awards', resume.awards);
    if (rendered) return rendered;
  }

  if (section === 'languages') {
    const rendered = renderPdfStringList('Languages', resume.languages);
    if (rendered) return rendered;
  }

  if (section === 'memberships') {
    const rendered = renderPdfStringList('Professional Memberships', resume.memberships);
    if (rendered) return rendered;
  }

  if (section === 'publications') {
    const rendered = renderPdfStringList('Publications', resume.publications);
    if (rendered) return rendered;
  }

  if (section === 'training') {
    const rendered = renderPdfStringList('Training', resume.training);
    if (rendered) return rendered;
  }
  if (section === "projects" && resume.projects.length > 0) {
    const entries = resume.projects.map((item) => `
      <article class="pdf-entry">
        <h3 class="pdf-project-title">${escapeHtml(item.name)}</h3>
        ${item.description ? `<p class="pdf-description">${escapeHtml(item.description)}</p>` : ""}
        ${item.bullets.filter(Boolean).length > 0 ? `<ul>${item.bullets.filter(Boolean).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
      </article>`).join("\n");

    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Projects</h2></div>
      ${entries}
    </section>`;
  }

  if (section === "references") {
    const refs = resume.references.filter((r) => r.name.trim());
    if (refs.length === 0) return null;

    const items = refs.map((item) => `
      <div class="pdf-ref-item">
        <strong>${escapeHtml(item.name)}</strong>
        ${[item.title, item.company].filter(Boolean).length > 0 ? `<div class="pdf-muted">${[item.title, item.company].filter(Boolean).map(escapeHtml).join(", ")}</div>` : ""}
        ${[item.phone, item.email].filter(Boolean).length > 0 ? `<div class="pdf-ref-contact">${[item.phone, item.email].filter(Boolean).map(escapeHtml).join(" · ")}</div>` : ""}
        ${item.relationship ? `<div class="pdf-ref-rel">${escapeHtml(item.relationship)}</div>` : ""}
      </div>`).join("\n");

    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">References</h2></div>
      <div class="pdf-refs">${items}</div>
    </section>`;
  }

  return null;
}

function renderPdfStringList(title: string, items: string[]): string | null {
  const values = items.filter(Boolean);
  if (values.length === 0) return null;
  const rendered = values.map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
  return '<section><div class=\'pdf-section-title-wrap\'><h2 class=\'pdf-section-title\'>' + escapeHtml(title) + '</h2></div><ul class=\'pdf-cert-list\'>' + rendered + '</ul></section>';
}
/* ------------------------------------------------------------------ */
/*  CSS generation                                                     */
/* ------------------------------------------------------------------ */

function pdfCss(t: TemplateDefinition): string {
  const nameColor = pdfColor(0, "#123c3a", t.swatches);
  const roleColor = roleHeadingPdfColor(t);
  const markerC = pdfColor(2, "#00796f", t.swatches);

  return `
    .pdf-root {
      width: 100%; min-height: 9.8in;
      padding: 0.35in;
      background: ${t.headerStyle === "double-rule" ? "#fbfaf7" : t.headerStyle === "thin-rule" ? "#fffffb" : "#ffffff"};
      color: ${nameColor};
    }
    .pdf-header { ${headerPdfBorder(t)} padding-bottom: 22px; }
    .pdf-role {
      margin: 0; color: ${roleColor};
      font-size: ${t.roleStyle === "plain" ? "11px" : "10px"};
      font-weight: ${t.roleStyle === "plain" ? "700" : "900"};
      letter-spacing: ${t.roleStyle === "plain" ? "0" : "0.14em"};
      line-height: 1.2;
      text-transform: ${t.roleStyle === "plain" ? "none" : "uppercase"};
    }
    h1 {
      margin: 12px 0 0; color: ${nameColor};
      font-size: ${t.nameStyle === "plain" ? "34px" : "42px"};
      font-weight: ${t.nameStyle === "plain" ? "700" : "900"};
      letter-spacing: 0; line-height: ${t.nameStyle === "plain" ? "1.05" : "0.95"};
    }
    .pdf-contact {
      display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 14px;
      color: ${t.nameStyle === "plain" ? "#333333" : "#4b4b4b"};
      font-size: 12px;
      font-weight: ${t.nameStyle === "plain" ? "500" : "900"};
    }
    section { margin-top: 24px; break-inside: avoid; }
    .pdf-summary, .pdf-description {
      margin: 10px 0 0;
      color: #33343b; font-size: 12px; font-weight: 500; line-height: 1.65;
    }
    .pdf-description { color: #4b4b4b; }
    .pdf-section-title {
      margin: 0; color: ${roleColor};
      font-size: ${t.roleStyle === "plain" ? "12px" : "10px"};
      font-weight: ${t.roleStyle === "plain" ? "700" : "900"};
      letter-spacing: ${t.roleStyle === "plain" ? "0" : "0.14em"};
      line-height: 1.2;
      text-transform: ${t.roleStyle === "plain" ? "none" : "uppercase"};
    }
    .pdf-section-title-wrap {
      ${sectionTitleBorderPdf(t)}
    }
    .pdf-entry { margin-top: 16px; break-inside: avoid; }
    .pdf-entry-top {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;
    }
    h3 {
      margin: 0; color: ${nameColor};
      font-size: ${t.nameStyle === "plain" ? "16px" : "17px"};
      font-weight: ${t.nameStyle === "plain" ? "700" : "900"};
      letter-spacing: 0; line-height: 1.15;
    }
    .pdf-project-title { font-size: 15px; }
    .pdf-muted, .pdf-dates {
      margin: 3px 0 0; color: #4b4b4b; font-size: 12px; font-weight: 800;
    }
    .pdf-dates { color: #777777; white-space: nowrap; }
    ul {
      margin: 9px 0 0; padding-left: 18px;
      color: #33343b; font-size: 12px; font-weight: 500; line-height: 1.55;
    }
    li { margin-top: 4px; }
    li::marker { color: ${markerC}; }
    .pdf-edu-item {
      margin-top: 12px; color: #4b4b4b; font-size: 12px; font-weight: 500; line-height: 1.45;
    }
    .pdf-edu-item strong {
      display: block; color: ${nameColor};
      font-weight: ${t.nameStyle === "plain" ? "700" : "900"};
    }
    .pdf-skill-group { margin-top: 12px; }
    .pdf-skill-category {
      margin: 0 0 4px;
      color: #555;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    /* Premium dot-separated inline skills — clean and compact */
    .pdf-skill-items {
      margin: 0;
      color: #33343b;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.7;
    }
    .pdf-skill-items span + span::before {
      content: " • ";
      color: ${markerC};
      font-weight: 700;
    }
    /* Two-column grid for 1-2 skill groups */
    .pdf-skills-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      margin-top: 8px;
    }
    .pdf-skills-grid .pdf-skill-group { margin-top: 0; }
    /* Vertical stack for 3+ skill groups */
    .pdf-skills-stack {
      column-count: 2;
      column-gap: 32px;
      margin-top: 8px;
    }
    .pdf-skills-stack .pdf-skill-group {
      break-inside: avoid;
      margin-top: 0;
    }
    .pdf-skills-stack .pdf-skill-group + .pdf-skill-group {
      margin-top: 12px;
    }
    /* Certification list — cleaner than comma-concatenated text */
    .pdf-cert-list {
      margin: 8px 0 0; padding: 0;
      list-style: none;
    }
    .pdf-cert-list li {
      padding: 3px 0 3px 14px;
      position: relative;
      color: #33343b;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.55;
    }
    .pdf-cert-list li::before {
      content: "▸";
      position: absolute;
      left: 0;
      color: ${markerC};
      font-weight: 700;
    }
    /* References section */
    .pdf-ref-item { margin-top: 12px; color: #4b4b4b; font-size: 12px; font-weight: 500; line-height: 1.45; }
    .pdf-ref-item strong { display: block; color: ${nameColor}; font-weight: ${t.nameStyle === "plain" ? "700" : "900"}; }
    .pdf-ref-contact { color: #555555; font-size: 11px; margin-top: 1px; }
    .pdf-ref-rel { color: #777777; font-size: 11px; font-style: italic; margin-top: 1px; }
    /* Professional qualities — designed bullet list */
    .pdf-qualities-list {
      margin: 8px 0 0; padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 18px;
    }
    .pdf-qualities-list li {
      color: #33343b;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.55;
    }
    .pdf-qualities-list li + li::before {
      content: "—";
      margin-right: 18px;
      color: ${markerC};
      font-weight: 700;
    }
  `;
}

function pdfColor(index: number, fallback: string, swatches: string[]): string {
  return swatches[index] ?? fallback;
}

function roleHeadingPdfColor(t: TemplateDefinition): string {
  if (t.headerStyle === "accent-bar") return "#00796f";
  if (t.headerStyle === "double-rule") return "#8a6a22";
  return t.swatches[0] ?? "#111111";
}

function headerPdfBorder(t: TemplateDefinition): string {
  switch (t.headerStyle) {
    case "accent-bar":
      return "border-bottom: 5px solid #b9ff66;";
    case "double-rule":
      return "border-bottom: 2px solid #c9a44c;";
    case "thin-rule":
      return "border-bottom: 1px solid rgba(32,33,36,0.28);";
    case "simple":
      return "border-bottom: 1px solid #111111;";
  }
}

function sectionTitleBorderPdf(t: TemplateDefinition): string {
  if (t.headerStyle === "simple") {
    return `border-bottom: 1px solid #111111; padding-bottom: 3px; margin-bottom: 0;`;
  }
  return "";
}


/* ------------------------------------------------------------------ */
/*  Skills grouping helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * When skills are stored with "Category: Skill" prefixes (from AI recovery
 * flattening), group them back by category for a structured display.
 *
 * Skills without a colon separator are placed under a generic heading.
 */
type SkillGroup = { category: string; items: string[] };

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ------------------------------------------------------------------ */
/*  Watermark for Free plan exports                                    */
/* ------------------------------------------------------------------ */

function watermarkCss(): string {
  return `
    .watermark-wrapper {
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    }
    .watermark-text {
      position: absolute;
      color: rgba(180, 180, 180, 0.25);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
      transform: rotate(-25deg);
      user-select: none;
    }
  `;
}

function watermarkOverlay(): string {
  const label = "Created with CareerLaunch Studio";
  const positions = [
    // 8 repeated positions across the page
    { top: "5%", left: "-10%" },
    { top: "15%", left: "30%" },
    { top: "30%", left: "-20%" },
    { top: "40%", left: "40%" },
    { top: "55%", left: "-15%" },
    { top: "65%", left: "25%" },
    { top: "80%", left: "-25%" },
    { top: "90%", left: "35%" },
  ];

  return `<div class="watermark-wrapper">${positions
    .map(
      (pos) =>
        `<span class="watermark-text" style="top:${pos.top};left:${pos.left}">${escapeHtml(label)}</span>`,
    )
    .join("\n")}</div>`;
}
