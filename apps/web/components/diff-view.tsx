"use client";

/**
 * Simple word-level diff for before/after text comparison.
 *
 * Algorithm: split both strings into words, then LCS-match to find
 * added/removed/uniform segments.  Renders each segment as a styled
 * <span> so the user sees exactly what changed.
 *
 * Supports side-by-side (default) and inline layout.
 */

// ── Types ────────────────────────────────────────────────────────────

export type DiffSegment =
  | { kind: "same"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "added"; text: string };

export interface DiffResult {
  left: DiffSegment[];
  right: DiffSegment[];
}

// ── Word-diff algorithm (LCS-based) ──────────────────────────────────

function words(s: string): string[] {
  // Split on word boundaries, keeping whitespace/punctuation as tokens
  return s.match(/\S+\s*/g) ?? [];
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function computeDiff(a: string[], b: string[]): DiffResult {
  const dp = lcsTable(a, b);
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  // Build segments from the LCS traceback (reversed)
  const leftRev: DiffSegment[] = [];
  const rightRev: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      leftRev.push({ kind: "same", text: a[i - 1] });
      rightRev.push({ kind: "same", text: b[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      leftRev.push({ kind: "added", text: "" }); // placeholder keeps alignment
      rightRev.push({ kind: "added", text: b[j - 1] });
      j--;
    } else {
      leftRev.push({ kind: "removed", text: a[i - 1] });
      rightRev.push({ kind: "removed", text: "" }); // placeholder
      i--;
    }
  }

  // Reverse and merge adjacent segments of the same kind
  function merge(segs: DiffSegment[]): DiffSegment[] {
    const out: DiffSegment[] = [];
    for (const seg of segs) {
      const prev = out[out.length - 1];
      if (prev && prev.kind === seg.kind) {
        prev.text += seg.text;
      } else {
        out.push({ ...seg });
      }
    }
    return out;
  }

  const leftMerged = merge(leftRev.reverse());
  const rightMerged = merge(rightRev.reverse());

  // Remove empty "added" placeholders from left and "removed" from right
  left.length = 0;
  right.length = 0;
  for (let k = 0; k < Math.max(leftMerged.length, rightMerged.length); k++) {
    const l = leftMerged[k];
    const r = rightMerged[k];
    if (l && l.text) left.push(l);
    if (r && r.text) right.push(r);
  }

  return { left, right };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Compute word-level diff between two strings.
 */
export function wordDiff(oldText: string, newText: string): DiffResult {
  if (oldText === newText) {
    return { left: [{ kind: "same", text: oldText }], right: [{ kind: "same", text: newText }] };
  }
  if (!oldText) {
    return { left: [], right: [{ kind: "added", text: newText }] };
  }
  if (!newText) {
    return { left: [{ kind: "removed", text: oldText }], right: [] };
  }
  return computeDiff(words(oldText), words(newText));
}

// ── React Component ──────────────────────────────────────────────────

const segmentStyles: Record<string, string> = {
  same: "text-[#123c3a]",
  removed: "bg-red-100 text-red-800 line-through rounded px-0.5",
  added: "bg-[#b9ff66]/60 text-[#00796f] rounded px-0.5",
};

interface DiffViewProps {
  /** The original / current text */
  oldText: string;
  /** The suggested replacement text */
  newText: string;
  /** Layout mode */
  layout?: "side-by-side" | "inline";
  /** Label for the "before" column */
  oldLabel?: string;
  /** Label for the "after" column */
  newLabel?: string;
}

export function DiffView({
  oldText,
  newText,
  layout = "side-by-side",
  oldLabel = "Current",
  newLabel = "Suggested",
}: DiffViewProps) {
  const diff = wordDiff(oldText, newText);

  // ── Empty states ────────────────────────────────────────────────
  if (!oldText && !newText) {
    return (
      <div className="rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] p-4 text-center text-sm text-[#4b4b4b]">
        No content to compare.
      </div>
    );
  }

  // ── Side-by-side (default) ──────────────────────────────────────
  if (layout === "side-by-side") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
          <p className="mb-2 font-mono text-[0.65rem] font-black uppercase tracking-[0.1em] text-red-700">
            {oldLabel}
          </p>
          {diff.left.length === 0 ? (
            <p className="text-sm italic text-[#4b4b4b]/60">(none)</p>
          ) : (
            <p className="text-sm leading-relaxed">
              {diff.left.map((seg, i) => (
                <span key={i} className={segmentStyles[seg.kind]}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#b9ff66] bg-[#b9ff66]/10 p-3">
          <p className="mb-2 font-mono text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#00796f]">
            {newLabel}
          </p>
          {diff.right.length === 0 ? (
            <p className="text-sm italic text-[#4b4b4b]/60">(none)</p>
          ) : (
            <p className="text-sm leading-relaxed">
              {diff.right.map((seg, i) => (
                <span key={i} className={segmentStyles[seg.kind]}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Inline layout ───────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
        <p className="mb-2 font-mono text-[0.65rem] font-black uppercase tracking-[0.1em] text-red-700">
          {oldLabel}
        </p>
        {diff.left.length === 0 ? (
          <p className="text-sm italic text-[#4b4b4b]/60">(none)</p>
        ) : (
          <p className="text-sm leading-relaxed">
            {diff.left.map((seg, i) => (
              <span key={i} className={segmentStyles[seg.kind]}>
                {seg.text}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="rounded-xl border border-[#b9ff66] bg-[#b9ff66]/10 p-3">
        <p className="mb-2 font-mono text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#00796f]">
          {newLabel}
        </p>
        {diff.right.length === 0 ? (
          <p className="text-sm italic text-[#4b4b4b]/60">(none)</p>
        ) : (
          <p className="text-sm leading-relaxed">
            {diff.right.map((seg, i) => (
              <span key={i} className={segmentStyles[seg.kind]}>
                {seg.text}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
