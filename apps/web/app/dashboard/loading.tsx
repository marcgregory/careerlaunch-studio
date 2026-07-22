/**
 * Streaming loading state for /dashboard.
 *
 * Renders an immediate skeleton while the server component awaits
 * `requireUser()` and the resume stats query. The header bar is fully
 * reserved so layout doesn't shift when the real header replaces it.
 */
export default function DashboardLoading() {
  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <div className="mx-auto max-w-7xl px-5 py-6" aria-busy="true" aria-live="polite">
        <div className="max-w-4xl">
          <div className="h-9 w-48 animate-pulse rounded-full border border-[#123c3a]/10 bg-white" />
          <div className="mt-4 h-12 w-3/4 animate-pulse rounded-md bg-[#123c3a]/10 sm:mt-5" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[#123c3a]/10" />
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white"
              />
            ))}
          </div>
          <div className="space-y-3" aria-hidden="true">
            <div className="h-32 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white" />
            <div className="h-40 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white" />
          </div>
        </section>
      </div>
    </main>
  );
}
