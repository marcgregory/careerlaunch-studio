"use client";

import { Loader2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

type CheckoutVerificationBannerProps = {
  isVerifying: boolean;
  timedOut: boolean;
  onRetry: () => void;
  planName?: string | null;
};

export function CheckoutVerificationBanner({
  isVerifying,
  timedOut,
  onRetry,
  planName,
}: CheckoutVerificationBannerProps) {
  if (!isVerifying && !timedOut) return null;

  if (isVerifying) {
    return (
      <div className="mt-6 flex flex-col items-start gap-4 rounded-[28px] border-2 border-[#b9ff66] bg-[#b9ff66]/15 p-5 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-sm">
            <Loader2 size={22} className="animate-spin text-[#123c3a]" />
          </div>
          <div>
            <p className="font-signal text-base font-black tracking-[-0.02em] text-[#123c3a]">
              Verifying your subscription...
            </p>
            <p className="text-xs font-semibold text-[#4b4b4b] md:text-sm">
              We&apos;re confirming your payment with Stripe. Your {planName ? `${planName} ` : ""}subscription features will activate automatically.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c3a]">
          <Sparkles size={14} className="animate-pulse text-[#6bbf22]" /> Syncing Stripe
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-4 rounded-[28px] border-2 border-amber-300 bg-amber-50/80 p-5 md:flex-row md:items-center md:justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="font-signal text-base font-black tracking-[-0.02em] text-amber-900">
            Payment received! Still confirming your subscription...
          </p>
          <p className="text-xs font-semibold text-amber-800 md:text-sm">
            Stripe is taking a little longer to sync. Your features will be unlocked shortly.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-[#123c3a] bg-[#123c3a] px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white shadow-[0_3px_0_#123c3a] transition hover:bg-[#1a5250]"
      >
        <RefreshCw size={14} /> Check Again
      </button>
    </div>
  );
}
