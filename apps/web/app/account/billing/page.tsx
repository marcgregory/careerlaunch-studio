"use client";

import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, CreditCard, FileText, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

type SubscriptionResponse = {
  currentPlan: string;
  pdfExportKind: string;
  monthlyExportsUsed: number;
};

export default function AccountBillingPage() {
  return (
    <Suspense fallback={
      <main className="signal-site flex min-h-screen items-center justify-center px-5">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    }>
      <AccountBillingContent />
    </Suspense>
  );
}

function AccountBillingContent() {
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setError("Failed to load billing data."))
      .finally(() => setLoading(false));
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const result = await res.json();
      if (res.ok && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to open billing portal.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="signal-site flex min-h-screen items-center justify-center px-5">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    );
  }

  return (
    <main className="signal-site min-h-screen px-5 py-6 text-[#123c3a]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[#4b4b4b] hover:text-[#123c3a]"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>

        <header className="border-b border-[#123c3a]/10 pb-8">
          <h1 className="font-signal text-5xl font-black tracking-[-0.06em]">Billing & plan</h1>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 space-y-6">
          {/* Current plan card */}
          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">
                  {data?.currentPlan
                    ? data.currentPlan.charAt(0).toUpperCase() + data.currentPlan.slice(1)
                    : "Free"}{" "}
                  Plan
                </h2>
                <p className="mt-1 text-sm font-medium text-[#4b4b4b]">Current subscription tier</p>
              </div>
              {data?.currentPlan === "free" ? (
                <Link href="/billing" className={primaryButtonClass}>
                  <CreditCard size={16} /> Upgrade
                </Link>
              ) : (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className={secondaryButtonClass}
                >
                  {portalLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ExternalLink size={16} />
                  )}
                  Manage billing
                </button>
              )}
            </div>
          </article>

          {/* Usage card */}
          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">Usage</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-5">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-[#6bbf22]" />
                  <span className="text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                    PDF Exports
                  </span>
                </div>
                <p className="mt-3 font-signal text-3xl font-black tracking-[-0.04em]">
                  {data?.monthlyExportsUsed ?? 0}
                  <span className="text-base font-medium text-[#4b4b4b]"> this month</span>
                </p>
                <p className="mt-1 text-xs font-medium text-[#4b4b4b]">
                  Export quality:{" "}
                  <span className="font-black text-[#123c3a]">
                    {data?.pdfExportKind === "clean" ? "Clean" : "Watermarked"}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-5">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-[#6bbf22]" />
                  <span className="text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                    Plan
                  </span>
                </div>
                <p className="mt-3 font-signal text-3xl font-black tracking-[-0.04em] capitalize">
                  {data?.currentPlan ?? "free"}
                </p>
                <Link
                  href="/billing"
                  className="mt-2 inline-block text-xs font-black uppercase tracking-[0.1em] text-[#6bbf22] hover:underline"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
