import Link from "next/link";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return (
    <main className="auth-signal min-h-screen px-5 py-6 text-[#123c3a]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="font-signal text-2xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22]">
          CareerLaunch
        </Link>
        <Link href="/register" className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-[#123c3a] hover:text-[#b9ff66]">
          Create account
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-10 py-10 lg:grid-cols-[1fr_460px]">
        <div className="hidden max-w-3xl lg:block">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b] shadow-sm">
            <Sparkles size={14} className="text-[#6bbf22]" /> Back to the workspace
          </p>
          <h1 className="font-signal mt-7 text-[clamp(4.5rem,9vw,8.5rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
            Resume signal, saved.
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#4b4b4b]">
            Continue the same saved drafts, score checks, preview state, and export flow you already have.
          </p>
        </div>

        <section className="rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_28px_70px_rgba(18,60,58,0.12)] sm:p-8">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
            <LockKeyhole size={24} />
          </div>
          <p className="mt-7 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#6bbf22]">Secure workspace</p>
          <h1 className="font-signal mt-3 text-5xl font-black uppercase leading-none tracking-[-0.07em]">Sign in</h1>
          {params.error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">Email or password did not match.</p>}
          <form action="/api/auth/login" method="post" className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Email</span>
              <input name="email" type="email" required className="signal-input mt-2" id="login-email" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Password</span>
              <input name="password" type="password" required className="signal-input mt-2" id="login-password" />
            </label>
            <button className="signal-button-dark w-full justify-center" type="submit">
              Sign in <ArrowRight size={18} />
            </button>
          </form>
          <Link href="/register" className="signal-button-light mt-3 w-full justify-center">
            Create account
          </Link>
        </section>
      </section>
    </main>
  );
}

