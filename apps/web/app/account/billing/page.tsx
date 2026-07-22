"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, FileText, Loader2, ExternalLink, CalendarDays, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { AppHeader, AppLogo } from "../../../components/app-header";
import { CheckoutVerificationBanner } from "../../../components/checkout-verification-banner";
import { useSubscriptionVerification } from "../../../hooks/use-subscription-verification";
import AccountBillingLoading from "./loading";

function planLabel(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatDate(date: string | null, isPaid = false) {
  if (!date) return isPaid ? "Active" : "Not scheduled";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatInvoiceDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function AccountBillingPage() {
  return (
    <Suspense fallback={<AccountBillingLoading />}>
      <AccountBillingContent />
    </Suspense>
  );
}

function AccountBillingContent() {
  const searchParams = useSearchParams();
  const {
    data,
    loading,
    isVerifying,
    timedOut,
    error: verificationError,
    setError: setVerificationError,
    retryVerification,
  } = useSubscriptionVerification();

  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const error = portalError ?? verificationError;

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const result = await res.json();
      if (res.ok && result.url) {
        window.location.href = result.url;
      } else {
        setPortalError(result.error || "Failed to open billing portal.");
      }
    } catch {
      setPortalError("Network error.");
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlan = data?.currentPlan ?? "free";
  const isPaid = currentPlan !== "free";
  const invoices = data?.invoices ?? [];

  if (loading) {
    return <AccountBillingLoading />;
  }

  return (
    <main className="signal-site min-h-screen pt-[52px] px-5 py-6 text-[#123c3a] sm:pt-[60px]">
      <AppHeader>
        <AppLogo />
      </AppHeader>

      <div className="mx-auto max-w-5xl px-5 py-6">
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

        <CheckoutVerificationBanner
          isVerifying={isVerifying}
          timedOut={timedOut}
          onRetry={retryVerification}
        />

        {error && (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-black text-red-700" role="alert">
            {error}
          </div>
        )}

        {data?.cancelAtPeriodEnd && isPaid && data?.currentPeriodEnd && (
          <div className="mt-6 rounded-2xl border border-orange-300 bg-orange-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.08em] text-orange-800">
                  Subscription ending
                </p>
                <p className="mt-1 text-sm font-medium text-orange-700">
                  Your subscription will end on <span className="font-black">{formatDate(data.currentPeriodEnd)}</span>. You&apos;ll retain paid access until that date.
                </p>
              </div>
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="shrink-0 rounded-full border-2 border-orange-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-orange-800 hover:bg-orange-100"
              >
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : "Reactivate"}
              </button>
            </div>
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-signal text-3xl font-black tracking-[-0.04em]">
                  {planLabel(currentPlan)} Plan
                </h2>
                <p className="mt-1 text-sm font-medium text-[#4b4b4b]">Current subscription tier</p>
              </div>
              {isVerifying ? (
                <div className="flex items-center gap-2 rounded-full border border-[#b9ff66] bg-[#b9ff66]/20 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-[#123c3a]">
                  <Loader2 size={16} className="animate-spin text-[#6bbf22]" /> Verifying...
                </div>
              ) : currentPlan === "free" ? (
                <Link href="/billing" className={primaryButtonClass}>
                  <CreditCard size={16} /> Upgrade
                </Link>
              ) : (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className={secondaryButtonClass}
                >
                  {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  Manage billing
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                  Export quality: <span className="font-black text-[#123c3a]">{data?.pdfExportKind === "clean" ? "Clean" : "Watermarked"}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-5">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-[#6bbf22]" />
                  <span className="text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
                    Payment method
                  </span>
                </div>
                <p className="mt-3 font-signal text-2xl font-black capitalize tracking-[-0.04em]">
                  {data?.paymentMethod ? `${data.paymentMethod.brand} ${data.paymentMethod.last4}` : "Stripe Portal"}
                </p>
                {isPaid ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-[#6bbf22] hover:underline"
                  >
                    Change card <ExternalLink size={12} />
                  </button>
                ) : (
                  <Link href="/billing" className="mt-2 inline-block text-xs font-black uppercase tracking-[0.1em] text-[#6bbf22] hover:underline">
                    Compare plans
                  </Link>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">Subscription timeline</h2>
            <div className="mt-6 space-y-5">
              <div className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-[#123c3a]">Today</p>
                  <p className="text-sm font-medium text-[#4b4b4b]">{isPaid ? `${planLabel(currentPlan)} active` : "Free plan active"}</p>
                </div>
              </div>
              <div className="ml-4 h-6 border-l-2 border-dashed border-[#123c3a]/15" />
              <div className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-[#123c3a]">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-[#123c3a]">{formatDate(data?.currentPeriodEnd ?? null, isPaid)}</p>
                  <p className="text-sm font-medium text-[#4b4b4b]">
                    {data?.cancelAtPeriodEnd ? "Paid access ends" : isPaid ? "Next renewal" : "Upgrade anytime"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#4b4b4b]">Status</p>
                <p className="mt-1 text-lg font-black text-[#123c3a]">{data?.cancelAtPeriodEnd ? "Ending" : isPaid ? "Active" : "Free"}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">Invoices</h2>
              <p className="mt-1 text-sm font-medium text-[#4b4b4b]">Recent Stripe invoices for this account</p>
            </div>
            {isPaid && (
              <button onClick={handleManageBilling} disabled={portalLoading} className={secondaryButtonClass}>
                {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                Stripe portal
              </button>
            )}
          </div>

          <div className="mt-6 divide-y divide-[#123c3a]/10 overflow-hidden rounded-2xl border border-[#123c3a]/10">
            {invoices.length > 0 ? invoices.map((invoice) => (
              <div key={invoice.id} className="grid gap-4 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 text-[#6bbf22]" />
                  <div>
                    <p className="text-sm font-black text-[#123c3a]">{formatInvoiceDate(invoice.date)}</p>
                    <p className="text-sm font-medium text-[#4b4b4b]">{invoice.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className="text-sm font-black text-[#123c3a]">{formatMoney(invoice.amount, invoice.currency)}</span>
                  {invoice.invoicePdf && (
                    <a href={invoice.invoicePdf} className="text-xs font-black uppercase tracking-[0.1em] text-[#6bbf22] hover:underline">
                      View PDF
                    </a>
                  )}
                  {invoice.hostedInvoiceUrl && (
                    <a href={invoice.hostedInvoiceUrl} className="text-xs font-black uppercase tracking-[0.1em] text-[#6bbf22] hover:underline">
                      Receipt
                    </a>
                  )}
                </div>
              </div>
            )) : (
              <div className="bg-[#f3f3f3] p-5 text-sm font-medium text-[#4b4b4b]">
                No invoices found yet. Paid invoices will appear here after Stripe creates them.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}