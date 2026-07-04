"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface SentryErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional context to attach to captured errors (e.g. resume ID). */
  context?: Record<string, unknown>;
}

/**
 * Client-side Sentry error boundary.
 *
 * Wraps the builder and other high-value pages so that unhandled React
 * render errors are captured with context.
 */
export function SentryErrorBoundary({ children, context }: SentryErrorBoundaryProps) {
  useEffect(() => {
    if (context) {
      Sentry.setContext("page", context);
    }
    return () => {
      if (context) {
        Sentry.setContext("page", {});
      }
    };
  }, [context]);

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, componentStack }) => (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="font-signal text-xl font-black tracking-[-0.05em] text-red-800">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-red-700">
              {(error as Error | { message?: string })?.message ?? "An unexpected error occurred."}
            </p>
            <p className="mt-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-black text-red-800 transition hover:bg-red-100"
              >
                Reload page
              </button>
            </p>
            {process.env.NODE_ENV === "development" && componentStack && (
              <pre className="mt-4 overflow-auto rounded bg-red-100 p-3 text-left text-xs text-red-900">
                {componentStack}
              </pre>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
