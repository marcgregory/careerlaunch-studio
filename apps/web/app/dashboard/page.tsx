import Link from "next/link";
import { ArrowRight, CreditCard, FileText, Gauge, Layers3, LogOut, Plus, Sparkles } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { AppHeader, AppLogo } from "../../components/app-header";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { DuplicateButton } from "./duplicate-button";
import { getSubscription } from "../../lib/entitlements";

type DashboardResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: Date;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const [resumes, subscription] = await Promise.all([
    prisma.resumeDocument.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, targetRole: true, updatedAt: true }
    }),
    getSubscription(user.id),
  ]);
  const isFree = subscription.plan === "free";

  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <AppHeader actions={
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <form action="/api/auth/logout" method="post">
            <button className={secondaryButtonClass} type="submit">
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
          <Link href="/import" className={secondaryButtonClass}>
            <FileText size={16} /> <span className="hidden sm:inline">Import</span>
          </Link>
          <Link href="/builder" className={primaryButtonClass}>
            <Plus size={16} /> <span className="hidden sm:inline">New resume</span>
          </Link>
        </div>
      }>
        <AppLogo />
      </AppHeader>

      <div className="mx-auto max-w-7xl px-5 py-6">
        <header className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b9ff66] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6bbf22]" />
            </span>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b]">Workspace active</span>
          </div>
          <h1 className="font-signal mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.86] tracking-[-0.08em] md:text-7xl sm:mt-5">
            Application control room.
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#4b4b4b] sm:mt-5">Signed in as {user.email}</p>
        </header>
        {isFree && (
          <div className="mt-6 flex-col items-start gap-4 rounded-[30px] border border-[#b9ff66]/60 bg-[#b9ff66]/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] sm:h-12 sm:w-12">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-signal text-sm font-black tracking-[-0.02em] sm:text-lg">
                  You&apos;re on the Free plan
                </p>
                <p className="text-xs font-medium text-[#4b4b4b] sm:text-sm">
                  Upgrade to Professional for unlimited resumes, all templates, job matching, and clean PDF exports.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#123c3a] bg-[#123c3a] px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_3px_0_#123c3a] transition hover:bg-[#1a5250] sm:w-auto"
            >
              <CreditCard size={16} /> Upgrade
            </Link>
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            {resumes.length === 0 ? (
              <article className="relative overflow-hidden rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
                <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#b9ff66]/45 blur-3xl" />
                <div className="relative z-10">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
                    <FileText size={28} />
                  </div>
                  <h2 className="font-signal mt-7 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.06em]">No drafts in the pipeline yet.</h2>
                  <p className="mt-4 max-w-xl text-base font-medium leading-7 text-[#4b4b4b]">
                    Create your first database-backed resume draft and continue editing from any authenticated session.
                  </p>
                  <div className="mt-8">
                    <Link href="/builder" className={primaryButtonClass}>
                      Create first draft <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              </article>
            ) : (
              resumes.map((resume, index) => (
                <article key={resume.id} className="group grid gap-5 rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#b9ff66] hover:shadow-[0_20px_50px_rgba(18,60,58,0.10)] md:grid-cols-[86px_1fr_auto] md:items-center">
                  <div className="grid h-20 w-20 place-items-center rounded-[22px] border-2 border-[#123c3a] bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
                    <span className="font-signal text-2xl font-black tracking-[-0.06em]">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3f3] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#4b4b4b]">
                      <FileText size={13} className="text-[#6bbf22]" /> Saved draft
                    </div>
                    <h2 className="font-signal mt-3 truncate text-3xl font-black leading-none tracking-[-0.06em]">{resume.title}</h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#4b4b4b]">
                      {resume.targetRole || "Untargeted resume"} - Updated {resume.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DuplicateButton resumeId={resume.id} />
                    <Link href={`/builder?resumeId=${resume.id}`} className={secondaryButtonClass}>
                      Continue <ArrowRight size={18} />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="rounded-[30px] border border-[#123c3a] bg-[#123c3a] p-6 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)] lg:sticky lg:top-[84px] lg:self-start">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                <Layers3 size={26} />
              </div>
              {isFree ? (
                <Link href="/billing" className="rounded-full border border-[#b9ff66]/60 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#b9ff66] hover:bg-[#b9ff66]/10">
                  Free plan
                </Link>
              ) : (
                <span className="rounded-full border border-[#b9ff66]/60 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#b9ff66]">
                  {subscription.plan.charAt(0) + subscription.plan.slice(1).toLowerCase()}
                </span>
              )}
            </div>
            <h2 className="font-signal mt-7 text-4xl font-black leading-[0.92] tracking-[-0.06em]">Your workspace</h2>
            <p className="mt-5 text-sm font-medium leading-7 text-white/62">
              Create, edit, and export resumes. AI-powered analysis, job matching, and cover letters available on paid plans.
            </p>
            <div className="mt-7 space-y-3">
              <Link href="/account/billing" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]">
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-[#b9ff66]" />
                  <span className="text-sm font-black">Billing</span>
                </div>
                <ArrowRight size={16} className="text-white/40" />
              </Link>
              <Link href="/billing" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]">
                <div className="flex items-center gap-3">
                  <Sparkles size={18} className="text-[#b9ff66]" />
                  <span className="text-sm font-black">Plans</span>
                </div>
                <ArrowRight size={16} className="text-white/40" />
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#b9ff66] p-4 text-[#123c3a]">
              <FileText size={22} />
              <p className="text-sm font-black leading-5">{resumes.length} resume{resumes.length !== 1 ? "s" : ""} in your workspace.</p>
            </div>
          </aside>
        </section>
      </div> {/* end max-w-7xl content */}
    </main>
  );
}

