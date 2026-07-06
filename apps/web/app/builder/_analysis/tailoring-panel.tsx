"use client";

import { useState, useCallback, useRef } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Check,
  Target,
  ChevronDown,
  ChevronUp,
  Info as InfoIcon,
} from "lucide-react";
import { SuggestionDiffModal, type ApplyState } from "../../../components/suggestion-diff-modal";
import { DiffView } from "../../../components/diff-view";
import { SuggestionFeedback } from "../../../components/suggestion-feedback";
import { ConfidenceBar } from "../../../components/confidence-bar";
import { createOperations } from "@careerlaunch/ai";
import { useAnalytics } from "../../../lib/analytics";
import type { Suggestion, ApplyOperation } from "@careerlaunch/ai";

// ── Types ────────────────────────────────────────────────────────────────

interface TailorState {
  status: "idle" | "analyzing" | "success" | "error";
  matchScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  weakSections: Array<{ sectionId: string; field: string; reason: string; severity: string }>;
  summarySuggestions: TailorSuggestionState[];
  bulletSuggestions: TailorSuggestionState[];
  skillSuggestions: TailorSuggestionState[];
  error: string | null;
}

interface TailorSuggestionState {
  id: string;
  before: string;
  after: string;
  reason: string;
  confidence: number;
  severity: "critical" | "major" | "medium" | "minor" | "info";
  category: string;
  location: { sectionId: string; entryId?: string; field?: string };
  status: "pending" | "accepted" | "applied" | "rejected";
  safetyFlags?: Array<{ type: string; message: string }>;
}

interface TailoringPanelProps {
  resumeId: string;
  onApplySuggestion: (operations: ApplyOperation[]) => Promise<{
    appliedChanges?: { operation: string; path: string; before: string | null; after: string | null }[];
    error?: string;
  }>;
}

// ── Colors ───────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "text-[#4b4b4b]";
  if (score >= 80) return "text-[#00796f]";
  if (score >= 50) return "text-[#7b5300]";
  return "text-red-700";
}

function scoreBg(score: number | null): string {
  if (score === null) return "border-[#4b4b4b]/30";
  if (score >= 80) return "border-[#00796f]/30 bg-[#e8f5e9]";
  if (score >= 50) return "border-[#7b5300]/30 bg-[#fff7df]";
  return "border-red-200 bg-red-50";
}

// ── Component ────────────────────────────────────────────────────────────

export function TailoringPanel({ resumeId, onApplySuggestion }: TailoringPanelProps) {
  const analytics = useAnalytics();
  const [jobDescription, setJobDescription] = useState("");
  const [tailor, setTailor] = useState<TailorState>({
    status: "idle",
    matchScore: null,
    matchedSkills: [],
    missingSkills: [],
    weakSections: [],
    summarySuggestions: [],
    bulletSuggestions: [],
    skillSuggestions: [],
    error: null,
  });

  // ── Modal state ──────────────────────────────────────────────────
  const [reviewingSuggestion, setReviewingSuggestion] = useState<TailorSuggestionState | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [modalError, setModalError] = useState<string | undefined>();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  // Track which suggestions have triggered feedback widget display
  const [feedbackTriggered, setFeedbackTriggered] = useState<Set<string>>(new Set());

  // Fire-and-forget lifecycle event
  const fireEvent = async (suggestionId: string, action: string) => {
    try {
      await fetch(`/api/resumes/${resumeId}/suggestions/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action, category: "tailoring" }),
      });
    } catch { /* non-critical */ }
  };

  // ── Run analysis & tailoring ─────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!jobDescription.trim()) return;

    setTailor((prev) => ({ ...prev, status: "analyzing", error: null }));

    try {
      // Step 1: Gap analysis (Phase 1 + Phase 2 combined)
      const gapResponse = await fetch(`/api/resumes/${resumeId}/gap-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      if (!gapResponse.ok) {
        const body = await gapResponse.json().catch(() => ({}));
        throw new Error(body.error ?? "Gap analysis failed");
      }

      const gapData = await gapResponse.json();

      // Step 2: Run tailoring (Phase 3)
      const tailorResponse = await fetch(`/api/resumes/${resumeId}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      const tailorData = tailorResponse.ok ? await tailorResponse.json() : { suggestions: [] };

      analytics.capture("resume_tailor_run", {
        matchScore: gapData.gapAnalysis?.matchScore ?? 0,
        missingSkillsCount: gapData.gapAnalysis?.missingSkills?.length ?? 0,
        suggestionCount: tailorData.suggestions?.length ?? 0,
      });

      const summarySugs = (tailorData.suggestions ?? []).filter(
        (s: any) => s.category === "summary",
      );
      const bulletSugs = (tailorData.suggestions ?? []).filter(
        (s: any) => s.category === "experience",
      );
      const skillSugs = (tailorData.suggestions ?? []).filter(
        (s: any) => s.category === "skills",
      );

      setTailor({
        status: "success",
        matchScore: gapData.gapAnalysis?.matchScore ?? null,
        matchedSkills: gapData.gapAnalysis?.matchedSkills ?? [],
        missingSkills: gapData.gapAnalysis?.missingSkills ?? [],
        weakSections: gapData.gapAnalysis?.weakSections ?? [],
        summarySuggestions: summarySugs.map((s: any) => ({ ...s, status: "pending" as const })),
        bulletSuggestions: bulletSugs.map((s: any) => ({ ...s, status: "pending" as const })),
        skillSuggestions: skillSugs.map((s: any) => ({ ...s, status: "pending" as const })),
        error: null,
      });
    } catch (error) {
      setTailor((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
    }
  }, [resumeId, jobDescription, analytics]);

  // ── Review handler — opens the diff modal ──────────────────────────
  function handleReview(suggestion: TailorSuggestionState) {
    setReviewingSuggestion(suggestion);
    setApplyState("idle");
    setModalError(undefined);
    fireEvent(suggestion.id, "viewed");
  }

  // ── Apply single suggestion ────────────────────────────────────────
  async function handleApplySuggestion(suggestion: TailorSuggestionState) {
    setModalError(undefined);

    // Convert tailor suggestion to operations
    const suggestionForOps: Suggestion = {
      id: suggestion.id,
      category: suggestion.category as any,
      severity: suggestion.severity,
      title: suggestion.reason.slice(0, 50),
      reason: suggestion.reason,
      targetText: suggestion.before || null,
      suggestedText: suggestion.after || null,
      location: suggestion.location,
      confidence: suggestion.confidence,
      source: "ai",
    };

    const emptyResume = {
      contact: { fullName: "", email: "", phone: "", location: "", website: "" },
      summary: "",
      sections: [],
      skills: [],
      certifications: [],
      projects: [],
    };

    const operations = createOperations(suggestionForOps, emptyResume);

    // For add_skill operations when createOperations returns null
    const finalOps: ApplyOperation[] = operations ?? (
      suggestion.category === "skills"
        ? [{ type: "add_skill" as const, skill: suggestion.after }]
        : []
    );

    if (finalOps.length === 0) {
      setModalError("This suggestion cannot be applied automatically yet.");
      setApplyState("error");
      return;
    }

    setApplyState("applying");

    const result = await onApplySuggestion(finalOps);

    if (result.error) {
      setModalError(result.error);
      setApplyState("error");
    } else {
      // Update the local status
      setApplyState("applied");
      updateSuggestionStatus(suggestion.id, "applied");
      fireEvent(suggestion.id, "applied");
      setFeedbackTriggered((prev) => new Set(prev).add(suggestion.id));
    }
  }

  // ── Apply all suggestions in a category ────────────────────────────
  async function handleApplyCategory(suggestions: TailorSuggestionState[]) {
    const pending = suggestions.filter((s) => s.status === "pending");
    if (pending.length === 0) return;

    // Collect ALL operations into a single array for one batch call
    const allOps: ApplyOperation[] = [];

    for (const s of pending) {
      const suggestionForOps: Suggestion = {
        id: s.id,
        category: s.category as any,
        severity: s.severity,
        title: s.reason.slice(0, 50),
        reason: s.reason,
        targetText: s.before || null,
        suggestedText: s.after || null,
        location: s.location,
        confidence: s.confidence,
        source: "ai",
      };

      const emptyResume = {
        contact: { fullName: "", email: "", phone: "", location: "", website: "" },
        summary: "",
        sections: [],
        skills: [],
        certifications: [],
        projects: [],
      };

      const ops = createOperations(suggestionForOps, emptyResume);

      // Fallback for add_skill when createOperations returns null
      // (identical to the single-apply handler behavior)
      const finalOps: ApplyOperation[] = ops ?? (
        s.category === "skills"
          ? [{ type: "add_skill" as const, skill: s.after }]
          : []
      );

      allOps.push(...finalOps);
    }

    if (allOps.length === 0) return;

    // Single batch call — all operations applied together
    const result = await onApplySuggestion(allOps);

    if (!result.error) {
      // Mark all pending suggestions as applied
      for (const s of pending) {
        updateSuggestionStatus(s.id, "applied");
        fireEvent(s.id, "applied");
        setFeedbackTriggered((prev) => new Set(prev).add(s.id));
      }
    }
  }

  // ── Update local suggestion status ─────────────────────────────────
  function updateSuggestionStatus(id: string, status: "pending" | "accepted" | "applied" | "rejected") {
    setTailor((prev) => ({
      ...prev,
      summarySuggestions: prev.summarySuggestions.map((s) =>
        s.id === id ? { ...s, status } : s,
      ),
      bulletSuggestions: prev.bulletSuggestions.map((s) =>
        s.id === id ? { ...s, status } : s,
      ),
      skillSuggestions: prev.skillSuggestions.map((s) =>
        s.id === id ? { ...s, status } : s,
      ),
    }));
  }

  function handleReject(id: string) {
    updateSuggestionStatus(id, "rejected");
    fireEvent(id, "rejected");
    setFeedbackTriggered((prev) => new Set(prev).add(id));
  }

  function handleCloseModal() {
    setReviewingSuggestion(null);
    setApplyState("idle");
    setModalError(undefined);
  }

  function toggleSection(id: string) {
    setExpandedSection((prev) => (prev === id ? null : id));
  }

  // ── State: empty / idle ───────────────────────────────────────────
  if (tailor.status === "idle") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#e8f5e9]">
            <Target size={26} className="text-[#00796f]" />
          </div>
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Resume Tailoring
            </h2>
            <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-[#4b4b4b]">
              Paste a job description to tailor your resume to the role. Get AI-powered suggestions to improve your match.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="tailor-jd" className="text-xs font-black uppercase tracking-wide text-[#4b4b4b]">Paste job description</label>
          <textarea
            id="tailor-jd"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job description here..."
            rows={6}
            className="w-full resize-none rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-4 text-sm leading-relaxed placeholder:text-[#4b4b4b]/40 focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!jobDescription.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#123c3a] bg-[#123c3a] px-6 font-black text-white transition hover:bg-[#1a5550] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={18} /> Analyze &amp; Tailor
          </button>
        </div>
      </section>
    );
  }

  // ── State: loading ───────────────────────────────────────────────
  if (tailor.status === "analyzing") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 size={28} className="animate-spin text-[#123c3a]" />
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Analyzing &amp; Tailoring
            </h2>
            <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
              Analyzing job description, checking your resume, and writing suggestions...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── State: error ─────────────────────────────────────────────────
  if (tailor.status === "error") {
    return (
      <section className="rounded-[30px] border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <AlertCircle size={24} className="text-red-600" />
          <div>
            <h2 className="font-signal text-lg font-black tracking-[-0.04em] text-red-800">
              Analysis failed
            </h2>
            <p className="mt-1 text-sm font-medium text-red-700">{tailor.error}</p>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 text-xs font-black text-red-800 transition hover:bg-red-100"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // ── State: success ───────────────────────────────────────────────
  const pendingSummary = tailor.summarySuggestions.filter(
    (s) => s.status === "pending",
  );
  const pendingBullets = tailor.bulletSuggestions.filter(
    (s) => s.status === "pending",
  );
  const pendingSkills = tailor.skillSuggestions.filter(
    (s) => s.status === "pending",
  );
  const totalPending =
    pendingSummary.length + pendingBullets.length + pendingSkills.length;

  return (
    <>
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
            Resume Tailoring
          </h2>
          {totalPending > 0 && (
            <span className="rounded-xl border border-[#b9ff66] bg-[#b9ff66]/20 px-2.5 py-1 text-xs font-black text-[#00796f]">
              {totalPending} suggestions
            </span>
          )}
        </div>

        {/* ── Match Score ────────────────────────────────────────── */}
        <div className={`mt-4 flex items-center gap-4 rounded-2xl border p-4 ${scoreBg(tailor.matchScore)}`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-current text-center text-lg font-black leading-none tracking-tight">
            <span className={scoreColor(tailor.matchScore)}>
              {tailor.matchScore ?? "—"}
            </span>
          </div>
          <div className="min-w-0 text-sm font-medium text-[#4b4b4b]">
            <span className="font-black text-[#123c3a]">
              {tailor.matchScore !== null
                ? tailor.matchScore >= 80
                  ? "Strong match"
                  : tailor.matchScore >= 50
                    ? "Moderate match"
                    : "Weak match"
                : "No score"}
            </span>
            {tailor.matchedSkills.length + tailor.missingSkills.length > 0 && (
              <span className="block text-xs">
                {tailor.matchedSkills.length} matching · {tailor.missingSkills.length} missing
              </span>
            )}
          </div>
        </div>

        {/* ── Skill Comparison ─────────────────────────────────── */}
        {(tailor.matchedSkills.length > 0 || tailor.missingSkills.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-green-100 bg-green-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#00796f]">
                <CheckCircle2 size={14} />
                Matched ({tailor.matchedSkills.length})
              </div>
              {tailor.matchedSkills.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {tailor.matchedSkills.map((skill) => (
                    <li key={skill} className="text-sm font-medium text-green-800">
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs font-medium text-green-600/60">None matched</p>
              )}
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-red-700">
                <XCircle size={14} />
                Missing ({tailor.missingSkills.length})
              </div>
              {tailor.missingSkills.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {tailor.missingSkills.map((skill) => (
                    <li key={skill} className="text-sm font-medium text-red-800">
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs font-medium text-red-600/60">No missing skills</p>
              )}
            </div>
          </div>
        )}

        {/* ── Weak Sections ──────────────────────────────────────── */}
        {tailor.weakSections.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[#e0aa22]/30 bg-[#fff7df]/50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7b5300]">
              Areas to improve
            </p>
            <ul className="mt-2 space-y-1">
              {tailor.weakSections.map((ws, i) => (
                <li key={i} className="text-sm font-medium text-[#7b5300]">
                  {ws.field === "summary" ? "Summary" : ws.sectionId}: {ws.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Suggestions by Category ──────────────────────────────── */}
        <div className="mt-5 space-y-4 border-t border-[#123c3a]/10 pt-4">
          {/* Summary suggestions */}
          {renderSuggestionSection(
            "Summary",
            pendingSummary,
            tailor.summarySuggestions,
            "summary",
            expandedSection,
            toggleSection,
            handleReview,
            handleReject,
            handleApplyCategory,
            resumeId,
            feedbackTriggered,
          )}

          {/* Experience bullet suggestions */}
          {renderSuggestionSection(
            "Experience",
            pendingBullets,
            tailor.bulletSuggestions,
            "experience",
            expandedSection,
            toggleSection,
            handleReview,
            handleReject,
            handleApplyCategory,
            resumeId,
            feedbackTriggered,
          )}

          {/* Skills suggestions */}
          {renderSuggestionSection(
            "Skills",
            pendingSkills,
            tailor.skillSuggestions,
            "skills",
            expandedSection,
            toggleSection,
            handleReview,
            handleReject,
            handleApplyCategory,
            resumeId,
            feedbackTriggered,
          )}
        </div>

        {/* No suggestions */}
        {totalPending === 0 &&
          tailor.summarySuggestions.length === 0 &&
          tailor.bulletSuggestions.length === 0 &&
          tailor.skillSuggestions.length === 0 && (
            <div className="mt-5 rounded-2xl border border-[#b9ff66]/40 bg-[#b9ff66]/10 p-4 text-center">
              <p className="font-black text-[#00796f]">Resume looks good for this role!</p>
              <p className="mt-1 text-sm text-[#4b4b4b]">
                No suggestions for improvement. Your resume is well-aligned with this job.
              </p>
            </div>
          )}

        {/* ── Re-analyze ──────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#123c3a]/10 pt-4">
          <p className="text-xs font-medium text-[#4b4b4b]">
            {totalPending === 0
              ? "All suggestions reviewed"
              : `${totalPending} suggestion${totalPending !== 1 ? "s" : ""} pending`}
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-white px-3 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
          >
            <Sparkles size={14} /> Re-analyze
          </button>
        </div>
      </section>

      {/* ── Diff Review Modal ──────────────────────────────────────── */}
      {reviewingSuggestion && (
        <SuggestionDiffModal
          suggestion={{
            ...reviewingSuggestion,
            title: reviewingSuggestion.reason.slice(0, 60),
            source: "ai" as const,
            category: reviewingSuggestion.category as any,
            targetText: reviewingSuggestion.before || null,
            suggestedText: reviewingSuggestion.after || null,
          }}
          applyState={applyState}
          applyError={modalError}
          onApply={(id) => handleApplySuggestion(reviewingSuggestion)}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

// ── Suggestion Section Renderer ──────────────────────────────────────────

function renderSuggestionSection(
  label: string,
  pending: TailorSuggestionState[],
  all: TailorSuggestionState[],
  sectionId: string,
  expandedSection: string | null,
  toggleSection: (id: string) => void,
  handleReview: (s: TailorSuggestionState) => void,
  handleReject: (id: string) => void,
  handleApplyAll: (suggestions: TailorSuggestionState[]) => void,
  resumeId: string,
  feedbackTriggered: Set<string>,
) {
  if (all.length === 0) return null;

  const isExpanded = expandedSection === sectionId;
  const applied = all.filter((s) => s.status === "applied" || s.status === "accepted").length;

  return (
    <div className="rounded-2xl border border-[#123c3a]/10 overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => toggleSection(sectionId)}
        className="flex w-full items-center justify-between gap-3 bg-[#f8f8f5] px-4 py-3 text-left transition hover:bg-[#f0f0eb]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-[#123c3a]">{label}</span>
          {pending.length > 0 && (
            <span className="rounded-lg border border-[#b9ff66] bg-[#b9ff66]/20 px-1.5 py-0.5 text-[0.6rem] font-black text-[#00796f]">
              {pending.length} new
            </span>
          )}
          {applied > 0 && (
            <span className="text-xs font-medium text-[#4b4b4b]">({applied} applied)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleApplyAll(all.filter((s) => s.status === "pending"));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#123c3a]/10 bg-white px-2 py-1 text-[0.6rem] font-black text-[#00796f] transition hover:bg-[#b9ff66]"
            >
              <Check size={12} /> Apply all
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded suggestions */}
      {isExpanded && (
        <div className="divide-y divide-[#123c3a]/5">
          {all.map((suggestion) => {
            const isPending = suggestion.status === "pending";
            const isDone = suggestion.status === "applied" || suggestion.status === "accepted";
            const isRejected = suggestion.status === "rejected";

            return (
              <div
                key={suggestion.id}
                className={`px-4 py-3 transition ${
                  isDone
                    ? "bg-[#b9ff66]/5 opacity-60"
                    : isRejected
                      ? "bg-[#f8f8f5] opacity-50"
                      : "bg-white"
                }`}
              >
                {/* Safety warning badge */}
                {suggestion.safetyFlags && suggestion.safetyFlags.length > 0 && (
                  <div className="mb-2 rounded-xl border border-[#e0aa22]/40 bg-[#fff7df] p-2">
                    <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#7b5300]">
                      ⚠ Review carefully
                    </p>
                    {suggestion.safetyFlags.map((flag, i) => (
                      <p key={i} className="mt-0.5 text-[0.65rem] font-medium text-[#7b5300]">
                        {flag.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Inline diff preview */}
                <div className="mb-2">
                  <DiffView
                    oldText={suggestion.before}
                    newText={suggestion.after}
                    layout="side-by-side"
                    oldLabel="Current"
                    newLabel="Suggested"
                  />
                </div>

                {/* Reason and actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#123c3a]">Why</p>
                    <p className="text-xs font-medium leading-5 text-[#4b4b4b]">
                      {suggestion.reason}
                    </p>
                    <div className="mt-1.5 max-w-[180px]">
                      <ConfidenceBar confidence={suggestion.confidence} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isPending && (
                      <>
                        {suggestion.after ? (
                          <button
                            type="button"
                            aria-label="Review suggestion"
                            title="Review suggestion"
                            onClick={() => handleReview(suggestion)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#b9ff66] bg-white px-3 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
                          >
                            <Eye size={14} />
                            Review
                          </button>
                        ) : (
                          <span className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-2.5 text-[0.65rem] font-medium text-[#4b4b4b]">
                            <InfoIcon size={12} />
                            Info
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Dismiss suggestion"
                          title="Dismiss"
                          onClick={() => handleReject(suggestion.id)}
                          className="inline-grid h-8 w-8 place-items-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                    {isDone && (
                      <span className="rounded-xl bg-[#b9ff66]/30 px-3 py-1.5 text-xs font-black text-[#00796f]">
                        Applied
                      </span>
                    )}
                    {isRejected && (
                      <span className="rounded-xl bg-[#123c3a]/8 px-3 py-1.5 text-xs font-black text-[#4b4b4b]">
                        Dismissed
                      </span>
                    )}
                  </div>
                </div>
                {/* Feedback widget after action taken */}
                {(isDone || isRejected) && feedbackTriggered.has(suggestion.id) && (
                  <div className="mt-2 border-t border-[#123c3a]/5 pt-2">
                    <SuggestionFeedback
                      resumeId={resumeId}
                      suggestionId={suggestion.id}
                      category={suggestion.category}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
