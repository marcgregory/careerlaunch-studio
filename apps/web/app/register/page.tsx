import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@careerlaunch/ui";

const errorText: Record<string, string> = {
  exists: "An account already exists for that email.",
  invalid: "Use a valid email and a password with at least 8 characters.",
  database: "Database is not configured yet. Set DATABASE_URL and run the Prisma migration before creating accounts."
};

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const error = params.error ? errorText[params.error] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-5 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-bold text-emerald-700">
          CareerLaunch Studio
        </Link>
        <h1 className="mt-4 text-3xl font-black">Create account</h1>
        {error && <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        <form action="/api/auth/register" method="post" className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Name</span>
            <input name="name" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Password</span>
            <input name="password" type="password" minLength={8} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button className={`${primaryButtonClass} w-full justify-center`} type="submit">
            Create account
          </button>
        </form>
        <Link href="/login" className={`${secondaryButtonClass} mt-3 w-full justify-center`}>
          Sign in instead
        </Link>
      </section>
    </main>
  );
}
