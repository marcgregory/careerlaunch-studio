import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  const resumes = await prisma.resumeDocument.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, targetRole: true, updatedAt: true }
  });

  return (
    <main className="min-h-screen bg-[#f6f3ee] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-6">
          <div>
            <Link href="/" className="text-sm font-bold text-emerald-700">
              CareerLaunch Studio
            </Link>
            <h1 className="mt-2 text-3xl font-black">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Signed in as {user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/auth/logout" method="post">
              <button className={secondaryButtonClass} type="submit">
                Sign out
              </button>
            </form>
            <Link href="/builder" className={primaryButtonClass}>
              <Plus size={18} /> New resume
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            {resumes.length === 0 ? (
              <article className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white">
                  <FileText size={22} />
                </div>
                <h2 className="mt-5 text-2xl font-black">No resumes yet</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Create your first database-backed draft and continue editing from any authenticated session.
                </p>
                <div className="mt-6">
                  <Link href="/builder" className={secondaryButtonClass}>
                    Create draft <ArrowRight size={18} />
                  </Link>
                </div>
              </article>
            ) : (
              resumes.map((resume) => (
                <article key={resume.id} className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white">
                        <FileText size={22} />
                      </div>
                      <h2 className="mt-5 text-2xl font-black">{resume.title}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                        {resume.targetRole || "Untargeted resume"} · Updated {resume.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Saved</span>
                  </div>
                  <div className="mt-6">
                    <Link href={`/builder?resumeId=${resume.id}`} className={secondaryButtonClass}>
                      Continue editing <ArrowRight size={18} />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="rounded-md border border-slate-300 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-bold uppercase text-emerald-300">Sprint 1 focus</p>
            <h2 className="mt-3 text-2xl font-black">Build the complete path to PDF.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Auth, PostgreSQL persistence, ownership checks, and export gating are now wired into the first vertical slice.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
