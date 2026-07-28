"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ResumeCacheData, SerializedResume } from "./resume-actions";

// ─── Cache helpers ────────────────────────────────────────────────────────────
// These live here as the single source of truth for the resume-list cache
// shape. `optimisticallyAddResume` is used by useCreateResume; the duplicate
// flow itself no longer inserts optimistically (duplication is gated by
// RESUME_LIMIT, so we wait for server confirmation before touching the cache).

export function optimisticallyAddResume(
  queryClient: ReturnType<typeof useQueryClient>,
  resume: SerializedResume
) {
  queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
    if (!old) return old;
    return {
      ...old,
      pageParams: old.pageParams,
      pages: old.pages.map((p, i) =>
        i === 0
          ? {
              ...p,
              resumes: [resume, ...p.resumes],
              pagination: { ...p.pagination, total: p.pagination.total + 1 },
              stats: p.stats
                ? {
                    ...p.stats,
                    totalResumes: p.stats.totalResumes + 1,
                    targetedCount: resume.targetRole ? p.stats.targetedCount + 1 : p.stats.targetedCount,
                  }
                : undefined,
            }
          : p
      ),
    };
  });
}

export function replaceOrRemoveOptimisticResume(
  queryClient: ReturnType<typeof useQueryClient>,
  optimisticId: string,
  replacement: SerializedResume | null
) {
  queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
    if (!old) return old;
    const optimisticCard = old.pages[0]?.resumes.find((r) => r.id === optimisticId);
    return {
      ...old,
      pages: old.pages.map((p, i) => {
        if (i !== 0) return p;
        if (replacement) {
          return {
            ...p,
            resumes: p.resumes.map((r) =>
              r.id === optimisticId ? replacement : r
            ),
          };
        }
        // null → rollback: remove the optimistic entry and decrement total
        return {
          ...p,
          resumes: p.resumes.filter((r) => r.id !== optimisticId),
          pagination: { ...p.pagination, total: Math.max(0, p.pagination.total - 1) },
          stats: p.stats
            ? {
                ...p.stats,
                totalResumes: Math.max(0, p.stats.totalResumes - 1),
                targetedCount: optimisticCard?.targetRole
                  ? Math.max(0, p.stats.targetedCount - 1)
                  : p.stats.targetedCount,
              }
            : undefined,
        };
      }),
    };
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Idempotency key is generated once per user click and baked into mutation
 * variables — NOT only context. This means "Duplicate Again" retries carry
 * the same key, so the server can safely short-circuit a duplicate create.
 */
type DuplicateVariables = {
  resume: SerializedResume;
  idempotencyKey: string;
};

type DuplicateContext = {
  toastId: string | number;
};

/**
 * Errors thrown by the duplicate mutation. The `upgradeUrl` field is set
 * when the server returns a 403 with `feature: "resume_limit"` so the toast
 * can render an "Upgrade" action button instead of a "Duplicate Again"
 * retry button (re-running the same request will just 403 again).
 */
export type DuplicateApiError = Error & { upgradeUrl?: string };

/**
 * Parse a non-OK duplicate response into a structured Error. The 403 from
 * the duplicate route carries `{ error, feature, upgradeUrl }`; we lift
 * `upgradeUrl` onto the thrown Error so the caller's onError can branch on
 * it without re-parsing the response.
 */
export async function parseDuplicateError(
  res: Response,
  fallback: string
): Promise<DuplicateApiError> {
  const body = (await res
    .json()
    .catch(() => ({ error: fallback }))) as { error?: string; upgradeUrl?: string };
  const error = new Error(body.error || fallback) as DuplicateApiError;
  if (body.upgradeUrl) error.upgradeUrl = body.upgradeUrl;
  return error;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * `useDuplicateResume` — drives the dashboard "Duplicate" menu action.
 *
 * Duplicate is gated by the RESUME_LIMIT entitlement, so we deliberately do
 * NOT optimistically insert the duplicated resume into the dashboard cache:
 * if the user is at the cap, the server returns 403 and we must surface the
 * upgrade/paywall without ever flashing a phantom resume that disappears a
 * second later.
 *
 * Flow:
 *   1. Click "Duplicate" → show "Duplicating…" spinner (server-loaded card
 *      state) and a loading toast.
 *   2. POST /api/resumes/:id/duplicate with an Idempotency-Key.
 *   3. On 201 → insert the real duplicated resume into the cache and show a
 *      success toast.
 *   4. On 403 RESUME_LIMIT → do NOT touch the cache. Surface a paywall toast
 *      with an Upgrade action. The list is unchanged.
 *   5. On any other failure (network, 5xx) → dismiss the loading toast and
 *      show a "Duplicate Again" retry toast.
 */
export function useDuplicateResume() {
  const queryClient = useQueryClient();

  const duplicateMutation = useMutation<
    SerializedResume,
    Error,
    DuplicateVariables,
    DuplicateContext
  >({
    mutationKey: ["duplicateResume"],

    mutationFn: async ({ resume, idempotencyKey }: DuplicateVariables) => {
      const res = await fetch(`/api/resumes/${resume.id}/duplicate`, {
        method: "POST",
        // The server uses this key to detect replays and return the already-
        // created copy instead of creating a second resume.
        headers: { "Idempotency-Key": idempotencyKey },
      });

      if (!res.ok) {
        throw await parseDuplicateError(res, "Failed to duplicate resume");
      }

      const data = await res.json();
      return {
        id: data.resume.id,
        title: data.resume.title,
        targetRole: data.resume.targetRole ?? null,
        updatedAt: new Date().toISOString(),
        analysisRunCount: 0,
        exportCount: 0,
      } satisfies SerializedResume;
    },

    // ── No optimistic insert. We do not know yet whether the user is at    ──
    //  their plan's resume cap, so we cannot show the card. We DO pause any   ──
    //  in-flight refetches so a background re-fetch cannot race the server   ──
    //  confirmation and leave the cache in an inconsistent state.            ──
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["resumes"] });

      // A loading toast gives instant feedback without falsely claiming
      // "done" before the server confirms.
      const toastId = toast.loading("Duplicating resume…");
      return { toastId };
    },

    // ── Insert the real resume now that the server confirmed success ────────
    onSuccess: (dupedResume, _variables, context) => {
      optimisticallyAddResume(queryClient, dupedResume);
      if (context) {
        toast.success("Resume duplicated.", { id: context.toastId });
      }
    },

    // ── Entitlement 403 → auto-redirect to billing (no toast, no button) ──
    //  Transient failure → offer retry. Either way, the list was never    ──
    //  touched in the first place.                                          ──
    onError: (err, variables, context) => {
      if (context) {
        toast.dismiss(context.toastId);
      }

      const upgradeUrl = (err as DuplicateApiError).upgradeUrl;

      if (upgradeUrl) {
        // 403 "resume limit" — auto-redirect to billing. The user has
        // already decided they want more resumes; the toast + Upgrade
        // button was friction.
        // eslint-disable-next-line react-hooks/immutability -- synchronous redirect; deferring via useEffect would reintroduce the flicker
        window.location.href = upgradeUrl;
        return;
      }

      // Transient failure (network, 5xx) — re-running the same request is
      // safe because the idempotency key is preserved. The server will
      // return the already-created copy if the original eventually landed.
      toast.error(err.message || "Failed to duplicate resume. Please try again.", {
        action: {
          label: "Duplicate Again",
          onClick: () =>
            duplicateMutation.mutate({
              resume: variables.resume,
              idempotencyKey: variables.idempotencyKey,
            }),
        },
      });
    },

    // ── Re-sync cache with server after mutation resolves ───────────────────
    // cancelQueries paused any background refetches. invalidateQueries lets
    // TanStack Query resume those and pull fresh data from the server,
    // ensuring the new resume is reflected on any other open dashboard tab.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  // ── Per-resume in-flight guard ─────────────────────────────────────────────

  const isAnyDuplicating = useIsMutating({ mutationKey: ["duplicateResume"] }) > 0;

  const isDuplicating = useCallback(
    (resumeId: string) =>
      queryClient
        .getMutationCache()
        .findAll({ mutationKey: ["duplicateResume"], status: "pending" })
        .some((m) => {
          const vars = m.state.variables as DuplicateVariables | undefined;
          return vars?.resume.id === resumeId;
        }),
    [queryClient]
  );

  /**
   * Trigger a duplicate. Generates a fresh idempotency key per click.
   * If an in-flight duplicate for the same resume is already pending, this is
   * a no-op — preventing accidental double-submits.
   */
  const duplicate = useCallback(
    (resume: SerializedResume) => {
      if (isDuplicating(resume.id)) return;
      duplicateMutation.mutate({
        resume,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    [duplicateMutation, isDuplicating]
  );

  return {
    duplicate,
    isDuplicating,
    isAnyDuplicating,
    isLoading: duplicateMutation.isPending,
  };
}
