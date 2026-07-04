/**
 * Sentry client-side configuration.
 *
 * This file is loaded on every page. It initializes the Sentry SDK
 * only when `NEXT_PUBLIC_SENTRY_DSN` is set (production/preview).
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "0.1.0",
    // Capture 100% of errors in production, 0% in dev
    sampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0.0,
    // Replay is not configured yet — start with bare error tracking
    tracesSampleRate: 0.1,
  });
}
