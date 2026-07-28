"use client";

import { useRouter } from "next/navigation";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { SerializedResume } from "./resume-actions";
import {
  type CreateApiError,
  parseCreateError,
} from "./create-resume-errors";

// Re-export so existing callers (`import { parseCreateError } from "./use-create-resume"`)
// keep working without hunting for the new module.
export { parseCreateError, type CreateApiError };

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
 * Why there is NO optimistic insert (and NO overlay):
 *
 *   Clicking "New resume" sends the user on a soft navigation to
 *   `/builder?resumeId=…`. The dashboard is unmounted within milliseconds
 *   of `router.push` firing — anything inserted into the dashboard cache
 *   before navigation is invisible, and the cache write races the route
 *   segment unmount, which makes the dashboard appear to flicker into a
 *   new state right before the builder segment takes over. Worse, the
 *   transition window eats the brief loading.tsx skeleton on the
 *   destination so the user sees no skeleton at all.
 *
 *   Create is gated by RESUME_LIMIT too, so we cannot know whether the
 *   server will accept the request until it actually responds. We wait
 *   for server confirmation, then navigate. The "back to dashboard shows
 *   the new resume" UX benefit is preserved by onSettled →
 *   invalidateQueries(["resumes"]): that re-fetch runs while the user is
 *   on the builder page, so by the time they navigate back the cache
 *   already holds the new row.
 *
 *   Showing an intermediate "Preparing your workspace…" modal for the
 *   ~200ms between click and the route transition is the same problem
 *   the user reported as "a popup appears when I click New resume."
 *   Removing the overlay eliminates that flash. (The global
 *   NavigationOverlay is still useful for flows that keep the user on
 *   the same route — e.g. an export or import that takes longer than a
 *   soft navigation would — and is preserved in
 *   `lib/navigation-overlay.tsx`. It is just not appropriate here.)
 *
 * Flow:
 *   1. Click "New resume" → POST /api/resumes (kind: "starter") with
 *      Idempotency-Key. No UI feedback — the destination transition is
 *      the feedback.
 *   2. On 201 → router.push to /builder?resumeId=… on the next tick. No
 *      cache write — the dashboard's loading.tsx skeleton is allowed to
 *      take over without racing the cache.
 *   3. On 403 upgradeUrl → auto-redirect to upgradeUrl. No toast, no
 *      Upgrade button — the user has already decided they want more
 *      resumes; intermediate prompts are friction.
 *   4. On other failure → toast with Try Again. Cache untouched.
 *   5. onSettled → invalidateQueries(["resumes"]) so a return to the
 *      dashboard sees the freshly-created resume.
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

    // ── Server confirmed: navigate to builder.                                ──
    //
    // No optimistic insert. Earlier this hook called optimisticallyAddResume
    // here so a quick "back" to the dashboard would show the new resume.
    // That had two visible costs:
    //
    //   1. The dashboard re-rendered with a freshly-inserted card during the
    //      router.push transition, making the dashboard appear to "flicker"
    //      into a new state right before the builder segment took over.
    //   2. The transition window between cache update and route unmount
    //      racing the destination's first paint ate the brief loading.tsx
    //      skeleton the user expected to see — it looked like the builder
    //      page opened without a skeleton at all.
    //
    // The "back to dashboard shows the new resume" UX benefit is preserved
    // by onSettled → invalidateQueries(["resumes"]). That re-fetch is
    // cheap (the resume is freshly created and indexed) and it runs while
    // the user is on the builder page, so by the time they navigate back
    // the cache already holds the new row.
    onSuccess: (created, _variables, _context) => {
      // Defer router.push to the next tick so the React commit for the
      // success branch (which closes the mutation's pending state and
      // re-enables the button) lands before the dashboard route segment
      // unmounts. Without this, the unmount races the click-target's
      // re-render.
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