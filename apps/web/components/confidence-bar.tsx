"use client";

// ── Types ────────────────────────────────────────────────────────────────

interface ConfidenceBarProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

// ── Color helpers ────────────────────────────────────────────────────────

function confidenceColor(confidence: number): {
  bg: string;
  text: string;
  fill: string;
  label: string;
} {
  if (confidence >= 0.8) {
    return { bg: "bg-[#00796f]/15", text: "text-[#00796f]", fill: "bg-[#00796f]", label: "High" };
  }
  if (confidence >= 0.5) {
    return { bg: "bg-[#7b5300]/15", text: "text-[#7b5300]", fill: "bg-[#e0aa22]", label: "Medium" };
  }
  return { bg: "bg-red-100", text: "text-red-700", fill: "bg-red-400", label: "Low" };
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * A small confidence indicator with a colored bar and optional label.
 *
 * - Green ≥80% → "High confidence"
 * - Yellow ≥50% → "Medium confidence"
 * - Red <50%   → "Low confidence"
 */
export function ConfidenceBar({ confidence, showLabel = true, size = "sm" }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const pct = Math.round(clamped * 100);
  const colors = confidenceColor(clamped);

  const barHeight = size === "sm" ? "h-1.5" : "h-2";
  const textSize = size === "sm" ? "text-[0.6rem]" : "text-xs";

  return (
    <div className="flex items-center gap-2">
      {/* Bar */}
      <div className={`flex-1 rounded-full ${colors.bg}`}>
        <div
          className={`rounded-full ${barHeight} ${colors.fill} transition-all`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence: ${pct}%`}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span className={`${textSize} font-black uppercase tracking-[0.08em] ${colors.text} shrink-0`}>
          {pct}%
        </span>
      )}
    </div>
  );
}
