"use client";

import { Sparkles, Gauge, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { ScoreGauge } from "./score-gauge";
import { SuggestionCard } from "./suggestion-card";
import type { AnalysisState, ClientSuggestion } from "./types";
import type { SuggestionSeverity, SuggestionCategory } from "@careerlaunch/ai";
import type { ApplyOperation } from "@careerlaunch/ai";
import { suggestionToOperation } from "../../../lib/suggestion-to-operation";

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
};

const severityOrder: SuggestionSeverity[] = ["critical", "major", "medium", "minor", "info"];

interface HealthDashboardProps {
  resumeId: string;
  /** Called when the user accepts a suggestion — maps it to operations and persists. */
  onApplySuggestion: (operations: ApplyOperation[]) => Promise<{
    appliedChanges?: { operation: string; path: string; before: string | null; after: string | null }[];
    error?: string;
  }>;
}

export function HealthDashboard({ resumeId, onApplySuggestion }: HealthDashboardProps) {
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: "idle",
    overallScore: null,
    suggestions: [],
    analyzedAt: null,
    error: null,
  });
  const [applyError, setApplyError] = useState<string | null>(null);

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

      setAnalysis({
        status: "success",
        overallScore: data.result.overallScore ?? 0,
        suggestions,
        analyzedAt: data.result.analyzedAt ?? null,
        error: null,
      });
    } catch (error) {
      setAnalysis((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
    }
  }, [resumeId]);

  async function handleAccept(id: string) {
    setApplyError(null);

    const suggestion = analysis.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const operations = suggestionToOperation(suggestion);
    if (!operations) {
      setApplyError("This suggestion cannot be applied automatically yet.");
      return;
    }

    // Optimistic local state: mark as accepted immediately
    setAnalysis((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((s) =>
        s.id === id ? { ...s, status: "accepted" as const } : s,
      ),
    }));

    const result = await onApplySuggestion(operations);

    if (result.error) {
      // Revert to pending — the apply failed
      setAnalysis((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) =>
          s.id === id ? { ...s, status: "pending" as const } : s,
        ),
      }));
      setApplyError(result.error);
    }
  }

  function handleReject(id: string) {
    setAnalysis((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((s) =>
        s.id === id ? { ...s, status: "rejected" as const } : s,
      ),
    }));
  }

  // Group suggestions by severity for display
  const groupedBySeverity = severityOrder
    .map((severity) => ({
      severity,
      items: analysis.suggestions.filter(
        (s) => s.severity === severity && s.status === "pending",
      ),
    }))
    .filter((g) => g.items.length > 0);

  const resolvedCount = analysis.suggestions.filter(
    (s) => s.status === "accepted" || s.status === "rejected",
  ).length;

  // ─── Idle state ───────────────────────────────────────────────
  if (analysis.status === "idle") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
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
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
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
      <section className="rounded-[30px] border border-red-200 bg-red-50 p-6 shadow-sm">
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
    if (s.status === "pending") {
      pendingByCategory.set(s.category, (pendingByCategory.get(s.category) ?? 0) + 1);
    }
  }

  return (
    <section className="rounded-[30px] border border-[#123c3a] bg-[#123c3a] p-6 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)]">
      {/* Apply error banner */}
      {applyError && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
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

      {/* Mini category breakdown */}
      {pendingByCategory.size > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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

      {pendingByCategory.size === 0 && (
        <div className="mt-6 rounded-2xl border border-[#b9ff66]/20 bg-[#b9ff66]/5 p-6 text-center">
          <p className="font-signal text-xl font-black tracking-[-0.04em] text-[#b9ff66]">
            No issues found
          </p>
          <p className="mt-1 text-sm text-white/60">
            Your resume looks great! Run the analysis again after making changes.
          </p>
        </div>
      )}

      {/* Re-analyze button */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/45">
          {analysis.suggestions.length} suggestion{analysis.suggestions.length !== 1 ? "s" : ""}
          {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
        </p>
        <button
          type="button"
          onClick={runAnalysis}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <RefreshCw size={14} /> Re-analyze
        </button>
      </div>
    </section>
  );
}
