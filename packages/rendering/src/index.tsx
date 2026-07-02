import type { ResumeDocument } from "@careerlaunch/domain";

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  return (
    <article className="mx-auto min-h-[980px] w-full max-w-[760px] bg-white p-10 text-[#123c3a] shadow-[0_30px_80px_rgba(18,60,58,0.16)] ring-1 ring-black/10 print:bg-white print:shadow-none print:ring-0">
      <header className="border-b-[5px] border-[#b9ff66] pb-6">
        <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#00796f]">
          {resume.targetRole || "Target Role"}
        </p>
        <h1 className="font-signal mt-4 text-5xl font-black leading-none tracking-[-0.07em]">{resume.contact.fullName || "Your Name"}</h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-black text-[#4b4b4b]">
          <span>{resume.contact.email}</span>
          <span>{resume.contact.phone}</span>
          <span>{resume.contact.location}</span>
          <span>{resume.contact.website}</span>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="resume-heading">Profile</h2>
        <p className="mt-3 text-sm font-medium leading-7 text-[#33343b]">{resume.summary}</p>
      </section>

      <section className="mt-8">
        <h2 className="resume-heading">Experience</h2>
        <div className="mt-4 space-y-6">
          {resume.experience.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-signal text-xl font-black leading-tight tracking-[-0.04em]">{item.role}</h3>
                  <p className="text-sm font-black text-[#4b4b4b]">
                    {item.company} - {item.location}
                  </p>
                </div>
                <p className="text-sm font-black text-[#777]">
                  {item.start} - {item.end}
                </p>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-7 text-[#33343b] marker:text-[#00796f]">
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-7 md:grid-cols-[1fr_0.85fr]">
        <section>
          <h2 className="resume-heading">Education</h2>
          <div className="mt-4 space-y-3">
            {resume.education.map((item) => (
              <div key={item.id} className="text-sm">
                <p className="font-signal font-black tracking-[-0.03em]">{item.degree}</p>
                <p className="font-medium text-[#4b4b4b]">
                  {item.school} - {item.location}
                </p>
                <p className="font-black text-[#777]">{item.graduation}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="resume-heading">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {resume.skills.filter(Boolean).map((skill) => (
              <span key={skill} className="rounded-full bg-[#b9ff66] px-3 py-1.5 text-xs font-black text-[#123c3a]">
                {skill}
              </span>
            ))}
          </div>
        </section>
      </div>

      {resume.certifications.length > 0 && (
        <section className="mt-8">
          <h2 className="resume-heading">Certifications</h2>
          <p className="mt-3 text-sm font-medium text-[#33343b]">{resume.certifications.filter(Boolean).join(", ")}</p>
        </section>
      )}
    </article>
  );
}

