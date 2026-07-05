"use client";

import { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

export type FeedbackReason =
  | "too_generic"
  | "incorrect"
  | "invented"
  | "doesnt_match"
  | "other";

interface SuggestionFeedbackProps {
  resumeId: string;
  suggestionId: string;
  category: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  /** Called after feedback is submitted */
  onFeedbackSubmitted?: () => void;
}

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = [
  { value: "too_generic", label: "Too generic" },
  { value: "incorrect", label: "Incorrect" },
  { value: "invented", label: "Invented information" },
  { value: "doesnt_match", label: "Doesn't match my writing" },
  { value: "other", label: "Other" },
];

// ── Component ────────────────────────────────────────────────────────────

/**
 * Lightweight feedback widget shown after a suggestion is acted on.
 * Captures 👍/👎 and optionally a reason for 👎.
 */
export function SuggestionFeedback({
  resumeId,
  suggestionId,
  category,
  provider,
  model,
  promptVersion,
  onFeedbackSubmitted,
}: SuggestionFeedbackProps) {
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FeedbackReason | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = useCallback(
    async (isHelpful: boolean, reason?: FeedbackReason, text?: string) => {
      try {
        await fetch(`/api/resumes/${resumeId}/suggestions/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suggestionId,
            helpful: isHelpful,
            reason: reason ?? null,
            reasonText: text ?? null,
            category,
            provider: provider ?? null,
            model: model ?? null,
            promptVersion: promptVersion ?? null,
          }),
        });
      } catch {
        // Non-critical — swallow
      }
      setSubmitted(true);
      onFeedbackSubmitted?.();
    },
    [resumeId, suggestionId, category, provider, model, promptVersion, onFeedbackSubmitted],
  );

  const fireEvent = useCallback(
    async (action: string) => {
      try {
        await fetch(`/api/resumes/${resumeId}/suggestions/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, action, category }),
        });
      } catch {
        // Non-critical — swallow
      }
    },
    [resumeId, suggestionId, category],
  );

  if (submitted) {
    return (
      <div className="text-[0.6rem] font-medium text-[#4b4b4b]/50">
        Thank you for your feedback
      </div>
    );
  }

  if (showReasons) {
    return (
      <div className="w-full space-y-1.5">
        <p className="text-[0.6rem] font-medium text-[#4b4b4b]/60">Why not?</p>
        <div className="flex flex-wrap gap-1.5">
          {REASON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSelectedReason(opt.value);
                if (opt.value !== "other") {
                  submitFeedback(false, opt.value);
                }
              }}
              className={`rounded-lg border px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.05em] transition ${
                selectedReason === opt.value
                  ? "border-[#00796f] bg-[#b9ff66]/20 text-[#00796f]"
                  : "border-[#123c3a]/10 bg-white text-[#4b4b4b] hover:bg-[#f8f8f5]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selectedReason === "other" && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Tell us more..."
              className="flex-1 rounded-lg border border-[#123c3a]/10 bg-[#f8f8f5] px-2 py-1 text-xs placeholder:text-[#4b4b4b]/40 focus:border-[#00796f] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                submitFeedback(false, "other", reasonText);
              }}
              disabled={!reasonText.trim()}
              className="rounded-lg border border-[#b9ff66] bg-[#b9ff66] px-2 py-1 text-[0.55rem] font-black text-[#123c3a] transition hover:bg-[#a8ee55] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => submitFeedback(false)}
          className="rounded-lg border border-[#123c3a]/10 bg-white px-2 py-1 text-[0.55rem] font-black text-[#4b4b4b] transition hover:bg-[#f8f8f5]"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.6rem] font-medium text-[#4b4b4b]/60">
        Was this helpful?
      </span>
      <button
        type="button"
        onClick={() => {
          submitFeedback(true);
          fireEvent("accepted");
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#123c3a]/10 bg-white text-[#00796f] transition hover:bg-[#b9ff66] hover:text-[#123c3a]"
        aria-label="Helpful"
        title="Helpful"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => {
          setShowReasons(true);
          fireEvent("rejected");
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
        aria-label="Not helpful"
        title="Not helpful"
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  );
}
