"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Loader2, Sparkles, AlertTriangle, CheckCircle2, Eye, Wand2, GitCompare } from "lucide-react";
import { primaryButtonClass } from "@careerlaunch/ui";
import { useState } from "react";
import { useAnalytics } from "../../lib/analytics";
import type { ParseResult, CoverageStatus, SectionCoverageItem, ImportQuality, ExperienceItem, EducationItem, RecoveryResult } from "@careerlaunch/ai/import";

type ImportState = "idle" | "parsing" | "preview" | "saving" | "error";

export default function ImportPage() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [state, setState] = useState<ImportState>("idle");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  const [showUnparsed, setShowUnparsed] = useState<string | null>(null);
  /** Comparison view: which section is showing "original" instead of "recovered".
   *  Set to a sectionId ("experience", "education", etc.) to show pre-recovery data.
   *  When null, the recovered view is shown. */
  const [compareSection, setCompareSection] = useState<string | null>(null);

  /** Whether the overall import quality is low enough to block draft creation */
  function isQualityBlocked(quality: ImportQuality): boolean {
    return quality === "poor" || quality === "failed";
  }

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
    // If AI recovery reconstructed sections, show success with info badge
    if (aiRecovered && recoveredSections && recoveredSections.length > 0) {
      return {
        icon: CheckCircle2,
        border: "border-green-200",
        bg: "bg-green-50",
        title: "We repaired issues found while importing your resume.",
        description: `Your ${recoveredSections.join(", ")} sections were automatically reconstructed from the original resume text. Please quickly review the highlighted sections before continuing.`,
      };
    }

    switch (quality) {
      case "excellent":
      case "good":
        return {
          icon: CheckCircle2,
          border: "border-green-200",
          bg: "bg-green-50",
          title: quality === "excellent" ? "Resume imported successfully" : "Resume imported with minor issues",
          description: quality === "excellent"
            ? "All critical sections have excellent coverage. You can safely create a draft."
            : "Most sections parsed well. Review the coverage below before creating a draft.",
        };
      case "fair":
        return {
          icon: AlertTriangle,
          border: "border-amber-200",
          bg: "bg-amber-50",
          title: "Import quality needs review",
          description: "Some sections have limited data. You can still create a draft and fill in the missing details in the builder.",
        };
      case "poor":
        return {
          icon: AlertTriangle,
          border: "border-orange-200",
          bg: "bg-orange-50",
          title: "Import quality is low",
          description: "Critical information was lost during parsing. You can still create a draft, but some sections will need manual editing.",
        };
      case "failed":
        return {
          icon: AlertTriangle,
          border: "border-red-200",
          bg: "bg-red-50",
          title: "Import failed — critical sections could not be parsed",
          description: "The parser could not reliably preserve your resume. You can still create a draft and fill in the details manually.",
        };
    }
  }

  function getCoverageColorClass(status: CoverageStatus): string {
    switch (status) {
      case "good": return "text-green-600 bg-green-50 border-green-200";
      case "partial": return "text-amber-600 bg-amber-50 border-amber-200";
      case "poor": return "text-orange-600 bg-orange-50 border-orange-200";
      case "missing": return "text-red-600 bg-red-50 border-red-200";
    }
  }

  function getCoverageLabel(status: CoverageStatus): string {
    switch (status) {
      case "good": return "Good";
      case "partial": return "Partial";
      case "poor": return "Poor";
      case "missing": return "Missing";
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

    // Block saving only if quality is poor AND AI recovery was not applied
    if (result.importQuality && isQualityBlocked(result.importQuality) && !result.aiRecovered) {
      setError(
        "Import quality is too low to create a reliable draft. " +
        "Review the coverage table below, paste the missing content, and try again.",
      );
      return;
    }

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
              Paste your existing resume text below. We&apos;ll parse it into a structured draft.
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
                placeholder="Paste your resume text here...&#10;&#10;Jordan Lee&#10;jordan.lee@email.com&#10;(555) 014-7291&#10;Austin, TX&#10;&#10;Professional Summary&#10;Customer-focused operations specialist...&#10;&#10;Experience&#10;Operations Lead | Northstar Market | 2021 - Present&#10;• Improved resolution time by 28%&#10;• Trained 18 team members&#10;&#10;Education&#10;B.A. Communication Studies - Texas State University, 2018&#10;&#10;Skills&#10;Customer onboarding, CRM, Process improvement"
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
            <p className="text-sm font-bold text-[#4b4b4b]">Parsing your resume...</p>
          </div>
        )}

        {/* State: preview or saving */}
        {(state === "preview" || state === "saving") && result && (
          <div className="mt-8 space-y-6">
            {/* Import quality banner — derived from section coverage, not heuristic */}
            {(() => {
              const banner = getQualityBanner(result.importQuality, result.aiRecovered, result.aiRecoveredSections);
              const Icon = banner.icon;
              return (
                <div className={`flex items-start gap-3 rounded-2xl border ${banner.border} ${banner.bg} p-4`} role="alert">
                  <Icon size={20} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{banner.title}</p>
                    <p className="mt-1 text-sm">{banner.description}</p>
                    {result.warnings.length > 0 && !result.aiRecovered && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Coverage table */}
            {result.coverage && result.coverage.length > 0 && (
              <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#4b4b4b]">
                  <FileText size={14} />
                  Import coverage
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {result.coverage
                    .filter((c) => c.sectionId !== "references")
                    .map((c) => {
                      const isRecovered = result.aiRecoveredSections?.includes(c.sectionId);
                      const colorClass = isRecovered ? "text-[#555] bg-[#f0f0f0] border-[#ddd]" : getCoverageColorClass(c.status);
                      const hasUnparsed = showUnparsed === c.sectionId && result.unparsedContent?.[c.sectionId];
                      /** Convert camelCase sectionId to Title Case for display */
                      const sectionLabel = c.sectionId
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (s) => s.toUpperCase())
                        .trim();
                      return (
                        <div key={c.sectionId}>
                          <div
                            className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold ${colorClass}`}
                          >
                            {/* Row 1: section title + recovered badge */}
                            <div className="flex items-start justify-between gap-1">
                              <span className="min-w-0 break-words leading-tight">
                                {sectionLabel}
                              </span>
                              {isRecovered && (
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#555]" title="Reconstructed by AI">
                                  <Wand2 size={9} />
                                  Recovered
                                </span>
                              )}
                            </div>
                            {/* Row 2: status badge */}
                            <span className="self-start rounded-md border border-current/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em]">
                              {getCoverageLabel(c.status)}
                            </span>
                          </div>
                          <div className="mt-1 px-1 text-[10px] font-medium text-[#999]">
                            {Math.round(c.ratio * 100)}% · {c.parsedWordCount}/{c.originalWordCount} words
                            {c.status === "poor" || c.status === "missing" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowUnparsed(
                                    showUnparsed === c.sectionId ? null : c.sectionId,
                                  )
                                }
                                className="ml-1.5 inline-flex items-center gap-0.5 text-[#123c3a] underline hover:no-underline"
                              >
                                <Eye size={10} />
                                {hasUnparsed ? "hide raw" : "show raw"}
                              </button>
                            ) : null}
                          </div>
                          {hasUnparsed && (
                            <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">
                              <pre className="whitespace-pre-wrap font-sans">
                                {result.unparsedContent[c.sectionId]}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Parsed preview */}
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
                  </h3>
                  {result.aiRecoveredSections?.includes("summary") && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#555]">
                        <Wand2 size={10} />
                        AI recovered
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-sm font-medium leading-6 text-[#33343b]">{result.parsed.summary}</p>
                </div>
              )}

              {result.parsed.experience && result.parsed.experience.length > 0 && (
                <div className="mt-5">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Experience ({result.parsed.experience.length})
                  </h3>
                  {result.aiRecoveredSections?.includes("experience") && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#555]">
                        <Wand2 size={10} />
                        AI recovered
                      </span>
                      {result.preRecoveryData && (
                        <button
                          type="button"
                          onClick={() => setCompareSection(compareSection === "experience" ? null : "experience")}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#123c3a] underline hover:no-underline"
                        >
                          <GitCompare size={11} />
                          {compareSection === "experience" ? "View recovered" : "View original"}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-2 space-y-3">
                    {(compareSection === "experience" && result.preRecoveryData
                      ? result.preRecoveryData.experience
                      : result.parsed.experience
                    ).map((exp) => (
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
                  </h3>
                  {result.aiRecoveredSections?.includes("education") && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#555]">
                        <Wand2 size={10} />
                        AI recovered
                      </span>
                      {result.preRecoveryData && (
                        <button
                          type="button"
                          onClick={() => setCompareSection(compareSection === "education" ? null : "education")}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#123c3a] underline hover:no-underline"
                        >
                          <GitCompare size={11} />
                          {compareSection === "education" ? "View recovered" : "View original"}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    {(compareSection === "education" && result.preRecoveryData
                      ? result.preRecoveryData.education
                      : result.parsed.education
                    ).map((edu) => (
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
                  </h3>
                  {result.aiRecoveredSections?.includes("skills") && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#555]">
                        <Wand2 size={10} />
                        AI recovered
                      </span>
                      {result.preRecoveryData && (
                        <button
                          type="button"
                          onClick={() => setCompareSection(compareSection === "skills" ? null : "skills")}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#123c3a] underline hover:no-underline"
                        >
                          <GitCompare size={11} />
                          {compareSection === "skills" ? "View recovered" : "View original"}
                        </button>
                      )}
                    </div>
                  )}
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
                    /* Fallback: flat pills when no categories available */
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(compareSection === "skills" && result.preRecoveryData
                        ? result.preRecoveryData.skills
                        : result.parsed.skills
                      ).map((skill) => (
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
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              {(result.importQuality === "poor" || result.importQuality === "failed") && !result.aiRecovered ? (
                <>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-[#123c3a]/15 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#123c3a] transition hover:bg-[#b9ff66] hover:border-[#b9ff66]"
                  >
                    Fix import
                  </button>
                  <span className="text-xs font-medium text-[#999]">
                    Import quality is too low to create a reliable draft.
                  </span>
                </>
              ) : (
                <>
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
                        Creating...
                      </>
                    ) : (
                      <>
                        Create draft <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </>
              )}
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
