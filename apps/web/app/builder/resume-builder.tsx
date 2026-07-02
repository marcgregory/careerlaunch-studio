"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RotateCcw, Save, Sparkles } from "lucide-react";
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
    <main className="min-h-screen bg-[#f6f3ee] text-slate-950">
      <header className="no-print sticky top-0 z-20 border-b border-slate-300 bg-[#f6f3ee]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className={secondaryButtonClass} aria-label="Back to dashboard">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">Resume Builder</p>
              <h1 className="text-xl font-black">{resume.title}</h1>
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[420px_1fr]">
        <aside className="no-print space-y-5">
          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase text-emerald-700">Resume score</p>
                <h2 className="mt-1 text-4xl font-black">{check.score}</h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-emerald-700 text-white">
                <Sparkles size={24} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {check.checks.map((item) => (
                <div key={item.id} className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">{item.label}</p>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Target</h2>
            <div className="mt-4 space-y-3">
              <Field label="Resume title" value={resume.title} onChange={(value) => setResume({ ...resume, title: value })} />
              <Field
                label="Target role"
                value={resume.targetRole}
                onChange={(value) => setResume({ ...resume, targetRole: value })}
              />
            </div>
          </section>

          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Contact</h2>
            <div className="mt-4 space-y-3">
              <Field label="Full name" value={resume.contact.fullName} onChange={(value) => updateContact("fullName", value)} />
              <Field label="Email" value={resume.contact.email} onChange={(value) => updateContact("email", value)} />
              <Field label="Phone" value={resume.contact.phone} onChange={(value) => updateContact("phone", value)} />
              <Field label="Location" value={resume.contact.location} onChange={(value) => updateContact("location", value)} />
              <Field label="Website" value={resume.contact.website} onChange={(value) => updateContact("website", value)} />
            </div>
          </section>

          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Summary</h2>
            <label className="mt-4 block">
              <span className={labelClass}>Professional summary</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-28 resize-y`}
                value={resume.summary}
                onChange={(event) => setResume({ ...resume, summary: event.target.value })}
              />
            </label>
          </section>

          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Current role</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </section>

          <section className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Skills</h2>
            <label className="mt-4 block">
              <span className={labelClass}>Comma-separated skills</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-24 resize-y`}
                value={resume.skills.join(", ")}
                onChange={(event) => updateSkills(event.target.value)}
              />
            </label>
          </section>
        </aside>

        <section className="print-area overflow-auto rounded-md border border-slate-300 bg-slate-200/70 p-4 xl:p-8">
          <ResumePreview resume={resume} />
        </section>
      </div>
    </main>
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
  if (status === "pass") return "rounded-sm bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-800";
  if (status === "warn") return "rounded-sm bg-amber-100 px-2 py-1 text-xs font-bold uppercase text-amber-800";
  return "rounded-sm bg-rose-100 px-2 py-1 text-xs font-bold uppercase text-rose-800";
}

function saveBadgeClass(saveState: "Saved" | "Saving" | "Error") {
  const color = saveState === "Error" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700";
  return `inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${color}`;
}
