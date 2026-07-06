"use client";

import { Check, X, AlertTriangle, AlertCircle, Info as InfoIcon, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SuggestionFeedback } from "../../../components/suggestion-feedback";
import { ConfidenceBar } from "../../../components/confidence-bar";
import type { ClientSuggestion } from "./types";

const severityConfig = {
  critical: { icon: AlertCircle, label: "Critical", color: "border-red-400 bg-red-50 text-red-800" },
  major: { icon: AlertTriangle, label: "Major", color: "border-orange-300 bg-orange-50 text-orange-800" },
  medium: { icon: AlertTriangle, label: "Medium", color: "border-[#e0aa22]/40 bg-[#fff7df] text-[#7b5300]" },
  minor: { icon: InfoIcon, label: "Minor", color: "border-[#123c3a]/10 bg-[#f8f8f5] text-[#4b4b4b]" },
  info: { icon: InfoIcon, label: "Info", color: "border-blue-200 bg-blue-50 text-blue-800" },
};

export function SuggestionCard({
  suggestion,
  onReview,
  onReject,
  resumeId,
}: {
  suggestion: ClientSuggestion;
  onReview: (id: string) => void;
  onReject: (id: string) => void;
  resumeId?: string;
}) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  const isResolved = suggestion.status === "accepted" || suggestion.status === "rejected";

  // Compute a one-line summary for the collapsed state
  const collapsedSummary = suggestion.reason
    ? suggestion.reason.length > 100
      ? suggestion.reason.slice(0, 100) + "…"
      : suggestion.reason
    : "";

  return (
    <div
      className={`rounded-2xl border transition ${
        expanded
          ? config.color
          : "border-[#123c3a]/10 bg-white"
      } ${
        isResolved ? "opacity-50" : ""
      }`}
    >
      {/* ── Collapsed header (always visible) ────────────────────────── */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/60 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.1em]">
              {config.label}
            </span>
            {suggestion.source === "static" && (
              <span className="rounded-md bg-[#123c3a]/8 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                Auto
              </span>
            )}
          </div>

          <h3 className="mt-1 text-sm font-black">{suggestion.title}</h3>

          {/* One-line summary in collapsed state */}
          {!expanded && collapsedSummary && (
            <p className="mt-1 text-xs font-medium leading-5 text-[#4b4b4b]">
              {collapsedSummary}
            </p>
          )}
        </div>

        {/* Action buttons — always visible when pending */}
        {!isResolved && (
          <div className="flex shrink-0 gap-1.5">
            {suggestion.suggestedText ? (
              <button
                type="button"
                aria-label="Review suggestion"
                title="Review suggestion"
                onClick={() => onReview(suggestion.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#b9ff66] bg-white px-3 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
              >
                <Eye size={15} />
                Review
              </button>
            ) : (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 text-xs font-medium text-[#4b4b4b]">
                <InfoIcon size={14} />
                Info
              </span>
            )}
            <button
              type="button"
              aria-label="Dismiss suggestion"
              title="Dismiss"
              onClick={() => onReject(suggestion.id)}
              className="inline-grid h-9 w-9 place-items-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {suggestion.status === "accepted" && (
          <div className="shrink-0 rounded-xl bg-[#b9ff66]/30 px-3 py-2 text-xs font-black text-[#00796f]">
            Accepted
          </div>
        )}
        {suggestion.status === "rejected" && (
          <div className="shrink-0 rounded-xl bg-[#123c3a]/8 px-3 py-2 text-xs font-black text-[#4b4b4b]">
            Dismissed
          </div>
        )}
      </div>

      {/* ── Expand/collapse toggle ─────────────────────────────────── */}
      {(suggestion.reason || suggestion.targetText || suggestion.suggestedText || typeof suggestion.confidence === "number") && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`flex w-full items-center justify-center gap-1 border-t px-4 py-2 text-xs font-medium transition ${
            expanded
              ? "border-[#123c3a]/8 text-[#00796f]"
              : "border-[#123c3a]/5 text-[#4b4b4b]/60 hover:text-[#00796f]"
          }`}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              Less detail
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              More detail
            </>
          )}
        </button>
      )}

      {/* ── Expanded content ──────────────────────────────────────── */}
      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {suggestion.reason && (
            <div>
              <p className="text-xs font-black text-[#123c3a]">Why</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#4b4b4b]">
                {suggestion.reason}
              </p>
            </div>
          )}

          {typeof suggestion.confidence === "number" && (
            <div className="max-w-[180px]">
              <ConfidenceBar confidence={suggestion.confidence} />
            </div>
          )}

          {suggestion.targetText && (
            <div className="rounded-xl border border-current/15 bg-white/40 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.08em] opacity-60">
                Current text
              </p>
              <p className="mt-1 text-sm italic">{suggestion.targetText}</p>
            </div>
          )}

          {suggestion.suggestedText && (
            <div className="rounded-xl border border-[#b9ff66] bg-[#b9ff66]/20 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#00796f]">
                Suggestion
              </p>
              <p className="mt-1 text-sm">{suggestion.suggestedText}</p>
            </div>
          )}
        </div>
      )}

      {/* Feedback widget after action taken */}
      {(suggestion.status === "accepted" || suggestion.status === "rejected") && resumeId && (
        <div className="border-t border-[#123c3a]/5 px-4 pb-3 pt-2">
          <SuggestionFeedback
            resumeId={resumeId}
            suggestionId={suggestion.id}
            category={suggestion.category}
          />
        </div>
      )}
    </div>
  );
}
