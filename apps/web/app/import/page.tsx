"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Loader2, Sparkles, AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { primaryButtonClass } from "@careerlaunch/ui";
import { useState } from "react";
import { useAnalytics } from "../../lib/analytics";
import type { ParseResult, ImportQuality, ExperienceItem, EducationItem, RecoveryResult } from "@careerlaunch/ai/import";

type ImportState = "idle" | "parsing" | "preview" | "saving" | "error";

export default function ImportPage() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [state, setState] = useState<ImportState>("idle");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");

  /** Whether the parser or AI was able to extract meaningful content */
  function hasAnyContent(): boolean {
    if (!result?.parsed) return false;
    const p = result.parsed;
    return !!(p.summary || (p.experience && p.experience.length > 0) || (p.education && p.education.length > 0));
  }

  function getQualityBanner(quality: ImportQuality, aiRecovered?: boolean, recoveredSections?: string[]): {
    icon: typeof AlertTriangle | typeof CheckCircle2;
    border: string;
    bg: string;
    title: string;
    description: string;
  } {
    // AI recovery successfully reconstructed sections — positive messaging
    if (aiRecovered && recoveredSections && recoveredSections.length > 0) {
      return {
        icon: CheckCircle2,
        border: "border-green-200",
        bg: "bg-green-50",
        title: "Your resume imported successfully — we fixed a few things.",
        description: `We automatically repaired ${recoveredSections.join(", ")}. Everything looks good — you can create a polished draft right away.`,
      };
    }

    switch (quality) {
      case "excellent":
      case "good":
        return {
          icon: CheckCircle2,
          border: "border-green-200",
          bg: "bg-green-50",
          title: "Your resume imported successfully.",
          description: "All sections look great. You can create a polished draft and start customizing.",
        };
      case "fair":
        return {
          icon: AlertTriangle,
          border: "border-amber-200",
          bg: "bg-amber-50",
          title: "Most sections imported, a few need your help.",
          description: "Some sections have limited data. You can create a draft now and fill in the missing details in the builder.",
        };
      case "poor":
        return {
          icon: AlertTriangle,
          border: "border-orange-200",
          bg: "bg-orange-50",
          title: "Import had some trouble — don't worry.",
          description: "We saved what we could. You can create a draft and edit everything in the builder.",
        };
      case "failed":
        return {
          icon: AlertTriangle,
          border: "border-red-200",
          bg: "bg-red-50",
          title: "We couldn't parse that completely.",
          description: "Some key parts were missed. You can still create a draft and fill everything in manually.",
        };
    }
  }

  async function handleParse() {
    if (!text.trim()) return;

    setState("parsing");
    setError("");

    try {
      const res = await fetch("/api/import/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: ParseResult = await res.json();
      setResult(data);
      setState("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setState("error");
    }
  }

  async function handleCreateDraft() {
    if (!result?.parsed) return;

    setState("saving");

    try {
      // Merge parsed data with defaults to form a full ResumeDocument
      const resume = {
        title: `Imported Resume - ${result.parsed.contact?.fullName || "Unnamed"}`,
        targetRole: "",
        ...result.parsed,
        skills: result.parsed.skills || [],
        experience: result.parsed.experience || [],
        education: result.parsed.education || [],
        certifications: result.parsed.certifications || [],
        professionalQualities: result.parsed.professionalQualities || [],
        projects: result.parsed.projects || [],
        summary: result.parsed.summary || "",
      };

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create" }));
        throw new Error(err.error || "Failed to create resume");
      }

      const created = await res.json();
      analytics.capture("resume_imported", {
        confidence: result.confidence,
        importQuality: result.importQuality,
      });
      router.push(`/builder?resumeId=${created.resume.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create resume");
      setState("preview");
    }
  }

  function handleReset() {
    setState("idle");
    setText("");
    setResult(null);
    setError("");
  }

  return (
    <main className="signal-site min-h-screen px-5 py-6 text-[#123c3a]">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#123c3a]/10 pb-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#4b4b4b] transition hover:text-[#123c3a]"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="font-signal mt-4 text-4xl font-black tracking-[-0.06em]">
              Import resume
            </h1>
            <p className="mt-2 text-sm font-medium text-[#4b4b4b]">
              Paste your existing resume text below. We&apos;ll format it into a polished draft.
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div className="text-sm font-medium text-red-700">{error}</div>
          </div>
        )}

        {/* State: idle */}
        {state === "idle" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
              <label htmlFor="import-text" className="flex items-center gap-3 text-sm font-black text-[#4b4b4b] uppercase tracking-[0.1em]">
                <FileText size={18} />
                Paste your resume text
              </label>
              <textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your resume text here..."

                className="mt-4 min-h-[320px] w-full rounded-xl border border-[#123c3a]/15 bg-[#fafafa] p-4 text-sm font-medium leading-7 text-[#33343b] placeholder:text-[#999] focus:border-[#b9ff66] focus:outline-none focus:ring-2 focus:ring-[#b9ff66]/30"
              />
              <div className="mt-3 text-xs font-medium text-[#999]">
                {text.length.toLocaleString()} characters
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Link href="/dashboard" className="text-xs font-black uppercase tracking-[0.12em] text-[#999] transition hover:text-[#123c3a]">
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleParse}
                disabled={!text.trim()}
                className={primaryButtonClass + " disabled:opacity-40"}
              >
                <Sparkles size={18} />
                Parse resume
              </button>
            </div>
          </div>
        )}

        {/* State: parsing */}
        {state === "parsing" && (
          <div className="mt-16 flex flex-col items-center gap-5">
            <Loader2 size={36} className="animate-spin text-[#b9ff66]" />
            <p className="text-sm font-bold text-[#4b4b4b]">Reading your resume...</p>
          </div>
        )}

        {/* State: preview or saving */}
        {(state === "preview" || state === "saving") && result && (
          <div className="mt-8 space-y-6">
            {/* Import quality banner — user-friendly messaging */}
            {(() => {
              const banner = getQualityBanner(result.importQuality, result.aiRecovered, result.aiRecoveredSections);
              const Icon = banner.icon;
              return (
                <div className={`flex items-start gap-3 rounded-2xl border ${banner.border} ${banner.bg} p-4`} role="alert">
                  <Icon size={20} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{banner.title}</p>
                    <p className="mt-1 text-sm">{banner.description}</p>
                  </div>
                </div>
              );
            })()}

            {/* Parsed preview — shows the resume content, not debug data */}
            <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
              <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">
                {result.parsed.contact?.fullName || "Unknown name"}
              </h2>
              <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
                {[result.parsed.contact?.email, result.parsed.contact?.phone, result.parsed.contact?.location]
                  .filter(Boolean)
                  .join("  |  ")}
              </p>

              {result.parsed.summary && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Summary
                    {result.aiRecoveredSections?.includes("summary") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#33343b]">{result.parsed.summary}</p>
                </div>
              )}

              {result.parsed.experience && result.parsed.experience.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Experience ({result.parsed.experience.length})
                    {result.aiRecoveredSections?.includes("experience") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  <div className="mt-2 space-y-3">
                    {result.parsed.experience.map((exp) => (
                      <div key={exp.id} className="border-l-2 border-[#b9ff66] pl-3">
                        <p className="text-sm font-bold">{exp.role}</p>
                        {exp.company && (
                          <p className="text-xs font-medium text-[#4b4b4b]">{exp.company}</p>
                        )}
                        {exp.bullets.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-xs font-medium leading-6 text-[#33343b]">
                            {exp.bullets.slice(0, 3).map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                            {exp.bullets.length > 3 && (
                              <li className="text-[#999]">+{exp.bullets.length - 3} more</li>
                            )}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.parsed.education && result.parsed.education.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Education ({result.parsed.education.length})
                    {result.aiRecoveredSections?.includes("education") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  <div className="mt-2 space-y-2">
                    {result.parsed.education.map((edu) => (
                      <div key={edu.id} className="text-sm">
                        <p className="font-bold">{edu.degree}</p>
                        <p className="text-xs font-medium text-[#4b4b4b]">{edu.school}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.parsed.skills && result.parsed.skills.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Skills ({result.parsed.skills.length})
                    {result.aiRecoveredSections?.includes("skills") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  {/* Render as categorized groups when AI recovery provided categories */}
                  {result.recoveredSkillCategories && result.recoveredSkillCategories.length > 0 ? (
                    <div className="mt-3 space-y-4">
                      {result.recoveredSkillCategories.map((cat) => (
                        <div key={cat.category}>
                          <h4 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#555]">
                            {cat.category}
                          </h4>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {cat.items.map((skill) => (
                              <span
                                key={skill}
                                className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-bold text-[#333]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {result.parsed.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-bold text-[#333]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.parsed.certifications && result.parsed.certifications.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Certifications
                    {result.aiRecoveredSections?.includes("certifications") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm font-medium text-[#33343b]">
                    {result.parsed.certifications.map((cert, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.parsed.professionalQualities && result.parsed.professionalQualities.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Professional Qualities
                    {result.aiRecoveredSections?.includes("professionalQualities") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                        <Wand2 size={10} />
                        Repaired
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#33343b]">
                    {result.parsed.professionalQualities.join("  ·  ")}
                  </p>
                </div>
              )}

              {result.parsed.projects && result.parsed.projects.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Projects ({result.parsed.projects.length})
                  </h3>
                  <div className="mt-2 space-y-3">
                    {result.parsed.projects.map((proj) => (
                      <div key={proj.id}>
                        <p className="text-sm font-bold">{proj.name}</p>
                        {proj.bullets.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-xs font-medium leading-6 text-[#33343b]">
                            {proj.bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-black uppercase tracking-[0.12em] text-[#999] transition hover:text-[#123c3a]"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={state === "saving"}
                className={primaryButtonClass + " disabled:opacity-40"}
              >
                {state === "saving" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating your draft...
                  </>
                ) : (
                  <>
                    Create polished draft <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* State: error (no result) */}
        {state === "error" && !result && (
          <div className="mt-8">
            <button
              type="button"
              onClick={handleReset}
              className={primaryButtonClass}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
