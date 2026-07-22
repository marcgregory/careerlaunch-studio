/**
 * Streaming loading state for /account/billing.
 *
 * Mirrors the real page structure:
 *   1. AppHeader (logo only)
 *   2. Back-to-dashboard link
 *   3. Big "Billing & plan" header
 *   4. Two-column section: subscription card (with two stat tiles) + timeline
 *   5. Invoices section with a list of rows
 */
import { Skeleton, SkeletonHeader, SkeletonInvoiceRow, SkeletonPage } from "../../../components/skeletons";

export default function AccountBillingLoading() {
  return (
    <>
      <SkeletonHeader actions={0} />

      <SkeletonPage maxWidthClass="max-w-5xl">
        {/* Back link */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Page header — same border-b + pb-8 as the real page */}
        <header className="border-b border-[#123c3a]/10 pb-8">
          <Skeleton className="h-12 w-72" />
        </header>

        {/* Two-column section: subscription card + timeline card */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]" aria-hidden="true">
          {/* Subscription card — same 30px radius, 24px shadow, 7 padding */}
          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="h-10 w-32 rounded-[14px] border border-[#123c3a]/15 bg-white animate-pulse" />
            </div>

            {/* Two stat tiles — PDF Exports + Payment method */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="mt-3 h-8 w-20" />
                <Skeleton className="mt-1 h-3 w-32" />
              </div>
              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="mt-3 h-7 w-36" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            </div>
          </article>

          {/* Timeline card */}
          <article className="rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
            <Skeleton className="h-7 w-56" />
            <div className="mt-6 space-y-5">
              <div className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 animate-pulse place-items-center rounded-full bg-[#b9ff66]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
              <div className="ml-4 h-6 border-l-2 border-dashed border-[#123c3a]/15" />
              <div className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 animate-pulse place-items-center rounded-full bg-[#f3f3f3]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="rounded-2xl border border-[#123c3a]/10 bg-[#f3f3f3] p-4">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-1 h-5 w-20" />
              </div>
            </div>
          </article>
        </section>

        {/* Invoices section — header row + a few invoice rows */}
        <section className="mt-6 rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="h-10 w-36 rounded-[14px] border border-[#123c3a]/15 bg-white animate-pulse" />
          </div>

          <div className="mt-6 divide-y divide-[#123c3a]/10 overflow-hidden rounded-2xl border border-[#123c3a]/10" aria-hidden="true">
            <SkeletonInvoiceRow />
            <SkeletonInvoiceRow />
            <SkeletonInvoiceRow />
          </div>
        </section>
      </SkeletonPage>
    </>
  );
}
