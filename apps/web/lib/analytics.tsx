"use client";

import posthog from "posthog-js";
import { useEffect, useMemo, type ReactNode } from "react";

/**
 * Analytics provider that initializes PostHog on the client side.
 *
 * Only initializes in production when NEXT_PUBLIC_POSTHOG_KEY is set.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: true,
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
      },
    });
  }, []);

  return <>{children}</>;
}

/**
 * Hook to capture analytics events on the client.
 *
 * No-ops outside production.
 */
export function useAnalytics() {
  return useMemo(
    () => ({
      capture: (event: string, properties?: Record<string, unknown>) => {
        if (process.env.NODE_ENV !== "production") return;
        posthog.capture(event, properties);
      },
    }),
    [],
  );
}
