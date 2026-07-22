/**
 * Streaming loading state for /account/billing.
 */
export default function AccountBillingLoading() {
  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <div className="mx-auto max-w-3xl px-5 py-6" aria-busy="true" aria-live="polite">
        <div className="h-10 w-1/2 animate-pulse rounded-md bg-[#123c3a]/10" />
        <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-[#123c3a]/10" />

        <div className="mt-8 space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-[#123c3a]/10 bg-white"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
