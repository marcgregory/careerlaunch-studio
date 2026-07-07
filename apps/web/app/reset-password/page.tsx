"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, KeyRound, Sparkles, Loader2 } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@careerlaunch/domain";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const email = searchParams?.get("email") ?? "";
  const errorParam = searchParams?.get("error");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(data: ResetPasswordInput) {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token, email }),
      });

      if (response.redirected) {
        router.push(new URL(response.url).pathname);
        return;
      }

      const result = await response.json().catch(() => ({}));
      setError("root", { message: result.message || "Something went wrong. Please try again." });
    } catch {
      setError("root", { message: "Network error. Please try again." });
    }
  }

  if (!token) {
    return (
      <main className="auth-signal min-h-screen px-5 py-6 text-[#123c3a]">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="font-signal text-2xl font-black tracking-[-0.08em]">CareerLaunch</Link>
        </nav>
        <section className="mx-auto mt-20 max-w-md text-center">
          <h1 className="font-signal text-5xl font-black uppercase leading-none tracking-[-0.07em]">Invalid link</h1>
          <p className="mt-5 text-sm font-medium text-[#4b4b4b]">
            This password reset link is missing or malformed. Request a new one.
          </p>
          <Link href="/forgot-password" className="signal-button-dark mt-7 inline-flex w-auto justify-center">
            Request reset link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-signal min-h-screen px-5 py-6 text-[#123c3a]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="font-signal text-2xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22]">
          CareerLaunch
        </Link>
        <Link href="/login" className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-[#123c3a] hover:text-[#b9ff66]">
          Back to sign in
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-10 py-10 lg:grid-cols-[1fr_460px]">
        <div className="hidden max-w-3xl lg:block">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b] shadow-sm">
            <Sparkles size={14} className="text-[#6bbf22]" /> Choose a new key
          </p>
          <h1 className="font-signal mt-7 text-[clamp(4.5rem,9vw,8.5rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
            Set a fresh password.
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#4b4b4b]">
            Must be at least 8 characters, with at least one letter and one number. After this, you&apos;ll sign in with your new credentials.
          </p>
        </div>

        <section className="rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_28px_70px_rgba(18,60,58,0.12)] sm:p-8">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
            <KeyRound size={24} />
          </div>
          <p className="mt-7 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#6bbf22]">New password</p>
          <h1 className="font-signal mt-3 text-5xl font-black uppercase leading-none tracking-[-0.07em]">Reset password</h1>
          {(errorParam || errors.root) && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
              {errors.root?.message || (errorParam === "weak"
                ? "Password must be at least 8 characters with at least one letter and one number."
                : errorParam === "invalid"
                  ? "This reset link is invalid, expired, or already used. Request a new one."
                  : "Something went wrong. Please try again.")}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">New password</span>
              <input
                {...register("password")}
                type="password"
                className={`signal-input mt-2 ${errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="reset-password"
                autoComplete="new-password"
              />
              {errors.password && <p className="mt-1 text-xs font-black text-red-700">{errors.password.message}</p>}
            </label>
            <button className="signal-button-dark w-full justify-center" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={18} className="rotate-180" />}
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
          <Link href="/login" className="signal-button-light mt-3 w-full justify-center">
            <ArrowLeft size={16} /> Back to sign in
          </Link>
        </section>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="auth-signal flex min-h-screen items-center justify-center px-5 py-6 text-[#123c3a]">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
