import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-6">
          <div>
            <Link href="/" className="text-sm font-bold text-emerald-700">
              CareerLaunch Studio
            </Link>
            <h1 className="mt-2 text-3xl font-black">Dashboard</h1>
          </div>
          <Link href="/builder" className={primaryButtonClass}>
            <Plus size={18} /> New resume
          </Link>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <article className="rounded-md border border-slate-300 bg-white p-5 shadow-sm md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white">
                  <FileText size={22} />
                </div>
                <h2 className="mt-5 text-2xl font-black">Career Switch Resume</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Local demo draft for the Sprint 1 vertical slice. Database-backed documents are next in the plan.
                </p>
              </div>
              <span className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Demo</span>
            </div>
            <div className="mt-6">
              <Link href="/builder" className={secondaryButtonClass}>
                Continue editing <ArrowRight size={18} />
              </Link>
            </div>
          </article>

          <aside className="rounded-md border border-slate-300 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-bold uppercase text-emerald-300">Sprint 1 focus</p>
            <h2 className="mt-3 text-2xl font-black">Build the complete path to PDF.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Auth, database persistence, and billing will replace the local demo state as the vertical slice hardens.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}

