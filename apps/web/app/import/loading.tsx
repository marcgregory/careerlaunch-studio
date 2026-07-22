/**
 * Streaming loading state for /import.
 */
export default function ImportLoading() {
  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <div className="mx-auto max-w-3xl px-5 py-6" aria-busy="true" aria-live="polite">
        <div className="h-10 w-1/2 animate-pulse rounded-md bg-[#123c3a]/10" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[#123c3a]/10" />

        <div
          className="mt-8 h-56 animate-pulse rounded-3xl border-2 border-dashed border-[#123c3a]/15 bg-white"
          aria-hidden="true"
        />
        <div className="mt-4 h-10 w-40 animate-pulse rounded-full bg-[#123c3a]/10" />
      </div>
    </main>
  );
}
