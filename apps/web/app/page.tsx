import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

const features = [
  {
    icon: FileText,
    title: "Guided resume sections",
    text: "Structured prompts help job seekers turn messy career history into a clear application story."
  },
  {
    icon: Sparkles,
    title: "Role-aware wording",
    text: "The first product wedge focuses on career switchers who need transferable experience to read correctly."
  },
  {
    icon: ShieldCheck,
    title: "Trust-first pricing path",
    text: "The product is designed around clear feature gates and export value, not hidden subscription traps."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] text-slate-950">
      <nav className="no-print mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-lg font-black">
          CareerLaunch
        </Link>
        <Link href="/builder" className={secondaryButtonClass}>
          Open builder
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-700">Resume builder for career switchers</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[1.03] tracking-normal text-slate-950 md:text-6xl">
            Turn real experience into a resume that fits the role.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            CareerLaunch Studio helps job seekers shape resumes, check weak spots, preview an original template, and export a polished document.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/builder" className={primaryButtonClass}>
              Start building <ArrowRight size={18} />
            </Link>
            <Link href="/dashboard" className={secondaryButtonClass}>
              View dashboard
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-4 top-8 hidden h-36 w-2 bg-emerald-700 lg:block" />
          <div className="grid gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="border-b border-slate-300 py-5">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{feature.title}</h2>
                      <p className="mt-2 leading-7 text-slate-700">{feature.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="text-emerald-700" size={20} />
            Original templates only. No copied competitor assets.
          </div>
        </div>
      </section>
    </main>
  );
}

