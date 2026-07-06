"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import { SuggestionDiffModal, type ApplyState } from "../../../components/suggestion-diff-modal";
import { SuggestionFeedback } from "../../../components/suggestion-feedback";
import { createOperations } from "@careerlaunch/ai";
import { useAnalytics } from "../../../lib/analytics";
import type { Suggestion, ApplyOperation } from "@careerlaunch/ai";

interface MatchState {
  status: "idle" | "loading" | "success" | "error";
  matchScore: number | null;
  missingSkills: string[];
  presentSkills: string[];
  suggestions: Suggestion[];
  error: string | null;
}

interface SuggestionWithStatus extends Suggestion {
  status: "pending" | "accepted" | "rejected";
}

interface JobMatchPanelProps {
  resumeId: string;
  /** Called when the user accepts a suggestion — maps to operations and persists. */
  onApplySuggestion: (operations: ApplyOperation[]) => Promise<{
    appliedChanges?: { operation: string; path: string; before: string | null; after: string | null }[];
    error?: string;
  }>;
}

export function JobMatchPanel({ resumeId, onApplySuggestion }: JobMatchPanelProps) {
  const analytics = useAnalytics();
  const [jobDescription, setJobDescription] = useState("");
  const [match, setMatch] = useState<MatchState>({
    status: "idle",
    matchScore: null,
    missingSkills: [],
    presentSkills: [],
    suggestions: [],
    error: null,
  });

  // Track local suggestion statuses for the review/accept flow
  const [suggestionStatuses, setSuggestionStatuses] = useState<
    Record<string, "pending" | "accepted" | "rejected">
  >({});

  // ── Modal state ───────────────────────────────────────────────────
  const [reviewingSuggestion, setReviewingSuggestion] = useState<SuggestionWithStatus | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [modalError, setModalError] = useState<string | undefined>();
  const [feedbackTriggered, setFeedbackTriggered] = useState<Set<string>>(new Set());

  // Fire-and-forget lifecycle event
  const fireEvent = async (suggestionId: string, action: string) => {
    try {
      await fetch(`/api/resumes/${resumeId}/suggestions/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action, category: "job-match" }),
      });
    } catch { /* non-critical */ }
  };

  const runMatch = useCallback(async () => {
    if (!jobDescription.trim()) return;

    setMatch((prev) => ({ ...prev, status: "loading", error: null }));

    try {
      const response = await fetch(`/api/resumes/${resumeId}/job-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Job match failed");
      }

      const data = await response.json();

      analytics.capture("job_match_run", {
        matchScore: data.matchScore,
        missingSkillsCount: data.missingSkills?.length ?? 0,
        suggestionsCount: data.suggestions?.length ?? 0,
      });

      setMatch({
        status: "success",
        matchScore: data.matchScore,
        missingSkills: data.missingSkills ?? [],
        presentSkills: data.presentSkills ?? [],
        suggestions: data.suggestions ?? [],
        error: null,
      });

      // Reset suggestion statuses
      const initial: Record<string, "pending"> = {};
      for (const s of data.suggestions ?? []) {
        initial[s.id] = "pending";
      }
      setSuggestionStatuses(initial);
    } catch (error) {
      setMatch((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
    }
  }, [resumeId, jobDescription]);

  // ── Review handler — opens the diff modal ─────────────────────────
  function handleReview(id: string) {
    const suggestion = match.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    setReviewingSuggestion({
      ...suggestion,
      status: suggestionStatuses[id] ?? "pending",
    });
    setApplyState("idle");
    setModalError(undefined);
    fireEvent(id, "viewed");
  }

  // ── Apply handler — called from the modal ─────────────────────────
  async function handleApplyFromModal(id: string) {
    setModalError(undefined);

    const suggestion = match.suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    // createOperations needs resume context; for add_skill we just need
    // the skill name which is in suggestedText
    const emptyResume = {
      contact: { fullName: "", email: "", phone: "", location: "", website: "" },
      summary: "",
      sections: [],
      skills: [],
      certifications: [],
      projects: [],
    };

    const operations = createOperations(suggestion, emptyResume);
    if (!operations) {
      setModalError("This suggestion cannot be applied automatically yet.");
      setApplyState("error");
      return;
    }

    setApplyState("applying");

    const result = await onApplySuggestion(operations);

    if (result.error) {
      setModalError(result.error);
      setApplyState("error");
    } else {
      setSuggestionStatuses((prev) => ({ ...prev, [id]: "accepted" }));
      setApplyState("applied");
      fireEvent(id, "applied");
      setFeedbackTriggered((prev) => new Set(prev).add(id));
    }
  }

  function handleCloseModal() {
    setReviewingSuggestion(null);
    setApplyState("idle");
    setModalError(undefined);
  }

  function handleReject(id: string) {
    setSuggestionStatuses((prev) => ({ ...prev, [id]: "rejected" }));
    fireEvent(id, "rejected");
    setFeedbackTriggered((prev) => new Set(prev).add(id));
  }

  // ── Score color ───────────────────────────────────────────────────
  function scoreColor(score: number | null): string {
    if (score === null) return "text-[#4b4b4b]";
    if (score >= 80) return "text-[#00796f]";
    if (score >= 50) return "text-[#7b5300]";
    return "text-red-700";
  }

  // ── State: empty / idle ──────────────────────────────────────────
  if (match.status === "idle") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#e8f5e9]">
            <FileText size={26} className="text-[#00796f]" />
          </div>
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Job Match
            </h2>
            <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-[#4b4b4b]">
              Paste a job description to see how well your resume matches.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="jobmatch-jd" className="text-xs font-black uppercase tracking-wide text-[#4b4b4b]">Paste job description</label>
          <textarea
            id="jobmatch-jd"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job description here..."
            rows={6}
            className="w-full resize-none rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-4 text-sm leading-relaxed placeholder:text-[#4b4b4b]/40 focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
          <button
            type="button"
            onClick={runMatch}
            disabled={!jobDescription.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#123c3a] bg-[#123c3a] px-6 font-black text-white transition hover:bg-[#1a5550] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={18} /> Analyze Match
          </button>
        </div>
      </section>
    );
  }

  // ── State: loading ───────────────────────────────────────────────
  if (match.status === "loading") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 size={28} className="animate-spin text-[#123c3a]" />
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Analyzing match
            </h2>
            <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
              Comparing your resume against the job description...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── State: error ─────────────────────────────────────────────────
  if (match.status === "error") {
    return (
      <section className="rounded-[30px] border border-red-200 bg-red-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <AlertCircle size={24} className="text-red-600" />
          <div>
            <h2 className="font-signal text-lg font-black tracking-[-0.04em] text-red-800">
              Match failed
            </h2>
            <p className="mt-1 text-sm font-medium text-red-700">{match.error}</p>
          </div>
          <button
            type="button"
            onClick={runMatch}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 text-xs font-black text-red-800 transition hover:bg-red-100"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // ── State: success ───────────────────────────────────────────────
  const pendingSuggestions = match.suggestions.filter(
    (s) => (suggestionStatuses[s.id] ?? "pending") === "pending",
  );

  return (
    <>
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
          Job Match
        </h2>

        {/* Match score */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-current text-center text-lg font-black leading-none tracking-tight">
            <span className={scoreColor(match.matchScore)}>
              {match.matchScore ?? "—"}
            </span>
          </div>
          <div className="text-sm font-medium text-[#4b4b4b]">
            {match.matchScore !== null ? (
              <>
                Match score
                <br />
                <span className={scoreColor(match.matchScore)}>
                  {match.matchScore >= 80
                    ? "Strong match"
                    : match.matchScore >= 50
                      ? "Moderate match"
                      : "Weak match"}
                </span>
              </>
            ) : (
              "No skills extracted from this job description."
            )}
          </div>
        </div>

        {/* Skill comparison */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          {/* Missing skills */}
          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-red-700">
              <XCircle size={14} />
              Missing ({match.missingSkills.length})
            </div>
            {match.missingSkills.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {match.missingSkills.map((skill) => (
                  <li key={skill} className="text-sm font-medium text-red-800">
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-red-600/60">
                No missing skills
              </p>
            )}
          </div>

          {/* Present skills */}
          <div className="rounded-2xl border border-green-100 bg-green-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#00796f]">
              <CheckCircle2 size={14} />
              Present ({match.presentSkills.length})
            </div>
            {match.presentSkills.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {match.presentSkills.map((skill) => (
                  <li key={skill} className="text-sm font-medium text-green-800">
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-green-600/60">
                No matching skills
              </p>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {pendingSuggestions.length > 0 && (
          <div className="mt-5 border-t border-[#123c3a]/10 pt-4">
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[#4b4b4b]">
              Suggestions
            </h3>
            <div className="space-y-2">
              {pendingSuggestions.map((suggestion) => {
                const status = suggestionStatuses[suggestion.id] ?? "pending";
                return (
                  <div
                    key={suggestion.id}
                    className={`flex items-center justify-between rounded-2xl border p-3 transition ${
                      status === "accepted"
                        ? "border-[#b9ff66]/40 bg-[#b9ff66]/10 opacity-60"
                        : status === "rejected"
                          ? "border-[#123c3a]/10 bg-[#f8f8f5] opacity-50"
                          : "border-[#123c3a]/10 bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black">{suggestion.title}</p>
                      <p className="mt-0.5 text-xs font-medium text-[#4b4b4b]">
                        {suggestion.reason}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1.5">
                      {status === "pending" && (
                        <>
                          <button
                            type="button"
                            aria-label="Review suggestion"
                            title="Review suggestion"
                            onClick={() => handleReview(suggestion.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#b9ff66] bg-white px-3 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
                          >
                            <Eye size={14} />
                            Review
                          </button>
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
                      {status === "accepted" && (
                        <span className="rounded-xl bg-[#b9ff66]/30 px-3 py-1.5 text-xs font-black text-[#00796f]">
                          Added
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="rounded-xl bg-[#123c3a]/8 px-3 py-1.5 text-xs font-black text-[#4b4b4b]">
                          Dismissed
                        </span>
                      )}
                    </div>
                    {(status === "accepted" || status === "rejected") && feedbackTriggered.has(suggestion.id) && (
                      <div className="mt-2 border-t border-[#123c3a]/5 pt-2">
                        <SuggestionFeedback
                          resumeId={resumeId}
                          suggestionId={suggestion.id}
                          category="job-match"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Re-analyze */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#4b4b4b]">
            {match.matchScore !== null
              ? `${match.missingSkills.length + match.presentSkills.length} skills found`
              : "No skills extracted"}
          </p>
          <button
            type="button"
            onClick={runMatch}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-white px-3 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
          >
            <Sparkles size={14} /> Re-analyze
          </button>
        </div>
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
