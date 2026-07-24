"use client";

import { Sparkles, Gauge, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ScoreGauge } from "./score-gauge";
import { SuggestionCard } from "./suggestion-card";
import { SuggestionDiffModal, type ApplyState } from "../../../components/suggestion-diff-modal";
import { useAnalytics } from "../../../lib/analytics";
import type { AnalysisState, ClientSuggestion } from "./types";
import type { SuggestionSeverity, SuggestionCategory } from "@careerlaunch/ai";
import type { ApplyOperation } from "@careerlaunch/ai";
import { suggestionToOperation } from "@careerlaunch/ai";
import {
  countAppliedSuggestions,
  countDetectedIssues,
  countDismissedSuggestions,
  isPendingSuggestion,
} from "./suggestion-state";

const categoryLabels: Record<SuggestionCategory, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  contact: "Contact",
  formatting: "Formatting",
  ats: "ATS Compatibility",
  grammar: "Grammar & Style",
  impact: "Impact & Metrics",
  keywords: "Keyword Match",
  completeness: "Completeness",
  "job-match": "Job Match",
};

const severityOrder: SuggestionSeverity[] = ["critical", "major", "medium", "minor", "info"];

import { useQueryClient } from "@tanstack/react-query";
import { syncAnalysisInDashboardCache } from "./cache-utils";

interface HealthDashboardProps {
  resumeId: string;
  /** Called when the user accepts a suggestion — maps it to operations and persists. */
  onApplySuggestion: (operations: ApplyOperation[]) => Promise<{
    appliedChanges?: { operation: string; path: string; before: string | null; after: string | null }[];
    error?: string;
  }>;
}

export function HealthDashboard({ resumeId, onApplySuggestion }: HealthDashboardProps) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: "idle",
    overallScore: null,
    suggestions: [],
    statistics: null,
    analyzedAt: null,
    error: null,
  });
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Modal state ───────────────────────────────────────────────────
  const [reviewingSuggestion, setReviewingSuggestion] = useState<ClientSuggestion | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [modalError, setModalError] = useState<string | undefined>();

  // Fire-and-forget lifecycle event
  const fireEvent = async (suggestionId: string, action: string, category: string) => {
    try {
      await fetch(`/api/resumes/${resumeId}/suggestions/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action, category }),
      });
    } catch { /* non-critical */ }
  };

  const runAnalysis = useCallback(async () => {
    setAnalysis((prev) => ({ ...prev, status: "loading", error: null }));
    setApplyError(null);

    try {
      const response = await fetch(`/api/resumes/${resumeId}/analyze`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Analysis failed");
      }

      const data = await response.json();
      const suggestions: ClientSuggestion[] = (data.result.suggestions ?? []).map(
        (s: ClientSuggestion) => ({
          ...s,
          status: s.status ?? "pending",
        }),
      );

      analytics.capture("analysis_run", {
        overallScore: data.result.overallScore ?? 0,
        suggestionCount: suggestions.length,
      });
      setAnalysis({
        status: "success",
        overallScore: data.result.overallScore ?? 0,
        suggestions,
        statistics: data.result.resumeStatistics ?? null,
        analyzedAt: data.result.analyzedAt ?? null,
        error: null,
      });
      syncAnalysisInDashboardCache(queryClient, resumeId);
      queryClient.invalidateQueries({ queryKey: ["resumes"], refetchType: "none" });
      toast.success(`Analysis complete — score: ${data.result.overallScore ?? 0}/100`);
    } catch (error) {
      setAnalysis((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
      toast.error("Resume analysis failed. Please try again.");
    }
  }, [analytics, queryClient, resumeId]);

  // ── Review handler — opens the diff modal ─────────────────────────
  function handleReview(id: string) {
    const suggestion = analysis.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    setReviewingSuggestion(suggestion);
    setApplyState("idle");
    setModalError(undefined);
    fireEvent(id, "viewed", suggestion.category);
  }

  // ── Apply handler — called from the modal ─────────────────────────
  async function handleApplyFromModal(id: string) {
    setApplyError(null);
    setModalError(undefined);

    const suggestion = analysis.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const operations = suggestionToOperation(suggestion);
    if (!operations) {
      // For info-only suggestions (no suggestedText), skip apply entirely
      if (!suggestion.suggestedText) {
        setModalError("This is an informational suggestion — no automatic text change available.");
        setApplyState("error");
      } else {
        setModalError("This suggestion cannot be applied automatically yet.");
        setApplyState("error");
      }
      return;
    }

    setApplyState("applying");

    const result = await onApplySuggestion(operations);

    if (result.error) {
      setModalError(result.error);
      setApplyState("error");
    } else {
      // Update local state: mark as accepted
      setAnalysis((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) =>
          s.id === id ? { ...s, status: "applied" as const } : s,
        ),
      }));
      setApplyState("applied");
      if (suggestion) fireEvent(id, "applied", suggestion.category);
      void runAnalysis();
      // Modal auto-closes after 1.5s (handled in SuggestionDiffModal)
    }
  }

  function handleCloseModal() {
    setReviewingSuggestion(null);
    setApplyState("idle");
    setModalError(undefined);
  }

  function handleReject(id: string) {
    const suggestion = analysis.suggestions.find((s) => s.id === id);
    setAnalysis((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((s) =>
        s.id === id ? { ...s, status: "dismissed" as const } : s,
      ),
    }));
    if (suggestion) fireEvent(id, "dismissed", suggestion.category);
  }

  // Group suggestions by severity for display
  const groupedBySeverity = severityOrder
    .map((severity) => ({
      severity,
      items: analysis.suggestions.filter(
        (s) => s.severity === severity && isPendingSuggestion(s),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const resolvedCount = countAppliedSuggestions(analysis.suggestions);
  const dismissedCount = countDismissedSuggestions(analysis.suggestions);
  const detectedIssueCount = countDetectedIssues(analysis.suggestions);

  // ─── Idle state ───────────────────────────────────────────────
  if (analysis.status === "idle") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66]">
            <Sparkles size={30} />
          </div>
          <div>
            <h2 className="font-signal text-2xl font-black tracking-[-0.05em]">
              Resume Health Check
            </h2>
            <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-[#4b4b4b]">
              Analyze your resume for ATS compatibility, grammar issues, impact scoring,
              keyword density, and completeness.
            </p>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#123c3a] bg-[#123c3a] px-6 font-black text-white transition hover:bg-[#1a5550]"
          >
            <Sparkles size={18} /> Analyze Resume
          </button>
        </div>
      </section>
    );
  }

  // ─── Loading state ────────────────────────────────────────────
  if (analysis.status === "loading") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <Loader2 size={32} className="animate-spin text-[#123c3a]" />
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Analyzing your resume
            </h2>
            <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
              Checking ATS compatibility, grammar, impact, and more...
            </p>
          </div>

          {/* Animated skeleton checks */}
          <div className="mt-4 w-full max-w-xs space-y-3">
            {["ATS compatibility", "Grammar & style", "Impact statements", "Keyword density", "Completeness"].map(
              (label) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-[#b9ff66]" />
                  <div className="h-3 flex-1 animate-pulse rounded-full bg-[#123c3a]/10" />
                  <span className="text-xs font-medium text-[#4b4b4b]">{label}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    );
  }

  // ─── Error state ──────────────────────────────────────────────
  if (analysis.status === "error") {
    return (
      <section className="rounded-[30px] border border-red-200 bg-red-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <AlertCircle size={28} className="text-red-600" />
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em] text-red-800">
              Analysis failed
            </h2>
            <p className="mt-1 text-sm font-medium text-red-700">{analysis.error}</p>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-300 bg-white px-5 font-black text-red-800 transition hover:bg-red-100"
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      </section>
    );
  }

  // ─── Success state ────────────────────────────────────────────
  const score = analysis.overallScore ?? 0;

  // Count by category for the mini-breakdown
  const pendingByCategory = new Map<SuggestionCategory, number>();
  for (const s of analysis.suggestions) {
    if (isPendingSuggestion(s)) {
      pendingByCategory.set(s.category, (pendingByCategory.get(s.category) ?? 0) + 1);
    }
  }

  return (
    <>
      <section className="rounded-[30px] border border-[#123c3a] bg-[#123c3a] p-4 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)] sm:p-6">
        {/* Apply error banner (for errors outside the modal) */}
        {applyError && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="font-medium">{applyError}</p>
          </div>
        )}

        {/* Score header */}
        <div className="flex items-start justify-between gap-3">
          <ScoreGauge score={score} />
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
            <Sparkles size={25} />
          </div>
        </div>

        {/* Severity summary */}
        <div className="mt-6 flex gap-3">
          {(["critical", "major", "medium", "minor"] as const).map((sev) => {
            const count = analysis.suggestions.filter(
              (s) => s.severity === sev && isPendingSuggestion(s),
            ).length;
            if (count === 0) return null;
            const sevColors: Record<string, string> = {
              critical: "border-red-400/30 text-red-300",
              major: "border-orange-300/30 text-orange-200",
              medium: "border-amber-400/30 text-amber-200",
              minor: "border-white/10 text-white/60",
            };
            return (
              <div
                key={sev}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black uppercase ${sevColors[sev]}`}
              >
                <span>{count}</span>
                <span className="opacity-70">{sev}</span>
              </div>
            );
          })}
        </div>

        {/* Resume Statistics */}
        {analysis.statistics && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-white/45">
              <span>Resume Statistics</span>
              <Gauge size={18} className="text-[#b9ff66]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Skills", value: analysis.statistics.skills },
                { label: "Certifications", value: analysis.statistics.certifications },
                { label: "Projects", value: analysis.statistics.projects },
                { label: "Experience", value: analysis.statistics.experienceEntries },
                { label: "Education", value: analysis.statistics.educationEntries },
                { label: "Bullets", value: analysis.statistics.bulletPoints },
              ].map(
                (stat) =>
                  stat.value > 0 && (
                    <div key={stat.label} className="rounded-xl bg-white/8 p-2">
                      <p className="text-lg font-black text-white">{stat.value}</p>
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-white/50">
                        {stat.label}
                      </p>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Mini category breakdown */}
        {pendingByCategory.size > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-white/45">
              <span>Issues found</span>
              <Gauge size={18} className="text-[#b9ff66]" />
            </div>
            <div className="space-y-2">
              {Array.from(pendingByCategory.entries()).map(([category, count]) => (
                <div
                  key={category}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-white/80">
                    {categoryLabels[category]}
                  </span>
                  <span className="rounded-lg bg-white/10 px-2.5 py-0.5 text-xs font-black">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detectedIssueCount === 0 && (
          <div className="mt-6 rounded-2xl border border-[#b9ff66]/20 bg-[#b9ff66]/5 p-4 text-center sm:p-6">
            <p className="font-signal text-xl font-black tracking-[-0.04em] text-[#b9ff66]">
              No issues found
            </p>
            <p className="mt-1 text-sm text-white/60">
              Your resume looks great! Run the analysis again after making changes.
            </p>
          </div>
        )}

        {detectedIssueCount > 0 && pendingByCategory.size === 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center sm:p-6">
            <p className="font-signal text-xl font-black tracking-[-0.04em] text-white">
              All current issues are dismissed
            </p>
            <p className="mt-1 text-sm text-white/60">
              Dismissed suggestions are not resolved. Re-analyze to check whether the issue still exists.
            </p>
          </div>
        )}

        {/* Re-analyze button */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-white/45">
            {analysis.suggestions.length} suggestion{analysis.suggestions.length !== 1 ? "s" : ""}
            {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
            {dismissedCount > 0 && ` · ${dismissedCount} dismissed`}
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <RefreshCw size={14} /> Re-analyze
          </button>
        </div>

        {/* Suggestions list */}
        {groupedBySeverity.map((group) => (
          <div key={group.severity} className="mt-6">
            <h3 className="mb-3 font-mono text-xs font-black uppercase tracking-[0.15em] text-white/50">
              {group.severity}
            </h3>
            <div className="space-y-3">
              {group.items.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onReview={handleReview}
                  onReject={handleReject}
                  resumeId={resumeId}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Resolved summary */}
        {resolvedCount > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-medium text-white/45">
              {resolvedCount} resolved
            </p>
          </div>
        )}
      </section>

      {/* Diff Review Modal */}
      {reviewingSuggestion && (
        <SuggestionDiffModal
          suggestion={reviewingSuggestion}
          applyState={applyState}
          applyError={modalError}
          onApply={handleApplyFromModal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
