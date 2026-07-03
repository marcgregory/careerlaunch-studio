"use client";

import { AlertTriangle } from "lucide-react";
import { SuggestionCard } from "./suggestion-card";
import type { ClientSuggestion } from "./types";
import type { SuggestionSeverity, SuggestionCategory } from "@careerlaunch/ai";

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

interface SuggestionsListProps {
  suggestions: ClientSuggestion[];
  onReview: (id: string) => void;
  onReject: (id: string) => void;
}

export function SuggestionsList({ suggestions, onReview, onReject }: SuggestionsListProps) {
  // Separate pending and resolved
  const pending = suggestions.filter((s) => s.status === "pending");
  const accepted = suggestions.filter((s) => s.status === "accepted");
  const rejected = suggestions.filter((s) => s.status === "rejected");

  // Group pending by severity
  const grouped = severityOrder
    .map((severity) => ({
      severity,
      items: pending.filter((s) => s.severity === severity),
    }))
    .filter((g) => g.items.length > 0);

  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#123c3a]/20 bg-[#f8f8f5] p-6 text-center">
        <AlertTriangle size={24} className="mx-auto text-[#4b4b4b]/40" />
        <p className="mt-2 text-sm font-black text-[#123c3a]">No suggestions</p>
        <p className="mt-1 text-xs font-medium text-[#4b4b4b]">
          Run a health check to see improvement suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending suggestions grouped by severity */}
      {grouped.map((group) => (
        <div key={group.severity}>
          <h3 className="mb-3 font-mono text-xs font-black uppercase tracking-[0.15em] text-[#4b4b4b]">
            {group.severity}
          </h3>
          <div className="space-y-3">
            {group.items.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onReview={onReview}
                onReject={onReject}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Resolved summary */}
      {(accepted.length > 0 || rejected.length > 0) && (
        <div className="border-t border-[#123c3a]/10 pt-4">
          <p className="text-xs font-medium text-[#4b4b4b]">
            {accepted.length > 0 && `${accepted.length} accepted`}
            {accepted.length > 0 && rejected.length > 0 && " · "}
            {rejected.length > 0 && `${rejected.length} dismissed`}
          </p>
        </div>
      )}
    </div>
  );
}
