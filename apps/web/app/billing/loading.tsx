/**
 * Streaming loading state for /billing.
 */
export default function BillingLoading() {
  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <div className="mx-auto max-w-5xl px-5 py-6" aria-busy="true" aria-live="polite">
        <div className="max-w-3xl">
          <div className="h-8 w-44 animate-pulse rounded-full bg-[#123c3a]/10" />
          <div className="mt-3 h-12 w-2/3 animate-pulse rounded-md bg-[#123c3a]/10" />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-3xl border border-[#123c3a]/10 bg-white"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
