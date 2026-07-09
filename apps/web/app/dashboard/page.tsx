import Link from "next/link";
import { FileText, LogOut, Plus, Sparkles } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { AppHeader, AppLogo } from "../../components/app-header";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { getSubscription } from "../../lib/entitlements";
import { EmailVerificationBanner } from "../../components/email-verification-banner";
import { ResumeList } from "./resume-list";
import { WorkspaceStats } from "./workspace-stats";

type SerializedResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: string;
  analysisRunCount: number;
  exportCount: number;
};

const INITIAL_PAGE_SIZE = 10;

export default async function DashboardPage() {
  const user = await requireUser();
  const [allResumesForStats, subscription] = await Promise.all([
    prisma.resumeDocument.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        targetRole: true,
        _count: { select: { analysisRuns: true, exports: true } },
      },
    }),
    getSubscription(user.id),
  ]);
  const isFree = subscription.plan === "free";

  const totalResumeCount = allResumesForStats.length;
  const targetedCount = allResumesForStats.filter((r) => r.targetRole).length;
  const analyzedCount = allResumesForStats.filter((r) => r._count.analysisRuns > 0).length;
  const exportCount = allResumesForStats.reduce((sum, r) => sum + r._count.exports, 0);

  // Fetch first page for initial render
  const initialResumes = await prisma.resumeDocument.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: INITIAL_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      targetRole: true,
      updatedAt: true,
      _count: { select: { analysisRuns: true, exports: true } },
    },
  });

  const serialized: SerializedResume[] = initialResumes.map((r) => ({
    id: r.id,
    title: r.title,
    targetRole: r.targetRole,
    updatedAt: r.updatedAt.toISOString(),
    analysisRunCount: r._count.analysisRuns,
    exportCount: r._count.exports,
  }));

  const planLabel =
    subscription.plan.charAt(0).toUpperCase() +
    subscription.plan.slice(1).toLowerCase();

  const hasMore = initialResumes.length < totalResumeCount;

  return (
    <main className="signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px]">
      <AppHeader
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <form action="/api/auth/logout" method="post">
              <button className={secondaryButtonClass} type="submit">
                <LogOut size={16} />{" "}
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
            <Link href="/import" className={secondaryButtonClass}>
              <FileText size={16} />{" "}
              <span className="hidden sm:inline">Import</span>
            </Link>
            <Link href="/builder" className={primaryButtonClass}>
              <Plus size={16} />{" "}
              <span className="hidden sm:inline">New resume</span>
            </Link>
          </div>
        }
      >
        <AppLogo />
      </AppHeader>

      <div className="mx-auto max-w-7xl px-5 py-6">
        {/* Header */}
        <header className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b9ff66] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6bbf22]" />
            </span>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b]">
              Workspace active
            </span>
          </div>
          <h1 className="font-signal mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.86] tracking-[-0.08em] md:text-7xl sm:mt-5">
            Application control room.
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#4b4b4b] sm:mt-5">
            Signed in as {user.email}
          </p>
        </header>

        {/* Email verification banner */}
        {!user.emailVerifiedAt && <EmailVerificationBanner email={user.email} />}

        {/* Free plan upgrade banner */}
        {isFree && (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-[30px] border border-[#b9ff66]/60 bg-[#b9ff66]/15 p-4 md:flex-row md:items-center md:justify-between md:gap-5 md:p-4">
            <div className="flex w-full items-center gap-4 md:w-auto md:min-w-0 md:flex-1">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-signal text-sm font-black tracking-[-0.02em] md:text-base">
                  You&apos;re on the Free plan
                </p>
                <p className="text-xs font-medium text-[#4b4b4b] md:text-sm">
                  Upgrade to Professional for unlimited resumes, all templates,
                  job matching, and clean PDF exports.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#123c3a] bg-[#123c3a] px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_3px_0_#123c3a] transition hover:bg-[#1a5250] md:w-auto md:min-w-[160px] md:px-8"
            >
              <Sparkles size={16} /> Upgrade
            </Link>
          </div>
        )}

        {/* Main grid */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Resume list */}
          <div className="min-w-0">
            <ResumeList
              initialResumes={serialized}
              hasMoreInit={hasMore}
            />
          </div>

          {/* Workspace sidebar */}
          <WorkspaceStats
            totalResumes={totalResumeCount}
            targetedCount={targetedCount}
            analyzedCount={analyzedCount}
            exportCount={exportCount}
            isFree={isFree}
            planName={planLabel}
          />
        </section>
      </div>
    </main>
  );
}
