import Link from "next/link";
import { ArrowRight, Check, FileText, Gauge, Layers3, ScanLine, Sparkles, Target } from "lucide-react";

const signalStats = [
  ["Signal", "Top 8%"],
  ["Impact", "+28%"],
  ["Format", "ATS-safe"]
];

const platformLayers = [
  {
    label: "01. Architecture",
    title: "Role-first structure",
    text: "Target role, summary, skills, and proof points stay connected so the resume reads like one intentional argument.",
    wide: true
  },
  {
    label: "02. Narrative",
    title: "Quantified impact",
    text: "The writing surface pushes duties toward outcomes, context, and measurable evidence."
  },
  {
    label: "03. Delivery",
    title: "Export momentum",
    text: "Save state, preview, and PDF export remain close enough that the document always feels shippable."
  }
];

export default function HomePage() {
  return (
    <main className="signal-site min-h-screen bg-[#f3f3f3] text-[#123c3a]">
      <header className="no-print sticky top-0 z-40 border-b border-[#123c3a]/5 bg-[#f3f3f3]/86 px-5 py-3 backdrop-blur-xl sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="font-signal text-xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22] sm:text-2xl">
            CareerLaunch
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#123c3a] hover:text-[#b9ff66] sm:px-5">
              Dashboard
            </Link>
            <Link href="/builder" className="signal-button-dark whitespace-nowrap text-xs sm:text-sm">
              Open builder
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 pb-20 pt-14 lg:pb-28 lg:pt-24">
        <div className="absolute right-[-12%] top-20 h-[520px] w-[520px] rounded-full bg-[#b9ff66]/30 blur-[120px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="relative z-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b9ff66] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6bbf22]" />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b]">The future of career architecture</span>
            </div>

            <h1 className="font-signal mt-7 max-w-5xl text-[clamp(3.2rem,9vw,8.5rem)] font-black leading-[0.82] tracking-[-0.08em]">
              Unfair resume.
            </h1>
            <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#4b4b4b] lg:text-xl">
              Build a high-performance career document that turns scattered experience into a professional signal: quantified, focused, and impossible to skim past.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/builder" className="signal-button-lime">
                Start building <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className="signal-button-light">
                View saved resumes
              </Link>
            </div>

            <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-[#4b4b4b]">
              <span className="h-2 w-2 rounded-full bg-[#b9ff66] shadow-[0_0_0_6px_rgba(185,255,102,0.18)]" />
              Database-backed drafts, live preview, and PDF export stay intact.
            </div>
          </div>

          <div className="relative z-10 flex justify-center lg:justify-end">
            <div className="resume-card-float relative w-full max-w-[500px] rotate-[-3deg] rounded-[28px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_28px_70px_rgba(18,60,58,0.14)] transition duration-500 hover:rotate-0">
              <div className="absolute -right-5 -top-5 rotate-3 rounded-xl border-2 border-white bg-[#b9ff66] px-4 py-2 font-signal text-sm font-black shadow-[0_4px_0_#123c3a]">
                VERIFIED
              </div>
              <div className="absolute -bottom-6 left-8 flex items-center gap-3 rounded-2xl border border-[#123c3a]/10 bg-white px-4 py-3 shadow-xl">
                <span className="relative h-2.5 w-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500" />
                  <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-xs font-black">Profile activity high</span>
              </div>

              <div className="flex items-start gap-5">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#b9ff66] to-[#72d8ff] p-1">
                  <div className="grid h-full w-full place-items-center rounded-full bg-white font-signal text-2xl font-black">CL</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-signal text-3xl font-black tracking-[-0.06em]">Jordan Smith</p>
                  <p className="mt-1 text-sm font-black text-[#6bbf22]">Customer Success Lead</p>
                  <p className="mt-2 text-xs font-semibold text-[#4b4b4b]">Career switcher / New York, NY</p>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {["Retention", "CRM", "SQL", "Onboarding"].map((skill) => (
                  <span key={skill} className="rounded-full border border-transparent bg-[#f3f3f3] px-3 py-1.5 text-xs font-black transition hover:border-[#b9ff66]">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-7 rounded-2xl bg-[#f3f3f3] p-5 text-sm font-medium leading-7 text-[#4b4b4b]">
                Reduced onboarding delays by 28% by turning support patterns into weekly client-risk reporting for leadership.
              </div>

              <div className="mt-7 grid grid-cols-3 gap-4 border-t border-[#123c3a]/10 pt-6">
                {signalStats.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#777]">{label}</p>
                    <p className="font-signal mt-1 text-xl font-black tracking-[-0.05em]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-[#f3f3f3] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <h2 className="font-signal max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.07em] md:text-6xl">
              Design your trajectory with surgical precision.
            </h2>
            <p className="max-w-md text-base font-medium leading-7 text-[#4b4b4b]">
              Same product flow. Sharper presentation. No fake features, no new capture forms, no changed auth behavior.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {platformLayers.map((layer) => (
              <article key={layer.label} className={`${layer.wide ? "lg:col-span-12" : "lg:col-span-6"} group rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-sm transition hover:border-[#b9ff66]`}>
                <div className={layer.wide ? "grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center" : "flex h-full flex-col"}>
                  <div>
                    <span className="inline-flex rounded-lg border border-[#123c3a]/10 bg-[#f7f7f7] px-3 py-1 font-mono text-xs font-black uppercase text-[#777]">{layer.label}</span>
                    <h3 className="font-signal mt-5 text-3xl font-black tracking-[-0.05em]">{layer.title}</h3>
                    <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[#4b4b4b]">{layer.text}</p>
                  </div>
                  <div className={`${layer.wide ? "mt-0" : "mt-8"} rounded-2xl border border-[#123c3a]/10 bg-[#123c3a] p-5 text-white`}>
                    <div className="mb-4 flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-white/50">
                      <span>Signal scan</span>
                      <ScanLine size={18} className="text-[#b9ff66]" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-2 rounded-full bg-[#b9ff66]" />
                      <div className="h-2 w-5/6 rounded-full bg-white/20" />
                      <div className="h-2 w-2/3 rounded-full bg-white/20" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-dashed border-white/30 p-4 text-center font-mono text-[10px] uppercase text-white/70">ATS scan</div>
                      <div className="rounded-xl border border-dashed border-[#b9ff66] p-4 text-center font-mono text-[10px] uppercase text-[#b9ff66]">Pass</div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#123c3a] px-5 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#b9ff66]">Process</p>
            <h2 className="font-signal mt-4 text-5xl font-black leading-[0.9] tracking-[-0.07em]">Three stages to a cleaner career signal.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [Target, "Target", "Pick the role."],
              [Gauge, "Score", "Tighten the gaps."],
              [FileText, "Export", "Ship the PDF."]
            ].map(([Icon, title, text]) => {
              const DisplayIcon = Icon as typeof Target;
              return (
                <div key={String(title)} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                    <DisplayIcon size={24} />
                  </div>
                  <h3 className="font-signal mt-6 text-2xl font-black tracking-[-0.05em]">{String(title)}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-white/60">{String(text)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#b9ff66] px-5 py-10 text-[#123c3a] sm:py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-signal text-3xl font-black leading-[0.95] tracking-[-0.07em] sm:text-4xl md:text-6xl">
            Stop applying. Start reading like the obvious choice.
          </p>
          <Link href="/builder" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#123c3a] px-5 text-sm font-black text-white shadow-[0_4px_0_#072f2c] transition hover:-translate-y-0.5 sm:w-auto sm:min-h-14 sm:px-7">
            Build my resume <Check size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

