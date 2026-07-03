"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  GripVertical,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2
} from "lucide-react";
import { ResumePreview, resumeTemplates } from "@careerlaunch/rendering";
import {
  defaultSectionOrder,
  type EducationItem,
  type ExperienceItem,
  type ProjectItem,
  type ResumeDocument,
  type ResumeSectionId,
  type ResumeTemplateId
} from "@careerlaunch/domain";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import type { ApplyOperation } from "@careerlaunch/ai";
import { HealthDashboard } from "./_analysis/health-dashboard";
import { JobMatchPanel } from "./_analysis/job-match-panel";
import { CoverLetterPanel } from "./_analysis/cover-letter-panel";

type SaveState = "Saved" | "Unsaved" | "Saving" | "Error";
type ValidationErrors = Partial<Record<string, string>>;

const sectionLabels: Record<ResumeSectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects"
};

export function ResumeBuilder({ initialResume }: { initialResume: ResumeDocument }) {
  const [resume, setResume] = useState<ResumeDocument>(() => normalizeResume(initialResume));
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [exportState, setExportState] = useState<"Idle" | "Exporting" | "Error">("Idle");
  const savedSnapshot = useRef(JSON.stringify(normalizeResume(initialResume)));

  const validation = useMemo(() => validateResume(resume), [resume]);
  const hasValidationErrors = Object.keys(validation).length > 0;

  useEffect(() => {
    const snapshot = JSON.stringify(resume);
    if (snapshot === savedSnapshot.current) return;

    setSaveState("Unsaved");
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSaveState("Saving");
      try {
        const response = await fetch(`/api/resumes/${resume.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resume),
          signal: controller.signal
        });

        if (!response.ok) throw new Error("Save failed");
        savedSnapshot.current = snapshot;
        setSaveState("Saved");
      } catch (error) {
        if (!controller.signal.aborted) setSaveState("Error");
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [resume]);

  function patchResume(patch: Partial<ResumeDocument>) {
    setResume((current) => ({ ...current, ...patch }));
  }

  function updateContact(field: keyof ResumeDocument["contact"], value: string) {
    setResume((current) => ({
      ...current,
      contact: { ...current.contact, [field]: value }
    }));
  }

  function addExperience() {
    setResume((current) => ({
      ...current,
      experience: [
        ...current.experience,
        { id: makeId("exp"), role: "", company: "", location: "", start: "", end: "", bullets: [""] }
      ]
    }));
  }

  function updateExperience(id: string, patch: Partial<ExperienceItem>) {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function addEducation() {
    setResume((current) => ({
      ...current,
      education: [...current.education, { id: makeId("edu"), school: "", degree: "", location: "", graduation: "" }]
    }));
  }

  function updateEducation(id: string, patch: Partial<EducationItem>) {
    setResume((current) => ({
      ...current,
      education: current.education.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function addProject() {
    setResume((current) => ({
      ...current,
      projects: [...current.projects, { id: makeId("proj"), name: "", description: "", bullets: [""] }]
    }));
  }

  function updateProject(id: string, patch: Partial<ProjectItem>) {
    setResume((current) => ({
      ...current,
      projects: current.projects.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function updateList(section: "skills" | "certifications", index: number, value: string) {
    setResume((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  }

  function addListItem(section: "skills" | "certifications") {
    setResume((current) => ({ ...current, [section]: [...current[section], ""] }));
  }

  function removeListItem(section: "skills" | "certifications", index: number) {
    setResume((current) => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function moveListItem(section: "skills" | "certifications", index: number, direction: -1 | 1) {
    setResume((current) => ({ ...current, [section]: moveItem(current[section], index, direction) }));
  }

  function moveSection(section: ResumeSectionId, direction: -1 | 1) {
    setResume((current) => ({
      ...current,
      sectionOrder: moveItem(normalizeSectionOrder(current.sectionOrder), normalizeSectionOrder(current.sectionOrder).indexOf(section), direction)
    }));
  }

  function resetDraft() {
    savedSnapshot.current = "";
    setResume(normalizeResume(initialResume));
  }

  async function handleApplySuggestion(operations: ApplyOperation[]) {
    try {
      const response = await fetch(`/api/resumes/${resume.id}/suggestions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 409) {
          return { error: body.error ?? "Suggestion target is stale. Re-analyze the resume." };
        }
        return { error: body.error ?? "Failed to apply suggestion" };
      }

      const data = await response.json();

      // Update local resume state so the preview reflects changes
      savedSnapshot.current = "";
      setResume(normalizeResume(data.updatedResume));

      return { appliedChanges: data.appliedChanges };
    } catch {
      return { error: "Network error. Please try again." };
    }
  }

  async function exportPdf() {
    if (hasValidationErrors) return;
    setExportState("Exporting");

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id })
      });

      if (!response.ok) throw new Error("PDF export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resume.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportState("Idle");
    } catch (error) {
      setExportState("Error");
    }
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
              <h1 className="font-signal truncate text-2xl font-black leading-none tracking-[-0.06em]">{resume.title || "Untitled resume"}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={saveBadgeClass(saveState)} aria-live="polite">
              <Save size={16} /> {saveState}
            </span>
            {hasValidationErrors && <span className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700">Fix required fields</span>}
            <button className={secondaryButtonClass} onClick={resetDraft} type="button">
              <RotateCcw size={18} /> Reset
            </button>
            <button className={primaryButtonClass} onClick={exportPdf} type="button" disabled={exportState === "Exporting" || hasValidationErrors}>
              <Download size={18} /> {exportState === "Exporting" ? "Exporting" : "Export PDF"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 xl:grid-cols-[460px_1fr]">
        <aside className="no-print space-y-5">
          <HealthDashboard resumeId={resume.id} onApplySuggestion={handleApplySuggestion} />
          <JobMatchPanel resumeId={resume.id} onApplySuggestion={handleApplySuggestion} />
          <CoverLetterPanel resumeId={resume.id} />

          <Panel title="Target">
            <div className="space-y-3">
              <Field label="Resume title" value={resume.title} error={validation.title} onChange={(value) => patchResume({ title: value })} />
              <Field label="Target role" value={resume.targetRole} onChange={(value) => patchResume({ targetRole: value })} />
            </div>
          </Panel>

          <Panel
            title="Template"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-1.5 text-xs font-black text-[#123c3a]">
                <Palette size={15} /> {resumeTemplates.length} styles
              </span>
            }
          >
            <TemplateGallery selectedTemplateId={resume.templateId} onSelect={(templateId) => patchResume({ templateId })} />
          </Panel>
          <Panel title="Contact">
            <div className="space-y-3">
              <Field label="Full name" value={resume.contact.fullName} error={validation.fullName} onChange={(value) => updateContact("fullName", value)} />
              <Field label="Email" value={resume.contact.email} error={validation.email} onChange={(value) => updateContact("email", value)} />
              <Field label="Phone" value={resume.contact.phone} error={validation.phone} onChange={(value) => updateContact("phone", value)} />
              <Field label="Location" value={resume.contact.location} onChange={(value) => updateContact("location", value)} />
              <Field label="Website" value={resume.contact.website} onChange={(value) => updateContact("website", value)} />
            </div>
          </Panel>

          <Panel title="Section order">
            <div className="space-y-2">
              {normalizeSectionOrder(resume.sectionOrder).map((section, index, sections) => (
                <div key={section} className="flex items-center gap-2 rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-2">
                  <GripVertical size={17} className="text-[#4b4b4b]/55" />
                  <span className="flex-1 text-sm font-black">{sectionLabels[section]}</span>
                  <IconButton label={`Move ${sectionLabels[section]} up`} disabled={index === 0} onClick={() => moveSection(section, -1)}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton label={`Move ${sectionLabels[section]} down`} disabled={index === sections.length - 1} onClick={() => moveSection(section, 1)}>
                    <ArrowDown size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Summary" action={<button className={tinyButtonClass} type="button" onClick={() => patchResume({ summary: "" })}><Trash2 size={15} /> Clear</button>}>
            <label className="block">
              <span className={labelClass}>Professional summary</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-28 resize-y ${validation.summary ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                value={resume.summary}
                onChange={(event) => patchResume({ summary: event.target.value })}
              />
              <ErrorText message={validation.summary} />
            </label>
          </Panel>

          <Panel title="Experience" action={<button className={tinyButtonClass} type="button" onClick={addExperience}><Plus size={15} /> Add role</button>}>
            <StackEmpty when={resume.experience.length === 0} label="No experience yet." action="Add a role to build the work history section." />
            <div className="space-y-4">
              {resume.experience.map((item, index) => (
                <ItemCard
                  key={item.id}
                  title={item.role || `Role ${index + 1}`}
                  onDelete={() => setResume((current) => ({ ...current, experience: current.experience.filter((entry) => entry.id !== item.id) }))}
                  onMoveUp={() => setResume((current) => ({ ...current, experience: moveItem(current.experience, index, -1) }))}
                  onMoveDown={() => setResume((current) => ({ ...current, experience: moveItem(current.experience, index, 1) }))}
                  disableUp={index === 0}
                  disableDown={index === resume.experience.length - 1}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Role" value={item.role} error={validation[`experience.${item.id}.role`]} onChange={(value) => updateExperience(item.id, { role: value })} />
                    <Field label="Company" value={item.company} error={validation[`experience.${item.id}.company`]} onChange={(value) => updateExperience(item.id, { company: value })} />
                    <Field label="Location" value={item.location} onChange={(value) => updateExperience(item.id, { location: value })} />
                    <Field label="Start" value={item.start} onChange={(value) => updateExperience(item.id, { start: value })} />
                    <Field label="End" value={item.end} onChange={(value) => updateExperience(item.id, { end: value })} />
                  </div>
                  <BulletEditor
                    label="Impact bullets"
                    bullets={item.bullets}
                    onChange={(bullets) => updateExperience(item.id, { bullets })}
                  />
                </ItemCard>
              ))}
            </div>
          </Panel>

          <Panel title="Education" action={<button className={tinyButtonClass} type="button" onClick={addEducation}><Plus size={15} /> Add school</button>}>
            <StackEmpty when={resume.education.length === 0} label="No education added." action="Add a school, degree, or training program." />
            <div className="space-y-4">
              {resume.education.map((item, index) => (
                <ItemCard
                  key={item.id}
                  title={item.degree || `Education ${index + 1}`}
                  onDelete={() => setResume((current) => ({ ...current, education: current.education.filter((entry) => entry.id !== item.id) }))}
                  onMoveUp={() => setResume((current) => ({ ...current, education: moveItem(current.education, index, -1) }))}
                  onMoveDown={() => setResume((current) => ({ ...current, education: moveItem(current.education, index, 1) }))}
                  disableUp={index === 0}
                  disableDown={index === resume.education.length - 1}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="School" value={item.school} error={validation[`education.${item.id}.school`]} onChange={(value) => updateEducation(item.id, { school: value })} />
                    <Field label="Degree" value={item.degree} error={validation[`education.${item.id}.degree`]} onChange={(value) => updateEducation(item.id, { degree: value })} />
                    <Field label="Location" value={item.location} onChange={(value) => updateEducation(item.id, { location: value })} />
                    <Field label="Graduation" value={item.graduation} onChange={(value) => updateEducation(item.id, { graduation: value })} />
                  </div>
                </ItemCard>
              ))}
            </div>
          </Panel>

          <EditableListPanel
            title="Skills"
            addLabel="Add skill"
            emptyLabel="No skills listed."
            emptyAction="Add role-matched keywords for the job description."
            values={resume.skills}
            onAdd={() => addListItem("skills")}
            onChange={(index, value) => updateList("skills", index, value)}
            onDelete={(index) => removeListItem("skills", index)}
            onMove={(index, direction) => moveListItem("skills", index, direction)}
          />

          <EditableListPanel
            title="Certifications"
            addLabel="Add certification"
            emptyLabel="No certifications added."
            emptyAction="Add certificates, licenses, or completed courses."
            values={resume.certifications}
            onAdd={() => addListItem("certifications")}
            onChange={(index, value) => updateList("certifications", index, value)}
            onDelete={(index) => removeListItem("certifications", index)}
            onMove={(index, direction) => moveListItem("certifications", index, direction)}
          />

          <Panel title="Projects" action={<button className={tinyButtonClass} type="button" onClick={addProject}><Plus size={15} /> Add project</button>}>
            <StackEmpty when={resume.projects.length === 0} label="No projects added." action="Add portfolio, volunteer, academic, or internal work." />
            <div className="space-y-4">
              {resume.projects.map((item, index) => (
                <ItemCard
                  key={item.id}
                  title={item.name || `Project ${index + 1}`}
                  onDelete={() => setResume((current) => ({ ...current, projects: current.projects.filter((entry) => entry.id !== item.id) }))}
                  onMoveUp={() => setResume((current) => ({ ...current, projects: moveItem(current.projects, index, -1) }))}
                  onMoveDown={() => setResume((current) => ({ ...current, projects: moveItem(current.projects, index, 1) }))}
                  disableUp={index === 0}
                  disableDown={index === resume.projects.length - 1}
                >
                  <div className="space-y-3">
                    <Field label="Project name" value={item.name} error={validation[`project.${item.id}.name`]} onChange={(value) => updateProject(item.id, { name: value })} />
                    <label className="block">
                      <span className={labelClass}>Description</span>
                      <textarea className={`${fieldClass} mt-1 min-h-20 resize-y`} value={item.description} onChange={(event) => updateProject(item.id, { description: event.target.value })} />
                    </label>
                  </div>
                  <BulletEditor label="Project bullets" bullets={item.bullets} onChange={(bullets) => updateProject(item.id, { bullets })} />
                </ItemCard>
              ))}
            </div>
          </Panel>
        </aside>

        <aside className="sticky top-6 hidden self-start xl:block">
          <div className="print-area max-h-[calc(100vh-8rem)] overflow-auto rounded-[30px] border border-[#123c3a]/10 bg-[#d8d4cb] p-4 shadow-inner xl:p-8">
            <ResumePreview resume={resume} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm transition hover:border-[#b9ff66]">
      <div className="flex items-center justify-between gap-3 border-b border-[#123c3a]/10 pb-3">
        <h2 className="font-signal text-xl font-black tracking-[-0.05em]">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TemplateGallery({ selectedTemplateId, onSelect }: { selectedTemplateId: ResumeTemplateId; onSelect: (templateId: ResumeTemplateId) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resumeTemplates.map((template) => {
        const selected = template.id === selectedTemplateId;
        const locked = template.premium;
        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={selected}
            disabled={locked}
            onClick={() => {
              if (locked) {
                alert("This template is available on the Pro plan. Upgrade to unlock all premium templates.");
                return;
              }
              onSelect(template.id);
            }}
            className={`min-h-[12rem] rounded-2xl border p-3 text-left transition ${
              locked
                ? "cursor-not-allowed opacity-60"
                : "hover:-translate-y-0.5 hover:shadow-md"
            } ${
              selected
                ? "border-[#123c3a] bg-[#f8f8f5] shadow-[0_0_0_3px]"
                : "border-[#123c3a]/10 bg-white"
            }`}
            style={{
              ...(selected ? { boxShadow: `0 0 0 3px ${template.accentColor}88` } : {}),
              ...(selected ? { borderColor: template.accentColor } : {}),
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                {template.swatches.map((swatch) => (
                  <span key={swatch} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {locked && <Lock size={14} className="text-[#f59e0b]" />}
                <span className="rounded-lg border border-[#123c3a]/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#4b4b4b]">
                  {template.tone}
                </span>
              </div>
            </div>
            <div className="relative h-20 rounded-xl border border-[#123c3a]/10 bg-white p-3">
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
                  <span className="rounded bg-[#f59e0b] px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-white">
                    Premium
                  </span>
                </div>
              )}
              <div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: template.swatches[0] }} />
              <div className="mt-3 h-1.5 w-full rounded-full bg-[#123c3a]/15" />
              <div className="mt-2 h-1.5 w-5/6 rounded-full bg-[#123c3a]/15" />
              <div className="mt-3 flex gap-1.5">
                <span className="h-2 w-10 rounded-full" style={{ backgroundColor: template.swatches[1] }} />
                <span className="h-2 w-8 rounded-full bg-[#123c3a]/15" />
                <span className="h-2 w-12 rounded-full bg-[#123c3a]/15" />
              </div>
            </div>
            <h3 className="mt-3 text-sm font-black text-[#123c3a]">{template.name}</h3>
            <p className="mt-1 text-xs font-medium leading-5 text-[#4b4b4b]">{template.description}</p>
          </button>
        );
      })}
    </div>
  );
}
function Field({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className={`${fieldClass} mt-1 ${error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} />
      <ErrorText message={error} />
    </label>
  );
}

function BulletEditor({ label, bullets, onChange }: { label: string; bullets: string[]; onChange: (bullets: string[]) => void }) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <button className={tinyButtonClass} type="button" onClick={() => onChange([...bullets, ""])}>
          <Plus size={15} /> Add bullet
        </button>
      </div>
      <StackEmpty when={bullets.length === 0} label="No bullets yet." action="Add concise proof points with outcomes." />
      {bullets.map((bullet, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
          <textarea className={`${fieldClass} min-h-16 resize-y`} value={bullet} onChange={(event) => onChange(bullets.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
          <div className="flex flex-col gap-1">
            <IconButton label="Move bullet up" disabled={index === 0} onClick={() => onChange(moveItem(bullets, index, -1))}><ArrowUp size={15} /></IconButton>
            <IconButton label="Move bullet down" disabled={index === bullets.length - 1} onClick={() => onChange(moveItem(bullets, index, 1))}><ArrowDown size={15} /></IconButton>
            <IconButton label="Delete bullet" onClick={() => onChange(bullets.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></IconButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditableListPanel({
  title,
  addLabel,
  emptyLabel,
  emptyAction,
  values,
  onAdd,
  onChange,
  onDelete,
  onMove
}: {
  title: string;
  addLabel: string;
  emptyLabel: string;
  emptyAction: string;
  values: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <Panel title={title} action={<button className={tinyButtonClass} type="button" onClick={onAdd}><Plus size={15} /> {addLabel}</button>}>
      <StackEmpty when={values.length === 0} label={emptyLabel} action={emptyAction} />
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
            <input className={fieldClass} value={value} aria-label={`${title} item ${index + 1}`} onChange={(event) => onChange(index, event.target.value)} />
            <div className="flex gap-1">
              <IconButton label={`Move ${title} item up`} disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={15} /></IconButton>
              <IconButton label={`Move ${title} item down`} disabled={index === values.length - 1} onClick={() => onMove(index, 1)}><ArrowDown size={15} /></IconButton>
              <IconButton label={`Delete ${title} item`} onClick={() => onDelete(index)}><Trash2 size={15} /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ItemCard({
  title,
  children,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown
}: {
  title: string;
  children: React.ReactNode;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-3">
      <div className="mb-3 flex items-center gap-2">
        <GripVertical size={17} className="text-[#4b4b4b]/55" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-black">{title}</h3>
        <IconButton label="Move item up" disabled={disableUp} onClick={onMoveUp}><ArrowUp size={15} /></IconButton>
        <IconButton label="Move item down" disabled={disableDown} onClick={onMoveDown}><ArrowDown size={15} /></IconButton>
        <IconButton label="Delete item" onClick={onDelete}><Trash2 size={15} /></IconButton>
      </div>
      {children}
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="inline-grid h-9 w-9 place-items-center rounded-xl border border-[#123c3a]/10 bg-white text-[#123c3a] transition hover:border-[#123c3a] hover:bg-[#b9ff66] disabled:cursor-not-allowed disabled:opacity-35"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StackEmpty({ when, label, action }: { when: boolean; label: string; action: string }) {
  if (!when) return null;
  return (
    <div className="rounded-2xl border border-dashed border-[#123c3a]/20 bg-[#f8f8f5] p-4 text-sm">
      <p className="font-black text-[#123c3a]">{label}</p>
      <p className="mt-1 font-medium leading-5 text-[#4b4b4b]">{action}</p>
    </div>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-black text-red-700">{message}</p>;
}

function normalizeResume(resume: ResumeDocument): ResumeDocument {
  return { ...resume, templateId: normalizeTemplateId(resume.templateId), sectionOrder: normalizeSectionOrder(resume.sectionOrder) };
}

function normalizeTemplateId(value: ResumeTemplateId | undefined): ResumeTemplateId {
  const template = resumeTemplates.find((item) => item.id === value);
  return template?.id ?? "modern";
}
function normalizeSectionOrder(value: ResumeSectionId[] | undefined): ResumeSectionId[] {
  const ordered = Array.isArray(value) ? value.filter((section): section is ResumeSectionId => defaultSectionOrder.includes(section)) : [];
  return [...ordered, ...defaultSectionOrder.filter((section) => !ordered.includes(section))];
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function validateResume(resume: ResumeDocument): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!resume.title.trim()) errors.title = "Resume title is required.";
  if (!resume.contact.fullName.trim()) errors.fullName = "Full name is required.";
  if (!resume.contact.email.trim()) errors.email = "Email is required.";
  if (resume.contact.email.trim() && !/^\S+@\S+\.\S+$/.test(resume.contact.email)) errors.email = "Use a valid email address.";
  if (!resume.contact.phone.trim()) errors.phone = "Phone is required.";
  if (resume.summary.trim().length > 0 && resume.summary.trim().length < 60) errors.summary = "Use at least 60 characters or leave it empty.";

  resume.experience.forEach((item) => {
    if (!item.role.trim()) errors[`experience.${item.id}.role`] = "Role is required.";
    if (!item.company.trim()) errors[`experience.${item.id}.company`] = "Company is required.";
  });

  resume.education.forEach((item) => {
    if (!item.school.trim()) errors[`education.${item.id}.school`] = "School is required.";
    if (!item.degree.trim()) errors[`education.${item.id}.degree`] = "Degree is required.";
  });

  resume.projects.forEach((item) => {
    if (!item.name.trim()) errors[`project.${item.id}.name`] = "Project name is required.";
  });

  return errors;
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveBadgeClass(saveState: SaveState) {
  const color = saveState === "Error"
    ? "border-red-200 bg-red-50 text-red-700"
    : saveState === "Unsaved"
      ? "border-[#e0aa22]/30 bg-[#fff7df] text-[#7b5300]"
      : "border-[#123c3a]/10 bg-white text-[#123c3a]";
  return `inline-flex min-h-10 items-center gap-2 rounded-[14px] border px-3 text-sm font-black ${color}`;
}

const tinyButtonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-1.5 text-xs font-black text-[#123c3a] transition hover:border-[#123c3a] hover:bg-[#b9ff66]";