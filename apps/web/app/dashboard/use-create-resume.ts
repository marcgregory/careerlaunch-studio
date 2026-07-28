"use client";

import { useRouter } from "next/navigation";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ResumeCacheData, SerializedResume } from "./resume-actions";
import {
  optimisticallyAddResume,
} from "./use-duplicate-resume";
import {
  type CreateApiError,
  parseCreateError,
} from "./create-resume-errors";

// Re-export so existing callers (`import { parseCreateError } from "./use-create-resume"`)
// keep working without hunting for the new module.
export { parseCreateError, type CreateApiError };

// ─── Cache helpers ────────────────────────────────────────────────────────────
// `optimisticallyAddResume` lives in use-duplicate-resume.ts — single source
// of truth for the cache shape.

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateVariables = {
  idempotencyKey: string;
};

/**
 * Context returned from onMutate. Currently unused — the create flow is
 * short-lived and never shows a popup, so onMutate has nothing to track
 * for cleanup in onError. Kept as an empty object so the mutation type
 * signature stays explicit (TanStack Query requires it).
 */
type CreateContext = {};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * `useCreateResume` — drives the dashboard "New resume" flow.
 *
 * Why there is NO optimistic insert:
 *
 *   Clicking "New resume" sends the user on a soft navigation to
 *   `/builder?resumeId=…`. The dashboard is unmounted within milliseconds
 *   of `router.push` firing — anything inserted into the dashboard cache
 *   before navigation is at best invisible and at worst races the
 *   destination's first paint (the source of the observed flicker).
 *
 *   Create is gated by RESUME_LIMIT too, so we cannot know whether the
 *   server will accept the request until it actually responds. We wait
 *   for server confirmation, then insert the real resume into the cache
 *   so a subsequent return-to-dashboard is instant.
 *
 * Why there is NO overlay / loading popup:
 *
 *   The mutation has only two terminal paths, both of which transition
 *   the user away from the dashboard:
 *
 *     • 201 success → router.push("/builder?resumeId=…") in onSuccess.
 *       The destination's `loading.tsx` skeleton IS the loading state.
 *     • 403 RESUME_LIMIT → window.location.href = upgradeUrl in onError.
 *       The user is sent straight to /billing.
 *
 *   Showing an intermediate "Preparing your workspace…" modal for the
 *   ~200ms between click and either terminal transition produces a
 *   visible flash that the user reads as "a popup appears when I click
 *   New resume." Removing the overlay eliminates that flash.
 *
 *   (The global NavigationOverlay is still useful for flows that keep
 *   the user on the same route — e.g. an export or import that takes
 *   longer than a soft navigation would — and is preserved in
 *   `lib/navigation-overlay.tsx`. It is just not appropriate here.)
 *
 * Flow:
 *   1. Click "New resume" → POST /api/resumes (kind: "starter") with
 *      Idempotency-Key. No UI feedback — the destination transition is
 *      the feedback.
 *   2. On 201 → insert the real resume into the cache, router.push to
 *      /builder?resumeId=… on the next tick.
 *   3. On 403 upgradeUrl → auto-redirect to upgradeUrl. No toast, no
 *      Upgrade button — the user has already decided they want more
 *      resumes; intermediate prompts are friction.
 *   4. On other failure → toast with Try Again. Cache untouched
 *      (nothing was inserted).
 */
export function useCreateResume() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation<
    SerializedResume,
    Error,
    CreateVariables,
    CreateContext
  >({
    mutationKey: ["createResume"],

    mutationFn: async ({ idempotencyKey }) => {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ kind: "starter" }),
      });

      if (!res.ok) {
        throw await parseCreateError(res, "Failed to create resume");
      }

      const data = await res.json();
      const r = data.resume;
      return {
        id: r.id,
        title: r.title,
        targetRole: r.targetRole ?? null,
        updatedAt: new Date().toISOString(),
        analysisRunCount: 0,
        exportCount: 0,
      } satisfies SerializedResume;
    },

    // ── No overlay. No toast. The user does not need an intermediate      ──
    //  "Preparing your workspace…" popup on this path:                       ──
    //                                                                        ──
    //   • 201 success → `router.push("/builder?resumeId=…")` immediately.     ──
    //     The destination's `loading.tsx` skeleton IS the loading state —     ──
    //     showing a second spinner on top of it is redundant.                ──
    //                                                                        ──
    //   • 403 RESUME_LIMIT → `window.location.href = upgradeUrl` in onError. ──
    //     No popup, no toast, no Upgrade button — straight to /billing.      ──
    //                                                                        ──
    //   • Other failure → a single Try Again toast in onError.               ──
    //                                                                        ──
    //  Previously this hook showed the global NavigationOverlay synchronously ──
    //  on click. That produced a visible ~200ms modal-like flash before the  ──
    //  redirect, which the user read as "a popup appears when I click New    ──
    //  resume." The overlay is the right tool for long-running flows that    ──
    //  keep the user on the same route; this isn't one of them.              ──
    onMutate: async () => {
      return {};
    },

    // ── Server confirmed: insert real resume, then navigate ────────────────
    //
    // `optimisticallyAddResume` here is the SUCCESS path insert — it
    // happens only after the server returns 201, so a 403 RESUME_LIMIT
    // never produces a phantom card. The insert means a quick "back" to
    // the dashboard shows the new resume immediately.
    onSuccess: (created, _variables, _context) => {
      optimisticallyAddResume(queryClient, created);
      // Defer router.push to the next tick so React commits the cache
      // update before the route segment unmounts. Without this, the
      // dashboard unmounts before the optimistic-cache write is observed,
      // and the destination's loading.tsx skeleton can briefly replace
      // the overlay before the destination paints.
      queueMicrotask(() => {
        router.push(`/builder?resumeId=${created.id}`);
      });
    },

    // ── Entitlement 403 → auto-redirect to billing (no toast, no button) ──
    //  Other failure → retry toast, no cache change, no navigation.         ──
    onError: (err, variables, _context) => {
      const upgradeUrl = (err as CreateApiError).upgradeUrl;

      // When the user has hit the resume limit, skip the toast + Upgrade
      // button and send them straight to billing. This is the whole point
      // of the upgrade flow — the user has already decided they want more
      // resumes, so any intermediate prompt is friction.
      if (upgradeUrl) {
        // eslint-disable-next-line react-hooks/immutability -- synchronous redirect; deferring via useEffect would reintroduce the flicker
        window.location.href = upgradeUrl;
        return;
      }

      toast.error(err.message || "Failed to create resume. Please try again.", {
        action: {
          label: "Try Again",
          onClick: () =>
            createMutation.mutate({ idempotencyKey: variables.idempotencyKey }),
        },
      });
    },

    // ── Always invalidate so any other tab catches up ──────────────────────
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  // ── In-flight guard ────────────────────────────────────────────────────────
  const isAnyCreating = useIsMutating({ mutationKey: ["createResume"] }) > 0;

  /**
   * Trigger a create. Generates a fresh idempotency key per click.
   * If a create is already in flight, this is a no-op — preventing
   * accidental double-submits that would create two starters (the second
   * hits the resume-limit entitlement gate).
   */
  const create = useCallback(() => {
    if (isAnyCreating) return;
    createMutation.mutate({ idempotencyKey: crypto.randomUUID() });
  }, [createMutation, isAnyCreating]);

  return {
    create,
    isCreating: createMutation.isPending,
  };
}