import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="auth-signal min-h-screen px-5 py-6 text-[#123c3a]">
      <nav className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href="/" className="font-signal text-2xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22]">
          CareerLaunch
        </Link>
        <Link href="/login" className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-[#123c3a] hover:text-[#b9ff66]">
          Sign in
        </Link>
      </nav>

      <article className="mx-auto mt-10 max-w-3xl space-y-8 pb-20">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a]">
            <Shield size={26} />
          </div>
          <div>
            <h1 className="font-signal text-5xl font-black uppercase leading-none tracking-[-0.07em]">Privacy Policy</h1>
            <p className="mt-2 text-sm font-medium text-[#4b4b4b]">Last updated: July 7, 2026</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">1. Information We Collect</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            When you create an account, we collect your email address and name. When you use the builder, we store
            the resume content, cover letters, and job descriptions you create or upload. We also collect usage data
            through analytics to improve the product.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">2. How We Use Your Data</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            Your resume data is used exclusively to provide the service: storing drafts, generating AI-powered
            suggestions, creating PDF exports, and matching your resume against job descriptions you provide.
            We do not sell your personal data or resume content to third parties.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">3. AI Processing</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            When you use AI features (analysis, tailoring, cover letter generation), your resume content and job
            descriptions are sent to third-party AI providers (Google Gemini or Groq). These providers do not train
            their models on your data. You should not upload sensitive personal information you are not comfortable
            sharing with an AI service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">4. Data Storage & Retention</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            Your data is stored in PostgreSQL databases hosted on Neon (US region). We retain your data for as long
            as your account is active. You may delete your account at any time, which removes all associated data.
            PDF exports you have downloaded are not recoverable after account deletion.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">5. Cookies</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            We use essential cookies for authentication (session cookie, httpOnly, 14-day expiry). We use PostHog
            for product analytics with cookie-based tracking. You can opt out of analytics in your browser settings.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">6. Third-Party Services</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            We use the following third-party services: Vercel (hosting), Neon (database), Stripe (payments),
            Resend (transactional emails), Sentry (error monitoring), PostHog (analytics), Google AI / Groq (AI).
            Each service has its own privacy policy governing data handling.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">7. Your Rights</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            You may request a copy of your data, request deletion, or correct inaccurate information by contacting
            us. We will respond within 30 days. You may export your resume data at any time through the PDF export feature.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-signal text-2xl font-black tracking-[-0.04em]">8. Contact</h2>
          <p className="text-sm font-medium leading-7 text-[#4b4b4b]">
            For privacy inquiries, contact the account owner at the email address associated with this service.
          </p>
        </section>

        <Link href="/" className="signal-button-light mt-8 inline-flex w-auto">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </article>
    </main>
  );
}
