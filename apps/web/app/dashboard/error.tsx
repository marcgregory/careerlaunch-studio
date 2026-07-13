"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="signal-site grid min-h-screen place-items-center px-5 py-16 text-[#123c3a]">
      <section className="w-full max-w-lg rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={24} />
        </div>
        <h1 className="font-signal mt-5 text-2xl font-black uppercase tracking-[-0.04em]">
          Dashboard could not load
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#4b4b4b]">
          The workspace hit a server error while loading your account data.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-xl bg-[#f8f8f5] px-3 py-2 font-mono text-[11px] text-[#4b4b4b]">
            Digest: {error.digest}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#123c3a] bg-[#123c3a] px-5 text-sm font-black uppercase tracking-[0.08em] text-white"
          >
            <RefreshCw size={16} /> Retry
          </button>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#123c3a]/15 bg-white px-5 text-sm font-black uppercase tracking-[0.08em] text-[#123c3a]"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
