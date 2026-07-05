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
        ${[resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.website]
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
    const skills = resume.skills.filter(Boolean).map((s) => `<span class="pdf-skill">${escapeHtml(s)}</span>`).join("");
    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Skills</h2></div>
      <div class="pdf-skills">${skills}</div>
    </section>`;
  }

  if (section === "certifications" && resume.certifications.filter(Boolean).length > 0) {
    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Certifications</h2></div>
      <p class="pdf-summary">${resume.certifications.filter(Boolean).map(escapeHtml).join(", ")}</p>
    </section>`;
  }

  if (section === "professionalQualities" && resume.professionalQualities.filter(Boolean).length > 0) {
    const quals = resume.professionalQualities.filter(Boolean).map((q) => `<span class="pdf-skill">${escapeHtml(q)}</span>`).join("");
    return `<section>
      <div class="pdf-section-title-wrap"><h2 class="pdf-section-title">Professional Qualities</h2></div>
      <div class="pdf-skills">${quals}</div>
    </section>`;
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

  return null;
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
    .pdf-skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
    .pdf-skill { ${skillPdfCss(t)} }
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

function skillPdfCss(t: TemplateDefinition): string {
  switch (t.id) {
    case "modern":
      return "border-radius: 999px; background: #b9ff66; color: #123c3a; padding: 6px 10px; font-size: 10px; font-weight: 900;";
    case "executive":
      return "border: 1px solid rgba(201,164,76,0.5); border-radius: 0; background: #ffffff; color: #162033; padding: 6px 10px; font-size: 10px; font-weight: 900; text-transform: uppercase;";
    case "minimal":
      return "border: 1px solid rgba(32,33,36,0.16); border-radius: 0; background: #f2f2ee; color: #202124; padding: 6px 10px; font-size: 10px; font-weight: 700;";
    case "ats":
      return "border: 1px solid #d9dde3; border-radius: 0; background: #ffffff; color: #111111; padding: 6px 10px; font-size: 10px; font-weight: 700;";
    default:
      return "border-radius: 999px; background: #b9ff66; color: #123c3a; padding: 6px 10px; font-size: 10px; font-weight: 900;";
  }
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
