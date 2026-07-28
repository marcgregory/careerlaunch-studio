"use client";

/**
 * ProgressOverlay — Blocking full-screen progress indicator.
 *
 * Used while the dashboard is creating a starter resume so the user sees
 * immediate feedback instead of a blank navigation. After `slowThresholdMs`
 * the subtitle text swaps from the default "this usually takes a few seconds"
 * message to a longer-wait reassurance, which feels less broken than a
 * spinning spinner with no acknowledgement.
 *
 * Design notes:
 * - No close button. The user can't cancel a create mid-flight; that would
 *   risk orphaned rows on the server. They can navigate away (which aborts
 *   the underlying fetch), and the toast surfaces the failure.
 * - Uses the same backdrop pattern as the upgrade modal
 *   (apps/web/app/builder/resume-builder.tsx:797) so dialogs feel consistent.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type ProgressOverlayProps = {
  open: boolean;
  title: string;
  /** Subtitle shown for the first `slowThresholdMs` milliseconds. */
  subtitle: string;
  /** Subtitle shown after the threshold elapses. */
  slowSubtitle: string;
  /** Threshold in milliseconds before swapping to `slowSubtitle`. Default 4000. */
  slowThresholdMs?: number;
};

export function ProgressOverlay({
  open,
  title,
  subtitle,
  slowSubtitle,
  slowThresholdMs = 4000,
}: ProgressOverlayProps) {
  // `isSlow` flips to true `slowThresholdMs` after `open` becomes true.
  // The component early-returns null when `open` is false, so the state
  // naturally resets on next mount — no reset effect needed.
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setIsSlow(true), slowThresholdMs);
    return () => window.clearTimeout(timeout);
  }, [open, slowThresholdMs]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-[#123c3a]/55 px-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(18,60,58,0.45)]">
        {/* Soft halo behind the spinner */}
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[#b9ff66]/15 blur-2xl" />

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
          <Loader2 size={32} className="animate-spin" aria-hidden="true" />
        </div>

        <h2 className="font-signal mt-6 text-2xl font-black leading-[0.95] tracking-[-0.04em] text-[#123c3a]">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-6 text-[#4b4b4b]">
          {isSlow ? slowSubtitle : subtitle}
        </p>

        {/* Three-dot pulse so even text-readers get a rhythm signal. */}
        <div className="mt-6 flex items-center justify-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#123c3a]/40 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}