"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, LockKeyhole, Sparkles, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@careerlaunch/domain";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams?.get("reset") === "success";
  const sessionExpired = searchParams?.get("session") === "expired";
  const errorParam = searchParams?.get("error");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.redirected) {
        router.push(new URL(response.url).pathname);
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (result.error === "invalid") {
        setError("root", { message: "Email or password did not match." });
      } else if (result.error === "ratelimited") {
        setError("root", { message: "Too many login attempts. Please wait before trying again." });
      } else {
        setError("root", { message: "Something went wrong. Please try again." });
      }
    } catch {
      setError("root", { message: "Network error. Please try again." });
    }
  }

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
          {resetSuccess && (
            <p className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700" role="status">
              Password updated successfully. Sign in with your new password.
            </p>
          )}
          {sessionExpired && (
            <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700" role="status">
              Your session has expired. Please sign in again.
            </p>
          )}
          {errorParam === "ratelimited" && !errors.root && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
              Too many login attempts. Please wait before trying again.
            </p>
          )}
          {errors.root && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
              {errors.root.message}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Email</span>
              <input
                {...register("email")}
                type="email"
                className={`signal-input mt-2 ${errors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="login-email"
              />
              {errors.email && <p className="mt-1 text-xs font-black text-red-700">{errors.email.message}</p>}
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Password</span>
              <input
                {...register("password")}
                type="password"
                className={`signal-input mt-2 ${errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="login-password"
              />
              {errors.password && <p className="mt-1 text-xs font-black text-red-700">{errors.password.message}</p>}
            </label>
            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-xs font-black text-[#4b4b4b] underline underline-offset-2 transition hover:text-[#123c3a]">
                Forgot password?
              </Link>
            </div>
            <button className="signal-button-dark w-full justify-center" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {isSubmitting ? "Signing in..." : "Sign in"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="auth-signal flex min-h-screen items-center justify-center px-5 py-6 text-[#123c3a]">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
