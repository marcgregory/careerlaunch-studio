"use client";

import { Check, X, Loader2, AlertCircle, Eye } from "lucide-react";
import { useEffect, useCallback } from "react";
import { DiffView } from "./diff-view";
import type { ClientSuggestion } from "../app/builder/_analysis/types";

// ── Types ────────────────────────────────────────────────────────────

export type ApplyState = "idle" | "applying" | "applied" | "error";

interface SuggestionDiffModalProps {
  /** The suggestion being reviewed */
  suggestion: ClientSuggestion;
  /** Current apply state */
  applyState: ApplyState;
  /** Error message when applyState is "error" */
  applyError?: string;
  /** Called when the user clicks Apply */
  onApply: (id: string) => void;
  /** Called to close the modal (Cancel, dismiss, or after success) */
  onClose: () => void;
}

// ── Severity config (same as SuggestionCard) ─────────────────────────

const severityMeta = {
  critical: { label: "Critical", color: "text-red-700 bg-red-100 border-red-200" },
  major: { label: "Major", color: "text-orange-700 bg-orange-100 border-orange-200" },
  medium: { label: "Medium", color: "text-[#7b5300] bg-[#fff7df] border-[#e0aa22]/40" },
  minor: { label: "Minor", color: "text-[#4b4b4b] bg-[#f8f8f5] border-[#123c3a]/10" },
  info: { label: "Info", color: "text-blue-700 bg-blue-50 border-blue-200" },
};

// ── Component ────────────────────────────────────────────────────────

export function SuggestionDiffModal({
  suggestion,
  applyState,
  applyError,
  onApply,
  onClose,
}: SuggestionDiffModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && applyState !== "applying") onClose();
    },
    [onClose, applyState],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-close after successful apply
  useEffect(() => {
    if (applyState === "applied") {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [applyState, onClose]);

  const severity = severityMeta[suggestion.severity];
  const showDiff = suggestion.targetText || suggestion.suggestedText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click (only when not applying)
        if (e.target === e.currentTarget && applyState !== "applying") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Review suggestion: ${suggestion.title}`}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[28px] border border-[#123c3a]/10 bg-white shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 border-b border-[#123c3a]/8 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.1em] ${severity.color}`}
              >
                {severity.label}
              </span>
              {suggestion.source === "static" && (
                <span className="rounded-md bg-[#123c3a]/8 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                  Auto
                </span>
              )}
            </div>
            <h2 className="mt-2 pr-6 font-signal text-lg font-black tracking-[-0.04em] text-[#123c3a]">
              {suggestion.title}
            </h2>
            {suggestion.reason && (
              <p className="mt-1 text-sm leading-relaxed text-[#4b4b4b]">
                {suggestion.reason}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applyState === "applying"}
            className="shrink-0 rounded-xl border border-[#123c3a]/10 bg-white p-2 text-[#4b4b4b] transition hover:border-[#123c3a]/20 hover:text-[#123c3a] disabled:opacity-40"
            aria-label="Close review"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Diff Area ───────────────────────────────────────────── */}
        <div className="overflow-y-auto px-6 py-5">
          {showDiff ? (
            <DiffView
              oldText={suggestion.targetText ?? ""}
              newText={suggestion.suggestedText ?? ""}
              oldLabel="Current"
              newLabel="Suggested"
            />
          ) : (
            <div className="rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] p-6 text-center text-sm text-[#4b4b4b]">
              <Eye size={24} className="mx-auto text-[#4b4b4b]/40" />
              <p className="mt-2 font-medium">
                Informational suggestion — no text change required.
              </p>
            </div>
          )}

          {/* ── Apply error ────────────────────────────────────────── */}
          {applyState === "error" && applyError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="font-medium">{applyError}</p>
            </div>
          )}

          {/* ── Applied success ──────────────────────────────────── */}
          {applyState === "applied" && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#b9ff66] bg-[#b9ff66]/20 p-4 text-[#00796f]">
              <Check size={20} />
              <span className="font-black">Applied successfully</span>
            </div>
          )}
        </div>

        {/* ── Footer actions ──────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 border-t border-[#123c3a]/8 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applyState === "applying"}
            className="min-h-10 rounded-xl border border-[#123c3a]/10 bg-white px-5 text-sm font-black text-[#4b4b4b] transition hover:border-[#123c3a]/20 hover:text-[#123c3a] disabled:opacity-40"
          >
            {applyState === "applied" ? "Close" : "Cancel"}
          </button>

          {/* Show Apply button only when not already applied */}
          {applyState !== "applied" && (
            <button
              type="button"
              onClick={() => onApply(suggestion.id)}
              disabled={applyState === "applying"}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#b9ff66] bg-[#b9ff66] px-5 text-sm font-black text-[#123c3a] transition hover:bg-[#a8ee55] disabled:opacity-50"
            >
              {applyState === "applying" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Apply
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
