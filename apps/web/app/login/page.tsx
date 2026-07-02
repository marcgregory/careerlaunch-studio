import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-5 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-bold text-emerald-700">
          CareerLaunch Studio
        </Link>
        <h1 className="mt-4 text-3xl font-black">Sign in</h1>
        {params.error && <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">Email or password did not match.</p>}
        <form action="/api/auth/login" method="post" className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Password</span>
            <input name="password" type="password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button className={`${primaryButtonClass} w-full justify-center`} type="submit">
            Sign in
          </button>
        </form>
        <Link href="/register" className={`${secondaryButtonClass} mt-3 w-full justify-center`}>
          Create account
        </Link>
      </section>
    </main>
  );
}
