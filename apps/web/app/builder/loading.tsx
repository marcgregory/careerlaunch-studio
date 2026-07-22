/**
 * Streaming loading state for /builder.
 *
 * Reserves the editor + sidebar layout so the transition from the route's
 * loading state to the real 965-line `resume-builder.tsx` doesn't shift.
 */
export default function BuilderLoading() {
  return (
    <main className="min-h-screen bg-[#f3f3f3] pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <div className="mx-auto max-w-7xl px-5 py-6" aria-busy="true" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[#123c3a]/10" />
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-full bg-[#123c3a]/10" />
            <div className="h-9 w-32 animate-pulse rounded-full bg-[#123c3a]/10" />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white"
              />
            ))}
          </div>
          <div className="space-y-4" aria-hidden="true">
            <div className="h-64 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white" />
            <div className="h-48 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white" />
          </div>
        </div>
      </div>
    </main>
  );
}
