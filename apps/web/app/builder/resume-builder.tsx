"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Gauge, RotateCcw, Save, Sparkles } from "lucide-react";
import { ResumePreview } from "@careerlaunch/rendering";
import { scoreResume, type ResumeDocument } from "@careerlaunch/domain";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

export function ResumeBuilder({ initialResume }: { initialResume: ResumeDocument }) {
  const [resume, setResume] = useState<ResumeDocument>(initialResume);
  const [saveState, setSaveState] = useState<"Saved" | "Saving" | "Error">("Saved");

  useEffect(() => {
    setSaveState("Saving");
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/resumes/${resume.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resume),
          signal: controller.signal
        });

        if (!response.ok) throw new Error("Save failed");
        setSaveState("Saved");
      } catch (error) {
        if (!controller.signal.aborted) setSaveState("Error");
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [resume]);

  const check = useMemo(() => scoreResume(resume), [resume]);

  function updateContact(field: keyof ResumeDocument["contact"], value: string) {
    setResume((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [field]: value
      }
    }));
  }

  function updateFirstExperience(field: "role" | "company" | "location" | "start" | "end", value: string) {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item, index) => (index === 0 ? { ...item, [field]: value } : item))
    }));
  }

  function updateFirstBullet(index: number, value: string) {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) =>
        itemIndex === 0
          ? {
              ...item,
              bullets: item.bullets.map((bullet, bulletIndex) => (bulletIndex === index ? value : bullet))
            }
          : item
      )
    }));
  }

  function updateSkills(value: string) {
    setResume((current) => ({
      ...current,
      skills: value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    }));
  }

  function resetDraft() {
    setResume(initialResume);
  }

  async function exportPdf() {
    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id })
    });

    if (response.ok) window.print();
  }

  return (
    <main className="signal-site min-h-screen text-[#123c3a]">
      <header className="no-print sticky top-0 z-20 border-b border-[#123c3a]/10 bg-[#f3f3f3]/88 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className={`${secondaryButtonClass} min-h-12 w-12 rounded-full px-0`} aria-label="Back to dashboard">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#00796f]">Resume Builder</p>
              <h1 className="font-signal truncate text-2xl font-black leading-none tracking-[-0.06em]">{resume.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={saveBadgeClass(saveState)}>
              <Save size={16} /> {saveState}
            </span>
            <button className={secondaryButtonClass} onClick={resetDraft} type="button">
              <RotateCcw size={18} /> Reset
            </button>
            <button className={primaryButtonClass} onClick={exportPdf} type="button">
              <Download size={18} /> Export PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 xl:grid-cols-[430px_1fr]">
        <aside className="no-print space-y-5">
          <section className="rounded-[30px] border border-[#123c3a] bg-[#123c3a] p-6 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#b9ff66]">Resume score</p>
                <h2 className="font-signal mt-2 text-7xl font-black leading-none tracking-[-0.08em]">{check.score}</h2>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                <Sparkles size={25} />
              </div>
            </div>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-white/45">
                <span>Signal scan</span>
                <Gauge size={18} className="text-[#b9ff66]" />
              </div>
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-[#b9ff66]" />
                <div className="h-2 w-5/6 rounded-full bg-white/18" />
                <div className="h-2 w-2/3 rounded-full bg-white/18" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {check.checks.map((item) => (
                <div key={item.id} className="border-t border-white/12 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{item.label}</p>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-5 text-white/62">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <Panel title="Target">
            <div className="space-y-3">
              <Field label="Resume title" value={resume.title} onChange={(value) => setResume({ ...resume, title: value })} />
              <Field
                label="Target role"
                value={resume.targetRole}
                onChange={(value) => setResume({ ...resume, targetRole: value })}
              />
            </div>
          </Panel>

          <Panel title="Contact">
            <div className="space-y-3">
              <Field label="Full name" value={resume.contact.fullName} onChange={(value) => updateContact("fullName", value)} />
              <Field label="Email" value={resume.contact.email} onChange={(value) => updateContact("email", value)} />
              <Field label="Phone" value={resume.contact.phone} onChange={(value) => updateContact("phone", value)} />
              <Field label="Location" value={resume.contact.location} onChange={(value) => updateContact("location", value)} />
              <Field label="Website" value={resume.contact.website} onChange={(value) => updateContact("website", value)} />
            </div>
          </Panel>

          <Panel title="Summary">
            <label className="block">
              <span className={labelClass}>Professional summary</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-28 resize-y`}
                value={resume.summary}
                onChange={(event) => setResume({ ...resume, summary: event.target.value })}
              />
            </label>
          </Panel>

          <Panel title="Current role">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role" value={resume.experience[0]?.role ?? ""} onChange={(value) => updateFirstExperience("role", value)} />
              <Field label="Company" value={resume.experience[0]?.company ?? ""} onChange={(value) => updateFirstExperience("company", value)} />
              <Field label="Location" value={resume.experience[0]?.location ?? ""} onChange={(value) => updateFirstExperience("location", value)} />
              <Field label="Start" value={resume.experience[0]?.start ?? ""} onChange={(value) => updateFirstExperience("start", value)} />
              <Field label="End" value={resume.experience[0]?.end ?? ""} onChange={(value) => updateFirstExperience("end", value)} />
            </div>
            <div className="mt-4 space-y-3">
              {resume.experience[0]?.bullets.map((bullet, index) => (
                <Field key={index} label={`Impact bullet ${index + 1}`} value={bullet} onChange={(value) => updateFirstBullet(index, value)} />
              ))}
            </div>
          </Panel>

          <Panel title="Skills">
            <label className="block">
              <span className={labelClass}>Comma-separated skills</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-24 resize-y`}
                value={resume.skills.join(", ")}
                onChange={(event) => updateSkills(event.target.value)}
              />
            </label>
          </Panel>
        </aside>

        <section className="print-area overflow-auto rounded-[30px] border border-[#123c3a]/10 bg-[#d8d4cb] p-4 shadow-inner xl:p-8">
          <ResumePreview resume={resume} />
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm transition hover:border-[#b9ff66]">
      <h2 className="font-signal border-b border-[#123c3a]/10 pb-3 text-xl font-black tracking-[-0.05em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className={`${fieldClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function statusClass(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "rounded-lg bg-[#b9ff66] px-2.5 py-1 text-xs font-black uppercase text-[#123c3a]";
  if (status === "warn") return "rounded-lg bg-[#fff1c7] px-2.5 py-1 text-xs font-black uppercase text-[#8a5a00]";
  return "rounded-lg bg-[#ffe1dc] px-2.5 py-1 text-xs font-black uppercase text-[#9f2f1c]";
}

function saveBadgeClass(saveState: "Saved" | "Saving" | "Error") {
  const color = saveState === "Error" ? "border-red-200 bg-red-50 text-red-700" : "border-[#123c3a]/10 bg-white text-[#123c3a]";
  return `inline-flex min-h-10 items-center gap-2 rounded-[14px] border px-3 text-sm font-black ${color}`;
}

