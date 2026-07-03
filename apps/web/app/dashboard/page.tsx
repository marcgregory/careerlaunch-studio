import Link from "next/link";
import { ArrowRight, FileText, Gauge, Layers3, LogOut, Plus, Sparkles } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

type DashboardResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: Date;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const resumes: DashboardResume[] = await prisma.resumeDocument.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, targetRole: true, updatedAt: true }
  });

  return (
    <main className="signal-site min-h-screen px-5 py-6 text-[#123c3a]">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-8 border-b border-[#123c3a]/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <Link href="/" className="font-signal inline-flex items-center gap-3 text-2xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22]">
              CareerLaunch
              <span className="rounded-full bg-[#b9ff66] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#123c3a]">Studio</span>
            </Link>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b9ff66] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6bbf22]" />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b]">Workspace active</span>
            </div>
            <h1 className="font-signal mt-5 max-w-4xl text-5xl font-black uppercase leading-[0.86] tracking-[-0.08em] md:text-7xl">
              Application control room.
            </h1>
            <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-[#4b4b4b]">Signed in as {user.email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action="/api/auth/logout" method="post">
              <button className={secondaryButtonClass} type="submit">
                <LogOut size={18} /> Sign out
              </button>
            </form>
            <Link href="/builder" className={primaryButtonClass}>
              <Plus size={18} /> New resume
            </Link>
          </div>
        </header>

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
                  <Link href={`/builder?resumeId=${resume.id}`} className={secondaryButtonClass}>
                    Continue <ArrowRight size={18} />
                  </Link>
                </article>
              ))
            )}
          </div>

          <aside className="rounded-[30px] border border-[#123c3a] bg-[#123c3a] p-6 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)] lg:sticky lg:top-7 lg:self-start">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                <Layers3 size={26} />
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#b9ff66]">Sprint 1</span>
            </div>
            <h2 className="font-signal mt-7 text-4xl font-black leading-[0.92] tracking-[-0.06em]">Complete path to PDF.</h2>
            <p className="mt-5 text-sm font-medium leading-7 text-white/62">
              Auth, PostgreSQL persistence, ownership checks, and export gating are wired into the first vertical slice. The next layer is smarter guidance and richer templates.
            </p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-white/45">
                <span>Signal scan</span>
                <Gauge size={18} className="text-[#b9ff66]" />
              </div>
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-[#b9ff66]" />
                <div className="h-2 w-5/6 rounded-full bg-white/18" />
                <div className="h-2 w-2/3 rounded-full bg-white/18" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black text-[#123c3a]">
              <span className="rounded-xl bg-[#b9ff66] px-2 py-3">Auth</span>
              <span className="rounded-xl bg-white px-2 py-3">Save</span>
              <span className="rounded-xl bg-white px-2 py-3">PDF</span>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#b9ff66] p-4 text-[#123c3a]">
              <Sparkles size={22} />
              <p className="text-sm font-black leading-5">Every draft remains connected to the existing builder flow.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

