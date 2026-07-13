/**
 * Next.js instrumentation hook.
 *
 * Called once on server startup. Required by @sentry/nextjs to patch
 * the runtime for error capture.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/** Capture errors from App Router server components and route handlers. */
export const onRequestError = Sentry.captureRequestError;
