import { defaultSectionOrder, type ResumeDocument, type ResumeSectionId } from "@careerlaunch/domain";
import type { ReactElement } from "react";

export async function renderResumePdf(resume: ResumeDocument): Promise<ArrayBuffer> {
  const [{ chromium }, { renderToStaticMarkup }] = await Promise.all([import("playwright"), import("react-dom/server")]);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(renderResumeHtml(resume, renderToStaticMarkup), { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.35in",
        right: "0.35in",
        bottom: "0.35in",
        left: "0.35in"
      }
    });

    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}

function renderResumeHtml(resume: ResumeDocument, renderToStaticMarkup: (element: ReactElement) => string) {
  const markup = renderToStaticMarkup(<ResumePdfDocument resume={resume} />);

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
        background: #ffffff;
        color: #123c3a;
        font-family: Inter, Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .resume-pdf { width: 100%; min-height: 9.8in; padding: 0.35in; background: #ffffff; color: #123c3a; }
      .resume-header { border-bottom: 5px solid #b9ff66; padding-bottom: 22px; }
      .target-role, .section-title {
        margin: 0;
        color: #00796f;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.14em;
        line-height: 1.2;
        text-transform: uppercase;
      }
      h1 { margin: 12px 0 0; color: #123c3a; font-size: 42px; font-weight: 900; letter-spacing: 0; line-height: 0.95; }
      .contact-line { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 14px; color: #4b4b4b; font-size: 12px; font-weight: 800; }
      section { margin-top: 24px; break-inside: avoid; }
      .summary, .description { margin: 10px 0 0; color: #33343b; font-size: 12px; font-weight: 500; line-height: 1.65; }
      .description { color: #4b4b4b; }
      .entry { margin-top: 16px; break-inside: avoid; }
      .entry-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      h3 { margin: 0; color: #123c3a; font-size: 17px; font-weight: 900; letter-spacing: 0; line-height: 1.15; }
      .project-title { font-size: 15px; }
      .muted, .dates { margin: 3px 0 0; color: #4b4b4b; font-size: 12px; font-weight: 800; }
      .dates { color: #777777; white-space: nowrap; }
      ul { margin: 9px 0 0; padding-left: 18px; color: #33343b; font-size: 12px; font-weight: 500; line-height: 1.55; }
      li { margin-top: 4px; }
      li::marker { color: #00796f; }
      .education-item { margin-top: 12px; color: #4b4b4b; font-size: 12px; font-weight: 500; line-height: 1.45; }
      .education-item strong { display: block; color: #123c3a; font-weight: 900; }
      .skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
      .skill { border-radius: 999px; background: #b9ff66; color: #123c3a; padding: 6px 10px; font-size: 10px; font-weight: 900; }
    </style>
  </head>
  <body>${markup}</body>
</html>`;
}

function ResumePdfDocument({ resume }: { resume: ResumeDocument }) {
  return (
    <main className="resume-pdf">
      <header className="resume-header">
        <p className="target-role">{resume.targetRole || "Target Role"}</p>
        <h1>{resume.contact.fullName || "Your Name"}</h1>
        <div className="contact-line">
          {[resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.website].filter(Boolean).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </header>

      {normalizeSectionOrder(resume.sectionOrder).map((section) => renderPdfSection(section, resume))}
    </main>
  );
}

function renderPdfSection(section: ResumeSectionId, resume: ResumeDocument) {
  if (section === "summary" && resume.summary.trim()) {
    return (
      <section key={section}>
        <h2 className="section-title">Profile</h2>
        <p className="summary">{resume.summary}</p>
      </section>
    );
  }

  if (section === "experience" && resume.experience.length > 0) {
    return (
      <section key={section}>
        <h2 className="section-title">Experience</h2>
        {resume.experience.map((item) => (
          <article className="entry" key={item.id}>
            <div className="entry-top">
              <div>
                <h3>{item.role}</h3>
                <p className="muted">{[item.company, item.location].filter(Boolean).join(" - ")}</p>
              </div>
              <p className="dates">{[item.start, item.end].filter(Boolean).join(" - ")}</p>
            </div>
            {item.bullets.filter(Boolean).length > 0 && (
              <ul>
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    );
  }

  if (section === "education" && resume.education.length > 0) {
    return (
      <section key={section}>
        <h2 className="section-title">Education</h2>
        {resume.education.map((item) => (
          <div className="education-item" key={item.id}>
            <strong>{item.degree}</strong>
            <div>{[item.school, item.location].filter(Boolean).join(" - ")}</div>
            <div>{item.graduation}</div>
          </div>
        ))}
      </section>
    );
  }

  if (section === "skills" && resume.skills.filter(Boolean).length > 0) {
    return (
      <section key={section}>
        <h2 className="section-title">Skills</h2>
        <div className="skills">
          {resume.skills.filter(Boolean).map((skill) => (
            <span className="skill" key={skill}>{skill}</span>
          ))}
        </div>
      </section>
    );
  }

  if (section === "certifications" && resume.certifications.filter(Boolean).length > 0) {
    return (
      <section key={section}>
        <h2 className="section-title">Certifications</h2>
        <p className="summary">{resume.certifications.filter(Boolean).join(", ")}</p>
      </section>
    );
  }

  if (section === "projects" && resume.projects.length > 0) {
    return (
      <section key={section}>
        <h2 className="section-title">Projects</h2>
        {resume.projects.map((item) => (
          <article className="entry" key={item.id}>
            <h3 className="project-title">{item.name}</h3>
            {item.description && <p className="description">{item.description}</p>}
            {item.bullets.filter(Boolean).length > 0 && (
              <ul>
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    );
  }

  return null;
}

function normalizeSectionOrder(value: ResumeSectionId[] | undefined): ResumeSectionId[] {
  const ordered = Array.isArray(value) ? value.filter((section): section is ResumeSectionId => defaultSectionOrder.includes(section)) : [];
  return [...ordered, ...defaultSectionOrder.filter((section) => !ordered.includes(section))];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}