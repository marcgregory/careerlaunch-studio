"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, FileText, Gauge, Layers3, Sparkles, Target } from "lucide-react";
import { useWorkspaceStats, type WorkspaceStats as WorkspaceStatsValues } from "../../hooks/use-workspace-stats";

type WorkspaceStatsProps = {
  /** SSR-computed initial values — used until the TanStack cache has data. */
  initialStats: WorkspaceStatsValues;
  isFree: boolean;
  planName?: string;
};

export function WorkspaceStats({
  initialStats,
  isFree,
  planName = "Free",
}: WorkspaceStatsProps) {
  // Reactively derived from the ["resumes"] cache — no extra fetch.
  const stats = useWorkspaceStats(initialStats);

  return (
    <aside className="rounded-[28px] border border-[#123c3a] bg-[#123c3a] p-5 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)] lg:sticky lg:top-[84px] lg:self-start xl:p-6" aria-label="Workspace overview">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] xl:h-14 xl:w-14">
          <Layers3 size={24} aria-hidden="true" />
        </div>
        <span className="shrink-0 rounded-full border border-[#b9ff66]/60 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#b9ff66]">
          {planName}
        </span>
      </div>

      <h2 className="font-signal mt-6 text-4xl font-black leading-[0.92] tracking-[-0.06em]">
        Your workspace
      </h2>

      {/* Stats grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <FileText size={18} className="text-[#b9ff66]" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black">{stats.totalResumes}</p>
          <p className="text-xs font-medium text-white/80">Total</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <Target size={18} className="text-[#b9ff66]" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black">{stats.targetedCount}</p>
          <p className="text-xs font-medium text-white/80">Targeted</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <Gauge size={18} className="text-[#b9ff66]" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black">{stats.analyzedCount}</p>
          <p className="text-xs font-medium text-white/80">Analyzed</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <CreditCard size={18} className="text-[#b9ff66]" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black">{stats.exportCount}</p>
          <p className="text-xs font-medium text-white/80">Exports</p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-5 text-sm font-medium leading-7 text-white/85">
        Create, edit, and export resumes. AI-powered analysis, job matching, and cover letters available on paid plans.
      </p>

      {/* Quick links */}
      <div className="mt-5 space-y-3">
        <Link
          href="/account/billing"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.08]"
          aria-label="View billing and usage"
        >
          <div className="flex items-center gap-3">
            <CreditCard size={18} className="text-[#b9ff66]" aria-hidden="true" />
            <span className="text-sm font-black">Billing</span>
          </div>
          <ArrowRight size={16} className="text-white/70" aria-hidden="true" />
        </Link>
        <Link
          href="/billing"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.08]"
          aria-label="View subscription plans"
        >
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-[#b9ff66]" aria-hidden="true" />
            <span className="text-sm font-black">Plans</span>
          </div>
          <ArrowRight size={16} className="text-white/70" aria-hidden="true" />
        </Link>
      </div>

      {/* Resume count footer */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#b9ff66] px-4 py-3 text-[#123c3a]">
        <FileText size={22} aria-hidden="true" />
        <p className="text-sm font-black leading-5">
          {stats.totalResumes} resume{stats.totalResumes !== 1 ? "s" : ""} in your workspace.
        </p>
      </div>

      {/* Upgrade CTA for free plan */}
      {isFree && (
        <Link
          href="/billing"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#b9ff66] bg-[#b9ff66] px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-[#123c3a] shadow-[0_4px_0_#8ccf4d] transition hover:bg-[#a8eb55] hover:shadow-[0_2px_0_#8ccf4d]"
        >
          <Sparkles size={16} aria-hidden="true" /> Upgrade to Pro
        </Link>
      )}
    </aside>
  );
}
