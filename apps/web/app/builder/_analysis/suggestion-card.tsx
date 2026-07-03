"use client";

import { Check, X, AlertTriangle, AlertCircle, Info, ArrowBigUp, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ClientSuggestion } from "./types";

const severityConfig = {
  critical: { icon: AlertCircle, label: "Critical", color: "border-red-400 bg-red-50 text-red-800" },
  major: { icon: AlertTriangle, label: "Major", color: "border-orange-300 bg-orange-50 text-orange-800" },
  medium: { icon: AlertTriangle, label: "Medium", color: "border-[#e0aa22]/40 bg-[#fff7df] text-[#7b5300]" },
  minor: { icon: Info, label: "Minor", color: "border-[#123c3a]/10 bg-[#f8f8f5] text-[#4b4b4b]" },
  info: { icon: Info, label: "Info", color: "border-blue-200 bg-blue-50 text-blue-800" },
};

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: ClientSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  const isResolved = suggestion.status === "accepted" || suggestion.status === "rejected";

  return (
    <div
      className={`rounded-2xl border p-4 transition ${config.color} ${
        isResolved ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
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

          {/* Expand/collapse reason */}
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Less detail" : "More detail"}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 text-sm leading-relaxed">
              <p>{suggestion.reason}</p>
              {suggestion.targetText && (
                <div className="rounded-xl border border-current/15 bg-white/40 p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.08em] opacity-60">
                    Current text
                  </p>
                  <p className="mt-1 text-sm italic">{suggestion.targetText}</p>
                </div>
              )}
            </div>
          )}

          {suggestion.suggestedText && (
            <div className="mt-2 rounded-xl border border-[#b9ff66] bg-[#b9ff66]/20 p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#00796f]">
                Suggestion
              </p>
              <p className="mt-1 text-sm">{suggestion.suggestedText}</p>
            </div>
          )}
        </div>

        {/* Action buttons — only shown when pending */}
        {!isResolved && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              aria-label="Accept suggestion"
              title="Accept suggestion"
              onClick={() => onAccept(suggestion.id)}
              className="inline-grid h-9 w-9 place-items-center rounded-xl border border-[#b9ff66] bg-white text-[#123c3a] transition hover:bg-[#b9ff66]"
            >
              <Check size={18} />
            </button>
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
    </div>
  );
}
