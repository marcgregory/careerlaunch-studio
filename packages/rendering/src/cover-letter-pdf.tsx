import { type ResumeDocument, type CoverLetterDocument } from "@careerlaunch/domain";
import { getResumeTemplate } from "./index";
import { renderHtmlToPdf } from "./render";

/**
 * Render a cover letter to a PDF buffer using an in-process Playwright browser.
 *
 * For local development — on Vercel you should set `PDF_RENDERER_URL`
 * and use `coverLetterToHtml()` + external renderer instead.
 */
export type CoverLetterPdfOptions = {
  watermarked?: boolean;
};

export async function renderCoverLetterPdf(
  coverLetter: CoverLetterDocument,
  resume: ResumeDocument,
  options?: CoverLetterPdfOptions,
): Promise<ArrayBuffer> {
  const html = coverLetterToHtml(coverLetter, resume, options);
  return renderHtmlToPdf(html);
}

/**
 * Generate the full HTML document (including <style> and scaffolding)
 * for a cover letter.  Use this when you want to send the HTML to an
 * external PDF renderer service instead of rendering in-process.
 */
export function coverLetterToHtml(
  coverLetter: CoverLetterDocument,
  resume: ResumeDocument,
  options?: CoverLetterPdfOptions,
): string {
  const template = getResumeTemplate(resume.templateId);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(coverLetter.title || "Cover Letter")}</title>
    <style>
      @page { size: Letter; margin: 0.75in; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ${template.nameStyle === "plain" ? "Arial, Helvetica, sans-serif" : "Inter, Arial, Helvetica, sans-serif"};
        font-size: 11pt;
        line-height: 1.5;
        color: #33343b;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        padding: 0.75in;
      }
      .letter-header {
        margin-bottom: 28px;
      }
      .letter-name {
        font-size: 18pt;
        font-weight: 900;
        letter-spacing: -0.04em;
        line-height: 1.1;
        color: ${template.swatches[0] ?? "#123c3a"};
        margin: 0 0 4px;
      }
      .letter-contact {
        font-size: 9pt;
        color: #4b4b4b;
        margin: 0;
      }
      .letter-date {
        margin: 24px 0 20px;
        font-size: 10pt;
        color: #4b4b4b;
      }
      .letter-recipient {
        margin-bottom: 20px;
        font-size: 10pt;
      }
      .letter-recipient p {
        margin: 0;
        line-height: 1.4;
      }
      .letter-salutation {
        margin-bottom: 16px;
        font-size: 11pt;
      }
      .letter-body {
        font-size: 11pt;
        line-height: 1.6;
      }
      .letter-body p {
        margin: 0 0 12px;
      }
      .letter-closing {
        margin-top: 24px;
      }
      .letter-closing p {
        margin: 0 0 4px;
      }
      .letter-signature {
        margin-top: 28px;
        font-weight: 700;
        font-size: 12pt;
        color: ${template.swatches[0] ?? "#123c3a"};
      }
    </style>
    ${options?.watermarked ? coverLetterWatermarkCss() : ""}
  </head>
  <body>
    ${options?.watermarked ? coverLetterWatermarkOverlay() : ""}
    <div class="letter-header">
      <h1 class="letter-name">${escapeHtml(resume.contact.fullName || "Your Name")}</h1>
      <p class="letter-contact">${[resume.contact.email, resume.contact.phone, resume.contact.location].filter(Boolean).join("  |  ")}</p>
    </div>

    <div class="letter-date">${formatDate(new Date())}</div>

    <div class="letter-recipient">
      ${coverLetter.recipientName ? `<p>${escapeHtml(coverLetter.recipientName)}</p>` : ""}
      ${coverLetter.recipientTitle ? `<p>${escapeHtml(coverLetter.recipientTitle)}</p>` : ""}
      ${coverLetter.companyName ? `<p>${escapeHtml(coverLetter.companyName)}</p>` : ""}
      ${coverLetter.companyAddress ? `<p>${escapeHtml(coverLetter.companyAddress)}</p>` : ""}
    </div>

    <p class="letter-salutation">${escapeHtml(coverLetter.salutation || "Dear Hiring Manager,")}</p>

    <div class="letter-body">
      ${coverLetter.body.split("\n\n").filter(Boolean).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join("\n")}
    </div>

    <div class="letter-closing">
      <p>${escapeHtml(coverLetter.closing || "Sincerely,")}</p>
    </div>

    <p class="letter-signature">${escapeHtml(coverLetter.signatureName || resume.contact.fullName || "Your Name")}</p>
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers used by both resume and cover-letter PDF            */
/* ------------------------------------------------------------------ */

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ------------------------------------------------------------------ */
/*  Watermark (shared with resume PDF)                                 */
/* ------------------------------------------------------------------ */

function coverLetterWatermarkCss(): string {
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

function coverLetterWatermarkOverlay(): string {
  const label = "Created with CareerLaunch Studio";
  const positions = [
    { top: "10%", left: "-10%" },
    { top: "25%", left: "30%" },
    { top: "45%", left: "-20%" },
    { top: "60%", left: "35%" },
    { top: "80%", left: "-15%" },
    { top: "95%", left: "25%" },
  ];

  return `<div class="watermark-wrapper">${positions
    .map(
      (pos) =>
        `<span class="watermark-text" style="top:${pos.top};left:${pos.left}">${escapeHtml(label)}</span>`,
    )
    .join("\n")}</div>`;
}
