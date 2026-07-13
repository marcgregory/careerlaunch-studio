/**
 * Sentry server-side configuration.
 *
 * Initialized on the server — catches errors in API routes and server
 * components.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "0.1.0",
    sampleRate: process.env.VERCEL_ENV || process.env.NODE_ENV === "production" ? 1.0 : 0.0,
    tracesSampleRate: 0.1,
  });
}
