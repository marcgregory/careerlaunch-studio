"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, CreditCard, Sparkles, ArrowLeft, Loader2, X } from "lucide-react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

type PlanInfo = {
  id: string;
  label: string;
  isCurrent: boolean;
};

type SubscriptionData = {
  currentPlan: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  scheduledChange: { plan: string; effectiveDate: string | null } | null;
  plans: PlanInfo[];
};

type UpgradePreview = {
  todayCharge: number;
  currency: string;
  currentPlan: string;
  newPlan: string;
  nextRenewal: number;
  renewalDate: string | null;
  paymentMethod: { brand: string; last4: string } | null;
  lines: Array<{ label: string; amount: number }>;
};

const DEFAULT_SUBSCRIPTION_DATA: SubscriptionData = {
  currentPlan: "free",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  scheduledChange: null,
  plans: [
    { id: "free", label: "Free", isCurrent: true },
    { id: "professional", label: "Professional", isCurrent: false },
    { id: "enterprise", label: "Enterprise", isCurrent: false },
  ],
};

function normalizeSubscriptionData(value: Partial<SubscriptionData> | null | undefined): SubscriptionData {
  const currentPlan = ["free", "professional", "enterprise"].includes(value?.currentPlan ?? "")
    ? value?.currentPlan ?? "free"
    : "free";

  return {
    currentPlan,
    cancelAtPeriodEnd: Boolean(value?.cancelAtPeriodEnd),
    currentPeriodEnd: typeof value?.currentPeriodEnd === "string" ? value.currentPeriodEnd : null,
    scheduledChange: value?.scheduledChange && typeof value.scheduledChange === "object"
      ? {
          plan: typeof value.scheduledChange.plan === "string" ? value.scheduledChange.plan : "",
          effectiveDate: typeof value.scheduledChange.effectiveDate === "string" ? value.scheduledChange.effectiveDate : null,
        }
      : null,
    plans: Array.isArray(value?.plans)
      ? value.plans
      : DEFAULT_SUBSCRIPTION_DATA.plans.map((plan) => ({
          ...plan,
          isCurrent: plan.id === currentPlan,
        })),
  };
}

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

const PLAN_RANK: Record<string, number> = {
  free: 0,
  professional: 1,
  enterprise: 2,
};

function planLabel(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return "your next renewal date";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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
  const [syncingCheckout, setSyncingCheckout] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(false);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [downgradePlan, setDowngradePlan] = useState<string | null>(null);
  const [cancelingScheduledDowngrade, setCancelingScheduledDowngrade] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reason = searchParams?.get("reason");
  const checkoutStatus = searchParams?.get("checkout");
  const upgradePlan = searchParams?.get("plan");
  const message = success ?? (checkoutStatus === "success"
    ? "Payment successful! Your plan has been upgraded."
    : checkoutStatus === "canceled"
      ? "Checkout was canceled. No changes were made."
      : searchParams?.get("upgrade") === "completed"
        ? `Your plan has been upgraded to ${upgradePlan ?? "the new plan"}. Your next invoice will reflect any prorated charges.`
        : reason === "resume_limit"
          ? "You've reached the free plan limit. Upgrade to create more resumes."
          : null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      setLoading(true);

      try {
        const res = await fetch("/api/billing/subscription");
        if (!res.ok) throw new Error("Failed to load subscription");

        const result = await res.json();
        if (!cancelled) {
          setData(normalizeSubscriptionData(result));
        }
      } catch {
        if (!cancelled) {
          setData(DEFAULT_SUBSCRIPTION_DATA);
          setError("We couldn't refresh your subscription yet. You can still compare plans below.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSubscription();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (checkoutStatus !== "success") return;

    let cancelled = false;
    const MAX_ATTEMPTS = 10;
    const POLL_INTERVAL_MS = 1500;
    const TIMEOUT_MS = 30_000;
    let attempts = 0;

    async function poll() {
      setSyncingCheckout(true);
      const deadline = Date.now() + TIMEOUT_MS;

      while (!cancelled && attempts < MAX_ATTEMPTS && Date.now() < deadline) {
        attempts++;
        try {
          const res = await fetch("/api/billing/subscription");
          if (!res.ok) throw new Error("Failed to refresh subscription");

          const d = normalizeSubscriptionData(await res.json());
          if (cancelled) return;

          if (d.currentPlan !== "free") {
            setData(d);
            setSyncingCheckout(false);
            router.replace("/billing", { scroll: false });
            return;
          }
        } catch {
          // Retry transient failures while Stripe webhooks settle.
        }

        if (!cancelled && attempts < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }

      if (!cancelled) {
        setSyncingCheckout(false);
        setError("Payment succeeded, but we're still waiting for Stripe to confirm your subscription. The plan cards remain available below.");
        router.replace("/billing", { scroll: false });
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [checkoutStatus, router]);

  const refreshSubscription = async () => {
    const res = await fetch("/api/billing/subscription");
    if (!res.ok) return;
    setData(normalizeSubscriptionData(await res.json()));
  };

  const openUpgradePreview = async (planId: string) => {
    setBusyPlan(planId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/billing/preview-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to preview upgrade.");

      setUpgradePreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview upgrade.");
    } finally {
      setBusyPlan(null);
    }
  };

  const confirmUpgrade = async () => {
    if (!upgradePreview) return;

    setConfirmingUpgrade(true);
    setError(null);

    try {
      const plan = upgradePreview.newPlan.toLowerCase();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const result = await res.json();

      if (res.ok && result.url) {
        window.location.assign(result.url);
      } else {
        setError(result.error || "Failed to start upgrade.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirmingUpgrade(false);
    }
  };

  const confirmDowngrade = async () => {
    if (!downgradePlan) return;

    setBusyPlan(downgradePlan);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/billing/subscription-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule_downgrade", plan: downgradePlan }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to schedule downgrade.");

      setDowngradePlan(null);
      setSuccess(`${result.scheduledPlan} is scheduled for ${formatDate(result.effectiveDate)}. Your ${result.currentPlan} features remain available until then.`);
      await refreshSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule downgrade.");
    } finally {
      setBusyPlan(null);
    }
  };

  const confirmCancelScheduledDowngrade = async () => {
    setBusyPlan(data?.currentPlan ?? "enterprise");
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/billing/subscription-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_scheduled_downgrade" }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to cancel scheduled downgrade.");

      setCancelingScheduledDowngrade(false);
      setSuccess(`Your scheduled downgrade was canceled. ${result.currentPlan} will renew on ${formatDate(result.renewalDate)}.`);
      await refreshSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel scheduled downgrade.");
    } finally {
      setBusyPlan(null);
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

        {syncingCheckout && (
          <div className="mt-6 rounded-2xl border border-[#b9ff66] bg-[#b9ff66]/20 p-4 text-sm font-black text-[#123c3a]">
            Confirming your Stripe checkout. Plan cards are available while we sync your subscription.
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
            const currentRank = PLAN_RANK[data?.currentPlan ?? "free"];
            const cardRank = PLAN_RANK[planId];
            const scheduledChange = data?.scheduledChange;
            const isScheduledPlan = scheduledChange?.plan === planId;

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
                      <div className="space-y-3">
                        <span className="block w-full rounded-full border border-[#b9ff66] bg-[#b9ff66]/20 px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#123c3a]">
                          {scheduledChange ? `Current until ${formatDate(scheduledChange.effectiveDate)}` : "Current plan"}
                        </span>
                        {scheduledChange && (
                          <button
                            type="button"
                            onClick={() => setCancelingScheduledDowngrade(true)}
                            disabled={busyPlan === planId}
                            className={`${secondaryButtonClass} w-full justify-center`}
                          >
                            {busyPlan === planId ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Keep {planLabel(planId)}
                          </button>
                        )}
                      </div>
                    ) : isScheduledPlan ? (
                      <span className="block w-full rounded-full border border-[#b9ff66] bg-[#b9ff66]/20 px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#123c3a]">
                        Scheduled {formatDate(scheduledChange.effectiveDate)}
                      </span>
                    ) : currentRank > cardRank ? (
                      planId === "free" ? (
                        <span className="block w-full rounded-full border border-[#123c3a]/10 bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                          Contact support
                        </span>
                      ) : (
                        <button
                          onClick={() => setDowngradePlan(planId)}
                          disabled={busyPlan === planId}
                          className={`${secondaryButtonClass} w-full justify-center`}
                        >
                          {busyPlan === planId ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                          Downgrade
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => openUpgradePreview(planId)}
                        disabled={busyPlan === planId}
                        className={`${primaryButtonClass} w-full justify-center`}
                      >
                        {busyPlan === planId ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Previewing...
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

      {upgradePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123c3a]/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6bbf22]">Confirm upgrade</p>
                <h2 className="mt-2 font-signal text-3xl font-black tracking-[-0.05em]">
                  Upgrade to {upgradePreview.newPlan}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setUpgradePreview(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#123c3a]/10 hover:bg-[#f3f3f3]"
                aria-label="Close upgrade preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-[#f3f3f3] p-5">
              <p className="text-sm font-black text-[#123c3a]">You&apos;ll be charged today</p>
              <div className="mt-4 space-y-3">
                {upgradePreview.lines.map((line, index) => (
                  <div key={`${line.label}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-[#4b4b4b]">{line.label}</span>
                    <span className="font-black text-[#123c3a]">{formatMoney(line.amount, upgradePreview.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#123c3a]/10 pt-4">
                <span className="text-sm font-black uppercase tracking-[0.08em] text-[#123c3a]">Total today</span>
                <span className="font-signal text-3xl font-black tracking-[-0.04em]">
                  {formatMoney(upgradePreview.todayCharge, upgradePreview.currency)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#123c3a]/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#4b4b4b]">Next renewal</p>
                <p className="mt-2 text-sm font-black text-[#123c3a]">{formatDate(upgradePreview.renewalDate)}</p>
                <p className="text-sm font-medium text-[#4b4b4b]">
                  {formatMoney(upgradePreview.nextRenewal, upgradePreview.currency)}/month
                </p>
              </div>
              <div className="rounded-2xl border border-[#123c3a]/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#4b4b4b]">Payment method</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-black capitalize text-[#123c3a]">
                  <CreditCard size={16} />
                  {upgradePreview.paymentMethod
                    ? `${upgradePreview.paymentMethod.brand} ending ${upgradePreview.paymentMethod.last4}`
                    : "Collected in Stripe Checkout"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setUpgradePreview(null)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUpgrade}
                disabled={confirmingUpgrade}
                className={primaryButtonClass}
              >
                {confirmingUpgrade ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {downgradePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123c3a]/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.28)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Schedule downgrade</p>
            <h2 className="mt-2 font-signal text-3xl font-black tracking-[-0.05em]">
              Downgrade to {planLabel(downgradePlan)}?
            </h2>
            <p className="mt-4 text-sm font-medium leading-6 text-[#4b4b4b]">
              Your {planLabel(data?.currentPlan ?? "current")} features remain available until {formatDate(data?.currentPeriodEnd ?? null)}. Your subscription will renew as {planLabel(downgradePlan)} afterward.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDowngradePlan(null)}
                className={secondaryButtonClass}
              >
                Keep {planLabel(data?.currentPlan ?? "plan")}
              </button>
              <button
                type="button"
                onClick={confirmDowngrade}
                disabled={busyPlan === downgradePlan}
                className={primaryButtonClass}
              >
                {busyPlan === downgradePlan ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Schedule downgrade
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelingScheduledDowngrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123c3a]/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.28)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6bbf22]">Keep current plan</p>
            <h2 className="mt-2 font-signal text-3xl font-black tracking-[-0.05em]">
              Keep {planLabel(data?.currentPlan ?? "Enterprise")}?
            </h2>
            <p className="mt-4 text-sm font-medium leading-6 text-[#4b4b4b]">
              Your scheduled downgrade to {planLabel(data?.scheduledChange?.plan ?? "Professional")} will be canceled. Your {planLabel(data?.currentPlan ?? "current")} plan will renew on {formatDate(data?.scheduledChange?.effectiveDate ?? data?.currentPeriodEnd ?? null)}.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelingScheduledDowngrade(false)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCancelScheduledDowngrade}
                disabled={busyPlan !== null}
                className={primaryButtonClass}
              >
                {busyPlan !== null ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Keep {planLabel(data?.currentPlan ?? "plan")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
