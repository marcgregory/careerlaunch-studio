import Link from "next/link";
import { ArrowRight, BadgeCheck, Sparkles, XCircle } from "lucide-react";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = params.success === "true";
  const error = params.error;

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

      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-md items-center">
        <section className="w-full rounded-[28px] border border-[#123c3a]/10 bg-white p-6 text-center shadow-[0_28px_70px_rgba(18,60,58,0.12)] sm:p-8">
          {success ? (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
                <BadgeCheck size={32} />
              </div>
              <h1 className="font-signal mt-6 text-4xl font-black uppercase leading-none tracking-[-0.07em]">Email verified!</h1>
              <p className="mt-4 text-sm font-medium leading-7 text-[#4b4b4b]">
                Your email has been verified. You now have full access to your account.
              </p>
              <Link href="/dashboard" className="signal-button-dark mt-7 inline-flex w-auto justify-center">
                Go to dashboard <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600">
                <XCircle size={32} />
              </div>
              <h1 className="font-signal mt-6 text-4xl font-black uppercase leading-none tracking-[-0.07em]">Invalid link</h1>
              <p className="mt-4 text-sm font-medium leading-7 text-[#4b4b4b]">
                {error === "invalid"
                  ? "This verification link is invalid, expired, or already used."
                  : "Something went wrong verifying your email."}
              </p>
              <p className="mt-2 text-sm font-medium text-[#4b4b4b]">
                Sign in to request a new verification email.
              </p>
              <Link href="/login" className="signal-button-dark mt-7 inline-flex w-auto justify-center">
                Sign in <ArrowRight size={18} />
              </Link>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
