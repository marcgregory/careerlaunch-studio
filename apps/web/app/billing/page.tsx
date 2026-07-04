"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

type PlanInfo = {
  id: string;
  label: string;
  isCurrent: boolean;
};

type SubscriptionData = {
  currentPlan: string;
  plans: PlanInfo[];
};

const FEATURE_LABELS: Record<string, string> = {
  resume_limit: "Resume drafts",
  templates: "Templates",
  ai_analysis: "AI analysis & scoring",
  run_job_match: "Job description matching",
  cover_letter: "Cover letter builder",
  pdf_export: "PDF export",
  monthly_exports: "Monthly exports",
  use_premium_templates: "Premium templates",
  priority_support: "Priority support",
};

const FEATURE_VALUES: Record<string, Record<string, string>> = {
  free: {
    resume_limit: "3 drafts",
    templates: "2 templates",
    ai_analysis: "Basic score",
    run_job_match: "No",
    cover_letter: "Yes",
    pdf_export: "Watermarked",
    monthly_exports: "5/mo",
    use_premium_templates: "No",
    priority_support: "No",
  },
  professional: {
    resume_limit: "Unlimited",
    templates: "All templates",
    ai_analysis: "Full analysis",
    run_job_match: "Yes",
    cover_letter: "Yes",
    pdf_export: "Clean",
    monthly_exports: "Unlimited",
    use_premium_templates: "Yes",
    priority_support: "No",
  },
  enterprise: {
    resume_limit: "Unlimited",
    templates: "All templates",
    ai_analysis: "Full analysis",
    run_job_match: "Yes",
    cover_letter: "Yes",
    pdf_export: "Clean",
    monthly_exports: "Unlimited",
    use_premium_templates: "Yes",
    priority_support: "Yes",
  },
};

export default function BillingPage() {
  return (
    <Suspense fallback={
      <main className="signal-site flex min-h-screen items-center justify-center px-5">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    }>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reason = searchParams?.get("reason");
  const checkoutStatus = searchParams?.get("checkout");

  useEffect(() => {
    if (reason === "resume_limit") {
      setMessage("You've reached the free plan limit. Upgrade to create more resumes.");
    }
    if (checkoutStatus === "success") {
      setMessage("Payment successful! Your plan has been upgraded.");
    }
    if (checkoutStatus === "canceled") {
      setMessage("Checkout was canceled. No changes were made.");
    }
  }, [reason, checkoutStatus]);

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load subscription data.");
        setLoading(false);
      });
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const result = await res.json();

      if (res.ok && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to start checkout.");
        setUpgrading(null);
      }
    } catch {
      setError("Network error. Please try again.");
      setUpgrading(null);
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[#4b4b4b] hover:text-[#123c3a]"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>

        <header className="border-b border-[#123c3a]/10 pb-8">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
              <Sparkles size={26} />
            </div>
            <div>
              <h1 className="font-signal text-4xl font-black tracking-[-0.06em]">Pricing</h1>
              <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
                {data?.currentPlan === "free"
                  ? "You're on the Free plan."
                  : `You're on the ${data?.currentPlan} plan.`}
              </p>
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-[#b9ff66] bg-[#b9ff66]/20 p-4 text-sm font-black text-[#123c3a]">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {(["free", "professional", "enterprise"] as const).map((planId) => {
            const isCurrent = data?.currentPlan === planId;
            const isProfessional = planId === "professional";
            const values = FEATURE_VALUES[planId];

            return (
              <article
                key={planId}
                className={`relative overflow-hidden rounded-[30px] border bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)] ${
                  isProfessional
                    ? "border-[#6bbf22] ring-2 ring-[#b9ff66]"
                    : "border-[#123c3a]/10"
                }`}
              >
                {isProfessional && (
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#b9ff66]/35 blur-3xl" />
                )}

                <div className="relative z-10">
                  <h2 className="font-signal text-2xl font-black capitalize tracking-[-0.04em]">
                    {planId}
                  </h2>
                  <p className="mt-4 text-4xl font-black tracking-[-0.04em]">
                    {planId === "free" ? (
                      "$0"
                    ) : planId === "professional" ? (
                      <>
                        $19<span className="text-lg font-medium text-[#4b4b4b]">/mo</span>
                      </>
                    ) : (
                      <>
                        $49<span className="text-lg font-medium text-[#4b4b4b]">/mo</span>
                      </>
                    )}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                      <li key={key} className="flex items-start gap-3 text-sm">
                        <Check
                          size={16}
                          className={`mt-0.5 shrink-0 ${
                            values?.[key] && values[key] !== "No"
                              ? "text-[#6bbf22]"
                              : "text-gray-300"
                          }`}
                        />
                        <span className="font-medium text-[#4b4b4b]">
                          {label}: <span className="font-black text-[#123c3a]">{values?.[key] || "No"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isCurrent ? (
                      <span className="block w-full rounded-full border border-[#b9ff66] bg-[#b9ff66]/20 px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#123c3a]">
                        Current plan
                      </span>
                    ) : planId === "free" ? (
                      <span className="block w-full rounded-full border border-[#123c3a]/10 bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                        Downgrade (contact support)
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(planId)}
                        disabled={upgrading === planId}
                        className={`${primaryButtonClass} w-full justify-center`}
                      >
                        {upgrading === planId ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} /> Upgrade to {planId}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
