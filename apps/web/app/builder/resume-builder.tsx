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
import { toast } from "sonner";
import { ResumePreview, resumeTemplates } from "@careerlaunch/rendering";
import {
  defaultSectionOrder,
  validateResumeWithSchema,
  type EducationItem,
  type ExperienceItem,
  type ProjectItem,
  type ReferenceItem,
  type ResumeDocument,
  type ResumeSectionId,
  type ResumeTemplateId
} from "@careerlaunch/domain";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import type { ApplyOperation } from "@careerlaunch/ai";
import { HealthDashboard } from "./_analysis/health-dashboard";
import { TailoringPanel } from "./_analysis/tailoring-panel";
import { CoverLetterPanel } from "./_analysis/cover-letter-panel";
import { useAnalytics } from "../../lib/analytics";
import { AppHeader } from "../../components/app-header";

type SaveState = "Saved" | "Unsaved" | "Saving" | "Error";
type EditableStringListSection = 'skills' | 'certifications' | 'professionalQualities' | 'achievements' | 'languages' | 'awards' | 'memberships' | 'publications' | 'training';
type UpgradePrompt = {
  title: string;
  message: string;
  upgradeUrl: string;
};

const sectionLabels: Record<ResumeSectionId, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  licenses: 'Licenses',
  certifications: 'Certifications',
  professionalQualities: 'Professional Qualities',
  achievements: 'Achievements',
  awards: 'Awards',
  memberships: 'Memberships',
  publications: 'Publications',
  training: 'Training',
  projects: 'Projects',
  languages: 'Languages',
  references: 'References',
  volunteer: 'Volunteer Experience'
};

export function ResumeBuilder({ initialResume, canUsePremiumTemplates }: { initialResume: ResumeDocument; canUsePremiumTemplates: boolean }) {
  const analytics = useAnalytics();
  const [resume, setResume] = useState<ResumeDocument>(() => normalizeResume(initialResume));
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [exportState, setExportState] = useState<"Idle" | "Exporting" | "Error">("Idle");
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const savedSnapshot = useRef(JSON.stringify(normalizeResume(initialResume)));
  // Track whether draft_edited has been fired this session to avoid event spam on each autosave
  const hasFiredEditEvent = useRef(false);

  const [mobileTab, setMobileTab] = useState<"preview" | "edit" | "analyze">("preview");
  const [templateJustChanged, setTemplateJustChanged] = useState(false);
  const validation = useMemo(() => validateResumeWithSchema(resume), [resume]);
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

        // Funnel: draft_edited (first save per session)
        if (!hasFiredEditEvent.current) {
          hasFiredEditEvent.current = true;
          analytics.capture("draft_edited", {
            resumeId: resume.id,
            templateId: resume.templateId,
            sectionCount: resume.sectionOrder.length,
            isImported: resume.title.startsWith("Imported Resume"),
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSaveState("Error");
          toast.error("Failed to save changes.");
        }
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

  function handleTemplateSelect(templateId: ResumeTemplateId) {
    patchResume({ templateId });
    setTemplateJustChanged(true);
    setTimeout(() => setTemplateJustChanged(false), 2000);
    toast.success("Template updated.");
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
    toast.success("Role added.");
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
    toast.success("School added.");
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
    toast.success("Project added.");
  }

  function updateProject(id: string, patch: Partial<ProjectItem>) {
    setResume((current) => ({
      ...current,
      projects: current.projects.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function addReference() {
    setResume((current) => ({
      ...current,
      references: [...current.references, { id: makeId("ref"), name: "", title: "", company: "", phone: "", email: "", relationship: "" }]
    }));
    toast.success("Reference added.");
  }

  function updateReference(id: string, patch: Partial<ReferenceItem>) {
    setResume((current) => ({
      ...current,
      references: current.references.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  }

  function updateList(section: EditableStringListSection, index: number, value: string) {
    setResume((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  }

  function addListItem(section: EditableStringListSection) {
    setResume((current) => ({ ...current, [section]: [...current[section], ""] }));
    toast.success(`${sectionLabels[section as ResumeSectionId] ?? section} item added.`);
  }

  function removeListItem(section: EditableStringListSection, index: number) {
    setResume((current) => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) }));
    toast.success(`${sectionLabels[section as ResumeSectionId] ?? section} item removed.`);
  }

  function moveListItem(section: EditableStringListSection, index: number, direction: -1 | 1) {
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
    toast.success("Draft reset to original state.");
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
    if (hasValidationErrors) {
      toast.error("Fix required fields before exporting.");
      return;
    }
    setExportState("Exporting");
    toast.loading("Preparing your PDF...", { id: "pdf-export" });

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id })
      });

      if (response.status === 402 || response.status === 403) {
        const data = await response.json().catch(() => ({}));
        setUpgradePrompt({
          title: "Monthly export limit reached",
          message: formatUpgradeMessage(data.error),
          upgradeUrl: data.upgradeUrl ?? "/billing",
        });
        setExportState("Idle");
        return;
      }

      if (!response.ok) throw new Error("PDF export failed");

      // Funnel: pdf_exported (client-side)
      analytics.capture("pdf_exported", {
        resumeId: resume.id,
        templateId: resume.templateId,
        sectionCount: resume.sectionOrder.length,
        hasSummary: resume.summary.length > 0,
        experienceCount: resume.experience.length,
        educationCount: resume.education.length,
        skillsCount: resume.skills.length,
      });

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
      toast.success("PDF exported successfully.", { id: "pdf-export" });
    } catch (error) {
      setExportState("Error");
      toast.error("PDF export failed. Please try again.", { id: "pdf-export" });
    }
  }

  return (
    <main className="signal-site min-h-screen overflow-x-hidden pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <AppHeader actions={
        <>
          <span className={saveBadgeClass(saveState)} aria-live="polite">
            <Save className="w-5 h-5 shrink-0 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">{saveState}</span>
          </span>
          {hasValidationErrors && <span className="hidden truncate rounded-[14px] border border-red-200 bg-red-50 px-2 py-1.5 text-[0.65rem] font-black text-red-700 sm:inline-block sm:px-3 sm:py-2 sm:text-sm">Fix required fields</span>}
          <button className={`${secondaryButtonClass} min-h-11 w-11 flex-shrink-0 rounded-xl px-0 sm:min-h-10 sm:w-auto sm:px-3`} onClick={resetDraft} type="button" aria-label="Reset draft">
            <RotateCcw className="w-5 h-5 shrink-0" /> <span className="hidden sm:inline">Reset</span>
          </button>
          <button className={`${primaryButtonClass} min-h-11 w-11 flex-shrink-0 rounded-xl px-0 sm:min-h-10 sm:w-auto sm:px-3`} onClick={exportPdf} type="button" disabled={exportState === "Exporting" || hasValidationErrors} aria-label="Export PDF">
            <Download className="w-5 h-5 shrink-0" /> <span className="hidden sm:inline">{exportState === "Exporting" ? "Exporting" : "Export PDF"}</span>
          </button>
        </>
      }>
        <Link href="/dashboard" className={`${secondaryButtonClass} min-h-11 w-11 flex-shrink-0 rounded-full px-0 sm:min-h-10 sm:w-10`} aria-label="Back to dashboard">
          <ArrowLeft className="w-5 h-5 shrink-0" />
        </Link>
        <div className="min-w-0">
          <p className="hidden font-mono text-[0.55rem] font-black uppercase tracking-[0.2em] text-[#00796f] sm:block sm:text-xs">Resume Builder</p>
          <h1 className="font-signal truncate text-sm font-black leading-none tracking-[-0.06em] sm:text-2xl">{resume.title || "Untitled resume"}</h1>
        </div>
      </AppHeader>

      {/* Mobile tab switcher */}
      <div className="sticky-tab-strip -mx-4 z-10 mt-8 border-b border-[#123c3a]/10 bg-[#f3f3f3]/85 px-4 backdrop-blur-xl xl:hidden">
        <nav className="flex h-12 min-h-12 gap-1 overflow-visible" role="tablist" aria-label="Builder view">
          {(["preview", "edit", "analyze"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={`box-border flex flex-1 items-center justify-center rounded-t-xl px-2 text-sm font-black uppercase tracking-[0.08em] transition ${
                mobileTab === tab
                  ? "h-12 min-h-12 bg-white text-[#00796f] shadow-[0_-1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#4b4b4b]/60 hover:bg-white/40 hover:text-[#123c3a]"
              }`}
            >
              {tab === "preview" && "Preview"}
              {tab === "edit" && "Edit"}
              {tab === "analyze" && "Analyze"}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl min-w-0 gap-3 px-4 py-4 sm:gap-6 sm:py-7 xl:h-[calc(100vh-60px)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:overflow-hidden">
        {/* Sidebar: shown on desktop; on mobile only when edit or analyze tab is active */}
        <aside className={`no-print min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-5 xl:overflow-y-auto xl:pb-4 ${mobileTab !== "edit" && mobileTab !== "analyze" ? "hidden xl:block" : ""}`}>
          {/* Mobile: analysis panels - only visible on analyze tab */}
          <div className={`${mobileTab !== "analyze" && mobileTab !== "edit" ? "hidden xl:block" : mobileTab === "edit" ? "hidden xl:block" : ""}`}>
            <HealthDashboard resumeId={resume.id} onApplySuggestion={handleApplySuggestion} />
            <TailoringPanel resumeId={resume.id} onApplySuggestion={handleApplySuggestion} />
            <CoverLetterPanel resumeId={resume.id} initialTargetRole={resume.targetRole} onTargetRoleChange={(role) => patchResume({ targetRole: role })} onUpgradeRequired={setUpgradePrompt} />
          </div>

          {/* Mobile: editor panels - only visible on edit tab */}
          <div className={`${mobileTab !== "edit" && mobileTab !== "analyze" ? "hidden xl:block" : mobileTab === "analyze" ? "hidden xl:block" : ""}`}>
          <Panel title="Target">
            <div className="space-y-3">
              <Field label="File name" value={resume.title} error={validation.title} onChange={(value) => patchResume({ title: value })} />
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
            <TemplateGallery selectedTemplateId={resume.templateId} canUsePremiumTemplates={canUsePremiumTemplates} onSelect={handleTemplateSelect} />
          </Panel>
          <Panel title="Contact">
            <div className="space-y-3">
              <Field label="Full name" value={resume.contact.fullName} error={validation.fullName} onChange={(value) => updateContact("fullName", value)} />
              <Field label="Email" value={resume.contact.email} error={validation.email} onChange={(value) => updateContact("email", value)} />
              <Field label="Phone" value={resume.contact.phone} error={validation.phone} onChange={(value) => updateContact("phone", value)} />
              <Field label="Location" value={resume.contact.location} onChange={(value) => updateContact("location", value)} />
              <Field label="Website" value={resume.contact.website} onChange={(value) => updateContact("website", value)} />
              <Field label="LinkedIn" value={resume.contact.linkedin} onChange={(value) => updateContact("linkedin", value)} />
              <Field label="GitHub" value={resume.contact.github} onChange={(value) => updateContact("github", value)} />
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
            <div className="space-y-2 sm:space-y-4">
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
            <div className="space-y-2 sm:space-y-4">
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

          <EditableListPanel
            title="Professional Qualities"
            addLabel="Add quality"
            emptyLabel="No professional qualities listed."
            emptyAction="Add top traits or strengths like 'Detail-oriented', 'Team player'."
            values={resume.professionalQualities}
            onAdd={() => addListItem("professionalQualities")}
            onChange={(index, value) => updateList("professionalQualities", index, value)}
            onDelete={(index) => removeListItem("professionalQualities", index)}
            onMove={(index, direction) => moveListItem("professionalQualities", index, direction)}
          />

          <Panel title="Projects" action={<button className={tinyButtonClass} type="button" onClick={addProject}><Plus size={15} /> Add project</button>}>
            <StackEmpty when={resume.projects.length === 0} label="No projects added." action="Add portfolio, volunteer, academic, or internal work." />
            <div className="space-y-2 sm:space-y-4">
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

          <Panel title="References" action={<button className={tinyButtonClass} type="button" onClick={addReference}><Plus size={15} /> Add reference</button>}>
            <StackEmpty when={resume.references.length === 0} label="No references added." action="Add professional or character references." />
            <div className="space-y-2 sm:space-y-4">
              {resume.references.map((item, index) => (
                <ItemCard
                  key={item.id}
                  title={item.name || `Reference ${index + 1}`}
                  onDelete={() => setResume((current) => ({ ...current, references: current.references.filter((ref) => ref.id !== item.id) }))}
                  onMoveUp={() => setResume((current) => ({ ...current, references: moveItem(current.references, index, -1) }))}
                  onMoveDown={() => setResume((current) => ({ ...current, references: moveItem(current.references, index, 1) }))}
                  disableUp={index === 0}
                  disableDown={index === resume.references.length - 1}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={item.name} error={validation[`reference.${item.id}.name`]} onChange={(value) => updateReference(item.id, { name: value })} />
                    <Field label="Job Title" value={item.title} onChange={(value) => updateReference(item.id, { title: value })} />
                    <Field label="Company" value={item.company} onChange={(value) => updateReference(item.id, { company: value })} />
                    <Field label="Phone" value={item.phone} onChange={(value) => updateReference(item.id, { phone: value })} />
                    <Field label="Email" value={item.email} onChange={(value) => updateReference(item.id, { email: value })} />
                    <Field label="Relationship" value={item.relationship} onChange={(value) => updateReference(item.id, { relationship: value })} />
                  </div>
                </ItemCard>
              ))}
            </div>
          </Panel>
          </div> {/* end editor panel group */}
        </aside>

        {/* Preview: shown on desktop; on mobile only when preview tab is active */}
        <aside className={`min-w-0 max-w-full xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto ${mobileTab !== "preview" ? "hidden" : "sticky top-[52px] -mx-4 block px-0"}`}>
          <div className="flex justify-center rounded-none border-0 bg-transparent p-0 shadow-none xl:rounded-[30px] xl:border xl:border-[#123c3a]/10 xl:bg-[#d8d4cb] xl:p-6 xl:shadow-inner">
            <div className="max-h-[calc(100vh-8rem)] w-full max-w-[900px] min-w-0 overflow-auto xl:rounded-xl">
              <ResumePreview resume={resume} />
            </div>
          </div>
        </aside>
      </div>
      {upgradePrompt && (
        <UpgradeModal
          prompt={upgradePrompt}
          onClose={() => setUpgradePrompt(null)}
        />
      )}
    </main>
  );
}

function UpgradeModal({ prompt, onClose }: { prompt: UpgradePrompt; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the modal
    const firstFocusable = el.querySelector<HTMLElement>("button, a, input, [tabindex]:not([tabindex='-1'])");
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      el.focus();
    }

    // Focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>("button, a, input, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div ref={ref} className="fixed inset-0 z-50 grid place-items-center bg-[#123c3a]/45 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" tabIndex={-1}>
      <div className="w-full max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 text-[#123c3a] shadow-2xl">
        <h2 id="upgrade-modal-title" className="font-signal text-2xl font-black tracking-[-0.05em]">
          {prompt.title}
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[#4b4b4b]">{prompt.message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <Link href={prompt.upgradeUrl} className={primaryButtonClass} onClick={onClose}>
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[#123c3a]/10 pb-2 sm:pb-3">
        <h2 className="min-w-0 flex-1 truncate font-signal text-sm font-black tracking-[-0.05em] sm:text-xl">{title}</h2>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
      <div className="mt-2 sm:mt-4">{children}</div>
    </section>
  );
}

function TemplateGallery({ selectedTemplateId, canUsePremiumTemplates, onSelect }: { selectedTemplateId: ResumeTemplateId; canUsePremiumTemplates: boolean; onSelect: (templateId: ResumeTemplateId) => void }) {
  return (
    <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
      {resumeTemplates.map((template) => {
        const selected = template.id === selectedTemplateId;
        const locked = template.premium && !canUsePremiumTemplates;
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
            className={`min-h-[10rem] rounded-2xl border p-2 text-left transition sm:min-h-[12rem] sm:p-3 ${
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
    <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
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
    <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-2 sm:p-3">
      <div className="mb-2 flex items-center gap-1.5 sm:mb-3 sm:gap-2">
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
    <div className="rounded-2xl border border-dashed border-[#123c3a]/20 bg-[#f8f8f5] p-3 text-sm sm:p-4">
      <p className="font-black text-[#123c3a]">{label}</p>
      <p className="mt-0.5 font-medium leading-5 text-[#4b4b4b] sm:mt-1">{action}</p>
    </div>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-black text-red-700">{message}</p>;
}

function formatUpgradeMessage(message: unknown) {
  if (typeof message !== "string" || !message.trim()) return "Upgrade to Professional for unlimited exports.";
  return message.replace(/^Monthly export limit reached\.\s*/i, "");
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
  const unique = [...new Set(ordered)];
  return [...unique, ...defaultSectionOrder.filter((section) => !unique.includes(section))];
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
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
  return `inline-flex min-h-9 items-center gap-1.5 rounded-[14px] border px-2 text-xs font-black sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm ${color}`;
}

const tinyButtonClass = "inline-flex min-h-8 items-center justify-center gap-1 rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-2 py-1 text-[0.65rem] font-black text-[#123c3a] transition hover:border-[#123c3a] hover:bg-[#b9ff66] sm:min-h-9 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="font-mono text-[0.6rem] font-black uppercase tracking-[0.2em] text-[#4b4b4b]/40">
        {label}
      </span>
      <span className="flex-1 border-t border-[#123c3a]/8" />
    </div>
  );
}
