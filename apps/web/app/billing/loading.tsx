/**
 * Streaming loading state for /billing.
 *
 * Mirrors the real page structure:
 *   1. AppHeader (logo only — no actions on this page)
 *   2. Back-to-dashboard link
 *   3. Header with "Pricing" icon block + title + subtitle
 *   4. Three-column grid of plan cards
 */
import { SkeletonHeader, SkeletonPage, SkeletonPlanCard } from "../../components/skeletons";

export default function BillingLoading() {
  return (
    <>
      <SkeletonHeader actions={0} />

      <SkeletonPage maxWidthClass="max-w-5xl">
        {/* Back link — same uppercase tracking, same arrow size */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[#123c3a]/10 animate-pulse" />
            <div className="h-4 w-24 rounded bg-[#123c3a]/10 animate-pulse" />
          </div>
        </div>

        {/* Header — icon block + title + subtitle */}
        <header className="border-b border-[#123c3a]/10 pb-8">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
              <div className="h-6 w-6 rounded-full bg-[#123c3a]/20 animate-pulse" />
            </div>
            <div>
              <div className="h-9 w-32 rounded-md bg-[#123c3a]/10 animate-pulse" />
              <div className="mt-2 h-4 w-56 rounded bg-[#123c3a]/10 animate-pulse" />
            </div>
          </div>
        </header>

        {/* Three plan cards in a grid that matches the real page */}
        <section className="mt-8 grid gap-6 md:grid-cols-3" aria-hidden="true">
          <SkeletonPlanCard />
          <SkeletonPlanCard />
          <SkeletonPlanCard />
        </section>
      </SkeletonPage>
    </>
  );
}
