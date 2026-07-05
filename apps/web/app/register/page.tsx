import Link from "next/link";
import { ArrowRight, PenLine, Sparkles } from "lucide-react";

const errorText: Record<string, string> = {
  exists: "An account already exists for that email.",
  invalid: "Use a valid email and a password with at least 8 characters.",
  database: "Database is not configured yet. Set DATABASE_URL and run the Prisma migration before creating accounts."
};

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const error = params.error ? errorText[params.error] : null;

  return (
    <main className="auth-signal min-h-screen px-5 py-6 text-[#123c3a]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="font-signal text-2xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22]">
          CareerLaunch
        </Link>
        <Link href="/login" className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-[#123c3a] hover:text-[#b9ff66]">
          Sign in
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-10 py-10 lg:grid-cols-[1fr_540px]">
        <div className="hidden max-w-3xl lg:block">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b] shadow-sm">
            <Sparkles size={14} className="text-[#6bbf22]" /> Start with a sharper signal
          </p>
          <h1 className="font-signal mt-7 text-[clamp(4.5rem,9vw,8.5rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
            Build the version that gets read.
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#4b4b4b]">
            Create the same authenticated workspace, then continue into the existing dashboard and builder flow.
          </p>
        </div>

        <section className="rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_28px_70px_rgba(18,60,58,0.12)] sm:p-8">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
            <PenLine size={24} />
          </div>
          <p className="mt-7 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#6bbf22]">New workspace</p>
          <h1 className="font-signal mt-3 text-5xl font-black uppercase leading-none tracking-[-0.07em]">Create account</h1>
          {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
          <form action="/api/auth/register" method="post" className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Name</span>
              <input name="name" className="signal-input mt-2" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Email</span>
              <input name="email" type="email" required className="signal-input mt-2" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Password</span>
              <input name="password" type="password" minLength={8} required className="signal-input mt-2" />
            </label>
            <button className="signal-button-dark w-full justify-center" type="submit">
              Create account <ArrowRight size={18} />
            </button>
          </form>
          <Link href="/login" className="signal-button-light mt-3 w-full justify-center">
            Sign in instead
          </Link>
        </section>
      </section>
    </main>
  );
}

