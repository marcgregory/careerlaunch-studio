"use client";

import { useState } from "react";
import { BadgeCheck, MailWarning, RefreshCw, X } from "lucide-react";

type Props = {
  email: string;
};

export function EmailVerificationBanner({ email }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) {
        setResent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to resend. Try again later.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mt-6 flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 p-4 md:items-center md:gap-4" role="alert">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-700 md:mt-0">
        <MailWarning size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-amber-900">Verify your email</p>
        <p className="text-xs font-medium text-amber-800/80">
          Check <span className="font-bold">{email}</span> for a verification link.{" "}
          {resent ? (
            <span className="font-bold text-green-700">Sent! Check your inbox.</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1 font-black text-amber-900 underline underline-offset-2 transition hover:text-amber-700 disabled:opacity-50"
            >
              <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
              {resending ? "Sending..." : "Resend email"}
            </button>
          )}
        </p>
        {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-amber-500 transition hover:bg-amber-100 hover:text-amber-700"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
