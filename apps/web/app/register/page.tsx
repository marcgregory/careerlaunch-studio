"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { ArrowRight, PenLine, Sparkles, Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@careerlaunch/domain";

const ERROR_TEXT: Record<string, string> = {
  exists: "An account already exists for that email.",
  invalid: "Use a valid email and a password with at least 8 characters.",
  database: "Database is not configured yet. Set DATABASE_URL and run the Prisma migration before creating accounts.",
  ratelimited: "Too many registration attempts. Please wait before trying again.",
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams?.get("error");
  const serverError = useMemo(() => (errorParam ? ERROR_TEXT[errorParam] : null), [errorParam]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(data: RegisterInput) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.redirected) {
        router.push(new URL(response.url).pathname);
        return;
      }

      const result = await response.json().catch(() => ({}));
      setError("root", { message: result.message || "Registration failed. Please try again." });
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
        <Link href="/login" className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-[#123c3a] hover:text-[#b9ff66]">
          Sign in
        </Link>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-start gap-10 py-10 lg:grid-cols-[1fr_540px] lg:py-0">
        <div className="hidden max-w-3xl lg:block">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#123c3a]/10 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#4b4b4b] shadow-sm">
            <Sparkles size={14} className="text-[#6bbf22]" /> Start with a sharper signal
          </p>
          <h1 className="auth-hero-title font-signal mt-7 font-black uppercase">
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
          {(serverError || errors.root) && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
              {errors.root?.message || serverError}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Name</span>
              <input
                {...register("name")}
                className={`signal-input mt-2 ${errors.name ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="register-name"
              />
              {errors.name && <p className="mt-1 text-xs font-black text-red-700">{errors.name.message}</p>}
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Email</span>
              <input
                {...register("email")}
                type="email"
                className={`signal-input mt-2 ${errors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="register-email"
              />
              {errors.email && <p className="mt-1 text-xs font-black text-red-700">{errors.email.message}</p>}
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#4b4b4b]">Password</span>
              <input
                {...register("password")}
                type="password"
                className={`signal-input mt-2 ${errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                id="register-password"
              />
              {errors.password && <p className="mt-1 text-xs font-black text-red-700">{errors.password.message}</p>}
            </label>
            <button className="signal-button-dark w-full justify-center" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {isSubmitting ? "Creating account..." : "Create account"}
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

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="auth-signal flex min-h-screen items-center justify-center px-5 py-6 text-[#123c3a]">
        <Loader2 size={32} className="animate-spin text-[#6bbf22]" />
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}
