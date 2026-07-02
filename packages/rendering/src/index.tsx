import type { ResumeDocument } from "@careerlaunch/domain";

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  return (
    <article className="mx-auto min-h-[980px] w-full max-w-[760px] bg-white p-10 text-slate-950 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
      <header className="border-b-4 border-emerald-700 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {resume.targetRole || "Target Role"}
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">{resume.contact.fullName || "Your Name"}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>{resume.contact.email}</span>
          <span>{resume.contact.phone}</span>
          <span>{resume.contact.location}</span>
          <span>{resume.contact.website}</span>
        </div>
      </header>

      <section className="mt-7">
        <h2 className="resume-heading">Profile</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{resume.summary}</p>
      </section>

      <section className="mt-7">
        <h2 className="resume-heading">Experience</h2>
        <div className="mt-3 space-y-5">
          {resume.experience.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-bold">{item.role}</h3>
                  <p className="text-sm text-slate-600">
                    {item.company} · {item.location}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  {item.start} - {item.end}
                </p>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-7 grid gap-6 md:grid-cols-[1fr_0.85fr]">
        <section>
          <h2 className="resume-heading">Education</h2>
          <div className="mt-3 space-y-3">
            {resume.education.map((item) => (
              <div key={item.id} className="text-sm">
                <p className="font-bold">{item.degree}</p>
                <p className="text-slate-600">
                  {item.school} · {item.location}
                </p>
                <p className="text-slate-500">{item.graduation}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="resume-heading">Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume.skills.filter(Boolean).map((skill) => (
              <span key={skill} className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900">
                {skill}
              </span>
            ))}
          </div>
        </section>
      </div>

      {resume.certifications.length > 0 && (
        <section className="mt-7">
          <h2 className="resume-heading">Certifications</h2>
          <p className="mt-2 text-sm text-slate-700">{resume.certifications.filter(Boolean).join(", ")}</p>
        </section>
      )}
    </article>
  );
}

