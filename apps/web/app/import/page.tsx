"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { useState } from "react";
import type { ParseResult } from "@careerlaunch/ai/import";

type ImportState = "idle" | "parsing" | "preview" | "saving" | "error";

export default function ImportPage() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>("idle");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");

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
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div className="text-sm font-medium text-red-700">{error}</div>
          </div>
        )}

        {/* State: idle */}
        {state === "idle" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
              <div className="flex items-center gap-3 text-sm font-black text-[#4b4b4b] uppercase tracking-[0.1em]">
                <FileText size={18} />
                Paste your resume text
              </div>
              <textarea
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
            {/* Confidence banner */}
            {result.confidence < 50 && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Low confidence parse</p>
                  <p className="mt-1 text-sm text-amber-700">
                    The parser could not confidently detect all sections. You may need to manually adjust the data in the builder.
                  </p>
                </div>
              </div>
            )}

            {result.confidence >= 50 && (
              <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-800">Resume parsed ({result.confidence}% confidence)</p>
                  {result.warnings.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-green-700">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
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
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#999]">Summary</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#33343b]">{result.parsed.summary}</p>
                </div>
              )}

              {result.parsed.experience && result.parsed.experience.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Experience ({result.parsed.experience.length})
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
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Education ({result.parsed.education.length})
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
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                    Skills ({result.parsed.skills.length})
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.parsed.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#b9ff66] px-3 py-1 text-xs font-black text-[#123c3a]"
                      >
                        {skill}
                      </span>
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
              <div className="flex gap-3">
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
              </div>
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
