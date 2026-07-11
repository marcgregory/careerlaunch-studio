"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { primaryButtonClass } from "@careerlaunch/ui";
import { AppHeader, AppLogo } from "../../components/app-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnalytics } from "../../lib/analytics";
import { normalizeResume } from "../../lib/resume-store";
import type { ParseResult, ImportQuality } from "@careerlaunch/ai/import";

type ImportState = "idle" | "parsing" | "preview" | "saving" | "error";
type PreviewBullet = { text: string; sourceIndex: number };
type PreviewSkillGroup = { category: string; items: string[] };
const EXPERIENCE_PREVIEW_BULLET_LIMIT = 3;
const SKILL_PREVIEW_LIMIT = 3;
const EMBEDDED_BULLET_MARKER_RE = /(?=\s*[\u2022\u25cf\u25aa\u25e6]\s+)/g;
const LEADING_BULLET_MARKER_RE = /^[\u2022\u25cf\u25aa\u25e6*\-]\s*/;

function isOrphanPreviewBullet(text: string, previous: string): boolean {
  if (!previous) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5) return false;
  if (/^(?:and|or|with|through|by|for|to|from|in|on|at|of)\b/i.test(text)) return true;
  return /^[a-z]/.test(text) && /[.!?]$/.test(text);
}

function normalizeExperiencePreviewBullets(bullets: string[]): PreviewBullet[] {
  const normalized: PreviewBullet[] = [];

  bullets.forEach((bullet, sourceIndex) => {
    const pieces = bullet
      .split(EMBEDDED_BULLET_MARKER_RE)
      .map((piece) => piece.replace(LEADING_BULLET_MARKER_RE, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    pieces.forEach((text) => {
      const lastIndex = normalized.length - 1;
      if (lastIndex >= 0 && isOrphanPreviewBullet(text, normalized[lastIndex].text)) {
        normalized[lastIndex] = {
          ...normalized[lastIndex],
          text: `${normalized[lastIndex].text} ${text}`,
        };
      } else {
        normalized.push({ text, sourceIndex });
      }
    });
  });

  return normalized;
}

function groupPreviewSkills(skills: string[], recovered?: Array<{ category: string; items: string[] }>): PreviewSkillGroup[] {
  if (recovered && recovered.length > 0) return recovered;

  const groups = new Map<string, string[]>();
  const uncategorized: string[] = [];
  for (const skill of skills) {
    const match = skill.match(/^([^:]{2,60}):\s*(.+)$/);
    if (!match) {
      uncategorized.push(skill);
      continue;
    }
    const category = match[1].trim();
    const item = match[2].trim();
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(item);
  }

  const result = [...groups.entries()].map(([category, items]) => ({ category, items }));
  if (uncategorized.length > 0) result.push({ category: "Skills", items: uncategorized });
  return result;
}

export default function ImportPage() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [state, setState] = useState<ImportState>("idle");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  // Track whether the user reached preview/saving then navigated away without creating a draft
  const reachedPreviewWithoutDraft = useRef(false);
  const previewResume = useMemo(() => {
    if (!result?.parsed) return null;
    return normalizeResume({
      title: `Imported Resume - ${result.parsed.contact?.fullName || "Unnamed"}`,
      targetRole: "",
      ...result.parsed,
      professionalQualities:
        result.parsed.professionalQualities || result.parsed.achievements || [],
    });
  }, [result]);

  // -- Funnel: detect import_abandoned --
  // Fires when a user reaches preview but navigates away without creating a draft.
  useEffect(() => {
    function handleVisibilityChange() {
      if (!reachedPreviewWithoutDraft.current) return;
      if (document.visibilityState === "hidden") {
        analytics.capture("import_abandoned", {
          importQuality: result?.importQuality ?? "unknown",
          layouts: result?.layouts,
          aiRecoveryStatus: result?.aiRecovery?.status ?? "skipped",
        });
      }
    }

    function handleBeforeUnload() {
      if (!reachedPreviewWithoutDraft.current) return;
      // Safari doesn't always fire visibilitychange on tab close,
      // so we also fire on beforeunload. PostHog deduplicates server-side.
      analytics.capture("import_abandoned", {
        importQuality: result?.importQuality ?? "unknown",
        layouts: result?.layouts,
        aiRecoveryStatus: result?.aiRecovery?.status ?? "skipped",
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [result]);

  /** Whether the parser or AI was able to extract meaningful content */
  function hasAnyContent(): boolean {
    if (!result?.parsed) return false;
    const p = result.parsed;
    return !!(
      p.summary ||
      (p.experience && p.experience.length > 0) ||
      (p.education && p.education.length > 0)
    );
  }

  function getQualityBanner(
    quality: ImportQuality,
    aiRecovered?: boolean,
    recoveredSections?: string[],
  ): {
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
          description:
            "All sections look great. You can create a polished draft and start customizing.",
        };
      case "fair":
        return {
          icon: AlertTriangle,
          border: "border-amber-200",
          bg: "bg-amber-50",
          title: "Most sections imported, a few need your help.",
          description:
            "Some sections have limited data. You can create a draft now and fill in the missing details in the builder.",
        };
      case "poor":
        return {
          icon: AlertTriangle,
          border: "border-orange-200",
          bg: "bg-orange-50",
          title: "Import had some trouble — don't worry.",
          description:
            "We saved what we could. You can create a draft and edit everything in the builder.",
        };
      case "failed":
        return {
          icon: AlertTriangle,
          border: "border-red-200",
          bg: "bg-red-50",
          title: "We couldn't parse that completely.",
          description:
            "Some key parts were missed. You can still create a draft and fill everything in manually.",
        };
    }
  }

  async function handleParse() {
    if (!text.trim()) return;

    setState("parsing");
    setError("");

    // -- Funnel: import_started (client-side) --
    analytics.capture("import_started", {
      textLength: text.length,
      wordCount: text.trim().split(/\s+/).length,
      lineCount: text.split("\n").length,
    });

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
      // Mark that the user reached preview — used by the abandonment detector
      reachedPreviewWithoutDraft.current = true;
      toast.success("Resume imported successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setState("error");
      toast.error("Import failed. Please try again with different text.");
    }
  }

  async function handleCreateDraft() {
    if (!result?.parsed) return;

    setState("saving");

    try {
      if (!previewResume) return;
      const resume = previewResume;

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to create" }));
        throw new Error(err.error || "Failed to create resume");
      }

      const created = await res.json();

      // -- Funnel: draft_created (from import) --
      analytics.capture("draft_created", {
        source: "import",
        resumeId: created.resume.id,
        importQuality: result.importQuality,
        confidence: result.confidence,
        layouts: result.layouts,
        aiRecoveryStatus: result.aiRecovery?.status ?? "skipped",
        aiRecoveryProvider: result.aiRecovery?.usedProvider ?? null,
        sectionCounts: {
          experience: previewResume?.experience.length ?? 0,
          education: previewResume?.education.length ?? 0,
          skills: previewResume?.skills.length ?? 0,
          certifications: previewResume?.certifications.length ?? 0,
          projects: previewResume?.projects.length ?? 0,
          professionalQualities: previewResume?.achievements.length ?? 0,
        },
      });

      // Draft was created — clear abandonment tracking
      reachedPreviewWithoutDraft.current = false;

      toast.success("Draft created. Redirecting to builder...");
      router.push(`/builder?resumeId=${created.resume.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create resume");
      setState("preview");
      toast.error("Failed to create resume draft.");
    }
  }

  function handleReset() {
    setState("idle");
    setText("");
    setResult(null);
    setError("");
  }

  return (
    <main className="signal-site min-h-screen px-5 py-6 pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <AppHeader>
        <AppLogo />
      </AppHeader>

      <div className="mx-auto max-w-5xl px-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#123c3a]/10 pb-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-[0.16em] text-[#4b4b4b] transition hover:text-[#123c3a]"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="font-signal mt-4 text-4xl font-black tracking-[-0.06em]">
              Import resume
            </h1>
            <p className="mt-2 text-sm font-medium text-[#4b4b4b]">
              Paste your existing resume text below. We&apos;ll format it into a
              polished draft.
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div className="text-sm font-medium text-red-700">{error}</div>
          </div>
        )}

        {/* State: idle */}
        {state === "idle" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
              <label
                htmlFor="import-text"
                className="flex items-center gap-3 text-sm font-black text-[#4b4b4b] uppercase tracking-[0.1em]"
              >
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
              <Link
                href="/dashboard"
                className="text-xs font-black uppercase tracking-[0.12em] text-[#999] transition hover:text-[#123c3a]"
              >
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
            <p className="text-sm font-bold text-[#4b4b4b]">
              Reading your resume...
            </p>
          </div>
        )}

        {/* State: preview or saving */}
        {(state === "preview" || state === "saving") &&
          result &&
          previewResume && (
            <div className="mt-8 space-y-6">
              {/* Import quality banner — user-friendly messaging */}
              {(() => {
                const banner = getQualityBanner(
                  result.importQuality,
                  result.aiRecovered,
                  result.aiRecoveredSections,
                );
                const Icon = banner.icon;
                return (
                  <div
                    className={`flex items-start gap-3 rounded-2xl border ${banner.border} ${banner.bg} p-4`}
                    role="alert"
                  >
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
                  {previewResume.contact.fullName || "Unknown name"}
                </h2>
                <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
                  {[
                    previewResume.contact.email,
                    previewResume.contact.phone,
                    previewResume.contact.location,
                    previewResume.contact.website,
                    previewResume.contact.linkedin,
                    previewResume.contact.github,
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </p>

                {previewResume.summary && (
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
                    <p className="mt-2 text-sm font-medium leading-6 text-[#33343b]">
                      {previewResume.summary}
                    </p>
                  </div>
                )}

                {previewResume.experience &&
                  previewResume.experience.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        Experience ({previewResume.experience.length})
                        {result.aiRecoveredSections?.includes("experience") && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                            <Wand2 size={10} />
                            Repaired
                          </span>
                        )}
                      </h3>
                      <div className="mt-2 space-y-3">
                        {previewResume.experience.map((exp) => {
                          const previewBullets = normalizeExperiencePreviewBullets(exp.bullets);
                          const hiddenBulletCount = Math.max(0, previewBullets.length - EXPERIENCE_PREVIEW_BULLET_LIMIT);

                          return (
                          <div
                            key={exp.id}
                            className="border-l-2 border-[#b9ff66] pl-3"
                          >
                            <p className="text-sm font-bold">{exp.role}</p>
                            {[
                              exp.company,
                              [exp.start, exp.end].filter(Boolean).join(" - "),
                            ].filter(Boolean).length > 0 && (
                              <p className="text-xs font-medium text-[#4b4b4b]">
                                {[
                                  exp.company,
                                  [exp.start, exp.end]
                                    .filter(Boolean)
                                    .join(" - "),
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            )}
                            {previewBullets.length > 0 && (
                              <ul className="mt-1 list-disc pl-4 text-xs font-medium leading-6 text-[#33343b]">
                                {previewBullets.slice(0, EXPERIENCE_PREVIEW_BULLET_LIMIT).map((bullet, i) => (
                                  <li key={`${bullet.sourceIndex}-${i}`}>{bullet.text}</li>
                                ))}
                                {hiddenBulletCount > 0 && (
                                  <li className="text-[#999]">
                                    +{hiddenBulletCount} more bullet points
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {previewResume.education &&
                  previewResume.education.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        Education ({previewResume.education.length})
                        {result.aiRecoveredSections?.includes("education") && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                            <Wand2 size={10} />
                            Repaired
                          </span>
                        )}
                      </h3>
                      <div className="mt-2 space-y-2">
                        {previewResume.education.map((edu) => (
                          <div key={edu.id} className="text-sm">
                            <p className="font-bold">{edu.degree}</p>
                            <p className="text-xs font-medium text-[#4b4b4b]">
                              {[edu.school, edu.graduation]
                                .filter(Boolean)
                                .join(" | ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {previewResume.skills.length > 0 && (
                  <div className="mt-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                      Skills ({previewResume.skills.length})
                      {result.aiRecoveredSections?.includes("skills") && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                          <Wand2 size={10} />
                          Repaired
                        </span>
                      )}
                    </h3>

                    <div className="mt-3 space-y-3">
                      {groupPreviewSkills(previewResume.skills, result.recoveredSkillCategories).map((category) => {
                        const visible = category.items.slice(0, SKILL_PREVIEW_LIMIT);
                        const hidden = Math.max(0, category.items.length - SKILL_PREVIEW_LIMIT);

                        return (
                          <div key={category.category}>
                            <p className="text-xs font-bold text-[#4b4b4b]">
                              {category.category} ({category.items.length})
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {visible.map((skill) => (
                                <span
                                  key={`${category.category}-${skill}`}
                                  className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-bold text-[#333]"
                                >
                                  {skill}
                                </span>
                              ))}
                              {hidden > 0 && (
                                <span className="rounded-full border border-[#123c3a]/15 bg-white px-3 py-1 text-[11px] font-bold text-[#4b4b4b]">
                                  +{hidden} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {previewResume.licenses.length > 0 && (
                  <div className="mt-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                      Licenses ({previewResume.licenses.length})
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm font-medium text-[#33343b]">
                      {previewResume.licenses.map((license) => (
                        <li key={license.id} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
                          <span>
                            <span className="block font-bold">
                              {license.name}
                            </span>
                            {[
                              license.issuingAuthority,
                              license.licenseNumber &&
                                `License Number: ${license.licenseNumber}`,
                            ].filter(Boolean).length > 0 && (
                              <span className="block text-xs text-[#4b4b4b]">
                                {[
                                  license.issuingAuthority,
                                  license.licenseNumber &&
                                    `License Number: ${license.licenseNumber}`,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {previewResume.certifications &&
                  previewResume.certifications.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        Certifications
                        {result.aiRecoveredSections?.includes(
                          "certifications",
                        ) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                            <Wand2 size={10} />
                            Repaired
                          </span>
                        )}
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm font-medium text-[#33343b]">
                        {previewResume.certifications.map((cert, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
                            {cert}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {previewResume.professionalQualities.length > 0 && (
                  <div className="mt-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                      Professional Qualities (
                      {previewResume.professionalQualities.length})
                      {result.aiRecoveredSections?.includes(
                        "professionalQualities",
                      ) && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                          <Wand2 size={10} />
                          Repaired
                        </span>
                      )}
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm font-medium text-[#33343b]">
                      {previewResume.professionalQualities.map((quality, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
                          {quality}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {previewResume.achievements &&
                  previewResume.achievements.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        Achievements
                        {result.aiRecoveredSections?.includes(
                          "professionalQualities",
                        ) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                            <Wand2 size={10} />
                            Repaired
                          </span>
                        )}
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm font-medium text-[#33343b]">
                        {previewResume.achievements.map((qual, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b9ff66]" />
                            {qual}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {previewResume.volunteer.length > 0 && (
                  <div className="mt-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                      Volunteer Experience ({previewResume.volunteer.length})
                    </h3>
                    <div className="mt-2 space-y-2">
                      {previewResume.volunteer.map((item) => (
                        <div key={item.id} className="text-sm">
                          <p className="font-bold">{item.role}</p>
                          <p className="text-xs font-medium text-[#4b4b4b]">
                            {[
                              item.company,
                              [item.start, item.end]
                                .filter(Boolean)
                                .join(" - "),
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewResume.languages.length > 0 && (
                  <div className="mt-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                      Languages ({previewResume.languages.length})
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {previewResume.languages.map((language) => (
                        <span
                          key={language}
                          className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-bold text-[#333]"
                        >
                          {language}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {previewResume.projects &&
                  previewResume.projects.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        Projects ({previewResume.projects.length})
                      </h3>
                      <div className="mt-2 space-y-3">
                        {previewResume.projects.map((proj) => (
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

                {previewResume.references &&
                  previewResume.references.length > 0 && (
                    <div className="mt-5">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#999]">
                        References ({previewResume.references.length})
                      </h3>
                      <div className="mt-2 space-y-2">
                        {previewResume.references.map((ref) => (
                          <div key={ref.id} className="text-sm">
                            <p className="font-bold">{ref.name}</p>
                            {[ref.title, ref.company].filter(Boolean).length >
                              0 && (
                              <p className="text-xs font-medium text-[#4b4b4b]">
                                {[ref.title, ref.company]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            )}
                            {[ref.phone, ref.email].filter(Boolean).length >
                              0 && (
                              <p className="text-xs text-[#777]">
                                {[ref.phone, ref.email]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
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
