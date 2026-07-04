/**
 * Next.js instrumentation hook.
 *
 * Called once on server startup. Required by @sentry/nextjs to patch
 * the runtime for error capture.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
