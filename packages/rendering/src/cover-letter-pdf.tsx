import { type ResumeDocument, type CoverLetterDocument } from "@careerlaunch/domain";
import { getResumeTemplate } from "./index";
import { launchChromium } from "./browser";

export async function renderCoverLetterPdf(
  coverLetter: CoverLetterDocument,
  resume: ResumeDocument,
): Promise<ArrayBuffer> {
  const [{ chromium }, { renderToStaticMarkup }] = await Promise.all([
    import("playwright"),
    import("react-dom/server"),
  ]);
  const browser = await launchChromium(chromium);

  try {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
    });
    await page.setContent(
      renderCoverLetterHtml(coverLetter, resume, renderToStaticMarkup),
      { waitUntil: "networkidle" },
    );

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.75in",
        right: "0.75in",
        bottom: "0.75in",
        left: "0.75in",
      },
    });

    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ */
/*  HTML & CSS generation from the template definition                 */
/* ------------------------------------------------------------------ */

function renderCoverLetterHtml(
  coverLetter: CoverLetterDocument,
  resume: ResumeDocument,
  renderToStaticMarkup: (element: React.ReactElement) => string,
) {
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
  </head>
  <body>
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
