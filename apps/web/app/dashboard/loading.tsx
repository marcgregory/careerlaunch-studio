/**
 * Streaming loading state for /dashboard.
 *
 * Mirrors the real page structure:
 *   1. Fixed AppHeader (with the same three right-side actions)
 *   2. "Workspace active" pill + giant headline + signed-in subline
 *   3. Optional free-plan upgrade banner
 *   4. Two-column grid: ResumeList (with SearchBar + cards) | WorkspaceStats
 *
 * Each block uses a matching skeleton variant from components/skeletons.tsx
 * so the page looks fully laid out while the server component awaits the
 * resume stats and initial resume page.
 */
import { SkeletonHeader, SkeletonPage, SkeletonResumeCard, SkeletonWorkspaceStats } from "../../components/skeletons";

export default function DashboardLoading() {
  return (
    <>
      <SkeletonHeader actions={3} />

      <SkeletonPage maxWidthClass="max-w-7xl">
        {/* Hero header */}
        <header className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 shadow-sm">
            <div className="relative flex h-2 w-2">
              <div className="h-2 w-2 rounded-full bg-[#b9ff66]/60" />
            </div>
            <div className="h-3 w-28 rounded-full bg-[#123c3a]/10 animate-pulse" />
          </div>
          <div className="mt-4 h-12 w-3/4 animate-pulse rounded-md bg-[#123c3a]/10 sm:mt-5" />
          <div className="mt-4 h-4 w-1/2 max-w-2xl animate-pulse rounded bg-[#123c3a]/10 sm:mt-5" />
        </header>

        {/* Free-plan upgrade banner — same shape the real page renders when
            the user is on the free plan, so it never appears/disappears with
            a layout shift. */}
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[30px] border border-[#b9ff66]/60 bg-[#b9ff66]/15 p-4 md:flex-row md:items-center md:justify-between md:gap-5 md:p-4">
          <div className="flex w-full items-center gap-4 md:w-auto md:min-w-0 md:flex-1">
            <div className="grid h-10 w-10 shrink-0 animate-pulse place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-44 animate-pulse rounded bg-[#123c3a]/20" />
              <div className="h-3 w-full max-w-md animate-pulse rounded bg-[#123c3a]/15" />
            </div>
          </div>
          <div className="h-10 w-full shrink-0 animate-pulse rounded-full border-2 border-[#123c3a] bg-[#123c3a] md:w-40" />
        </div>

        {/* Main grid — exactly matches the real dashboard section */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start" aria-hidden="true">
          {/* Resume list (left column) */}
          <div className="min-w-0 space-y-5">
            {/* Search bar mirrors the real SearchBar component */}
            <div className="relative">
              <div className="h-10 w-full rounded-[14px] border border-[#123c3a]/15 bg-white shadow-sm animate-pulse" />
            </div>
            {/* Initial page of resume cards — the real list seeds with
                `INITIAL_PAGE_SIZE = 10` cards, so reserve that space. */}
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonResumeCard key={i} />
              ))}
            </div>
          </div>

          {/* Workspace sidebar (right column) */}
          <SkeletonWorkspaceStats />
        </section>
      </SkeletonPage>
    </>
  );
}
