"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export type PlanInfo = {
  id: string;
  label: string;
  isCurrent: boolean;
};

export type InvoiceSummary = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type SubscriptionData = {
  currentPlan: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  scheduledChange: { plan: string; effectiveDate: string | null } | null;
  pdfExportKind?: string;
  monthlyExportsUsed?: number;
  paymentMethod?: { brand: string; last4: string } | null;
  invoices?: InvoiceSummary[];
  plans: PlanInfo[];
};

export const DEFAULT_SUBSCRIPTION_DATA: SubscriptionData = {
  currentPlan: "free",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  scheduledChange: null,
  pdfExportKind: "watermarked",
  monthlyExportsUsed: 0,
  paymentMethod: null,
  invoices: [],
  plans: [
    { id: "free", label: "Free", isCurrent: true },
    { id: "professional", label: "Professional", isCurrent: false },
    { id: "enterprise", label: "Enterprise", isCurrent: false },
  ],
};

export function normalizeSubscriptionData(
  value: Partial<SubscriptionData> | null | undefined,
): SubscriptionData {
  const currentPlan = ["free", "professional", "enterprise"].includes(
    value?.currentPlan ?? "",
  )
    ? value?.currentPlan ?? "free"
    : "free";

  return {
    currentPlan,
    cancelAtPeriodEnd: Boolean(value?.cancelAtPeriodEnd),
    currentPeriodEnd:
      typeof value?.currentPeriodEnd === "string" ? value.currentPeriodEnd : null,
    scheduledChange:
      value?.scheduledChange && typeof value.scheduledChange === "object"
        ? {
            plan:
              typeof value.scheduledChange.plan === "string"
                ? value.scheduledChange.plan
                : "",
            effectiveDate:
              typeof value.scheduledChange.effectiveDate === "string"
                ? value.scheduledChange.effectiveDate
                : null,
          }
        : null,
    pdfExportKind: value?.pdfExportKind ?? "watermarked",
    monthlyExportsUsed: value?.monthlyExportsUsed ?? 0,
    paymentMethod: value?.paymentMethod ?? null,
    invoices: Array.isArray(value?.invoices) ? value.invoices : [],
    plans: Array.isArray(value?.plans)
      ? value.plans
      : DEFAULT_SUBSCRIPTION_DATA.plans.map((plan) => ({
          ...plan,
          isCurrent: plan.id === currentPlan,
        })),
  };
}

export function isPostCheckoutUrl(searchParams: URLSearchParams | null): boolean {
  if (!searchParams) return false;
  const checkout = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");
  const upgrade = searchParams.get("upgrade");
  const payment = searchParams.get("payment");

  return (
    checkout === "success" ||
    Boolean(sessionId) ||
    upgrade === "completed" ||
    payment === "success"
  );
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 20; // 30 seconds

export function useSubscriptionVerification() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const isCheckoutReturn = isPostCheckoutUrl(searchParams);
  const targetPlan = searchParams?.get("plan");

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(isCheckoutReturn);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePollRef = useRef<boolean>(false);

  const syncCache = useCallback(
    (newData: SubscriptionData) => {
      queryClient.setQueryData(["subscription"], newData);
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    [queryClient],
  );

  const cleanUrl = useCallback(() => {
    if (isCheckoutReturn && pathname) {
      router.replace(pathname, { scroll: false });
    }
  }, [isCheckoutReturn, pathname, router]);

  const verifySubscription = useCallback(async () => {
    if (activePollRef.current) return;
    activePollRef.current = true;
    setIsVerifying(true);
    setTimedOut(false);
    setError(null);

    let attempts = 0;
    let confirmed = false;

    while (attempts < MAX_POLL_ATTEMPTS && activePollRef.current) {
      attempts++;
      try {
        const res = await fetch("/api/billing/subscription");
        if (res.ok) {
          const raw = await res.json();
          const normalized = normalizeSubscriptionData(raw);

          const isUpgraded = targetPlan
            ? normalized.currentPlan === targetPlan
            : normalized.currentPlan !== "free";

          if (isUpgraded || !isCheckoutReturn) {
            setData(normalized);
            syncCache(normalized);
            confirmed = true;
            setIsVerifying(false);
            activePollRef.current = false;
            cleanUrl();
            return;
          }

          // If still free on first read during checkout return, keep data populated
          setData(normalized);
        }
      } catch {
        // Retry transient errors during Stripe settlement
      }

      if (activePollRef.current && attempts < MAX_POLL_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    if (activePollRef.current && !confirmed) {
      setIsVerifying(false);
      setTimedOut(true);
      activePollRef.current = false;
    }
  }, [cleanUrl, isCheckoutReturn, syncCache, targetPlan]);

  const refreshSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (res.ok) {
        const normalized = normalizeSubscriptionData(await res.json());
        setData(normalized);
        syncCache(normalized);
      }
    } catch {
      setError("Failed to refresh subscription.");
    }
  }, [syncCache]);

  useEffect(() => {
    let unmounted = false;

    async function initialLoad() {
      setLoading(true);
      try {
        const res = await fetch("/api/billing/subscription");
        if (!res.ok) throw new Error("Failed to load subscription");

        const normalized = normalizeSubscriptionData(await res.json());
        if (unmounted) return;

        setData(normalized);
        syncCache(normalized);

        // If user already has active plan or doesn't need checkout verification
        const isUpgraded = targetPlan
          ? normalized.currentPlan === targetPlan
          : normalized.currentPlan !== "free";

        if (!isCheckoutReturn || isUpgraded) {
          setIsVerifying(false);
          if (isCheckoutReturn) cleanUrl();
        } else {
          // Needs verification polling
          verifySubscription();
        }
      } catch {
        if (!unmounted) {
          setData(DEFAULT_SUBSCRIPTION_DATA);
          setError("We couldn't refresh your subscription yet.");
          setIsVerifying(false);
        }
      } finally {
        if (!unmounted) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      unmounted = true;
      activePollRef.current = false;
    };
  }, [cleanUrl, isCheckoutReturn, syncCache, targetPlan, verifySubscription]);

  const retryVerification = useCallback(() => {
    activePollRef.current = false;
    verifySubscription();
  }, [verifySubscription]);

  return {
    data,
    loading,
    isVerifying,
    timedOut,
    error,
    setError,
    retryVerification,
    refreshSubscription,
    isCheckoutReturn,
  };
}
