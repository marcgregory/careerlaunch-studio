/**
 * Centralized error reporting helper.
 *
 * Wraps Sentry.captureException with consistent tagging. No-ops in
 * development to avoid noise.
 */
import * as Sentry from "@sentry/nextjs";

export function reportError(
  error: unknown,
  requestId?: string,
  extra?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "development") return;

  Sentry.captureException(error, {
    tags: {
      ...(requestId ? { requestId } : {}),
    },
    extra,
  });
}
