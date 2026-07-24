"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ResumeCacheData, SerializedResume } from "./resume-actions";

// ─── Cache helpers ────────────────────────────────────────────────────────────

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
            }
          : p
      ),
    };
  });
}

function replaceOrRemoveOptimisticResume(
  queryClient: ReturnType<typeof useQueryClient>,
  optimisticId: string,
  replacement: SerializedResume | null
) {
  queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
    if (!old) return old;
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
  optimisticId: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
        const err = await res.json().catch(() => ({ error: "Failed to duplicate" }));
        throw new Error(err.error || "Failed to duplicate resume");
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

    // ── Optimistic insert on click, not on server response ──────────────────
    onMutate: ({ resume, idempotencyKey }) => {
      const optimisticId = `optimistic-${idempotencyKey}`;
      const optimisticResume: SerializedResume = {
        id: optimisticId,
        title: `Copy of ${resume.title}`,
        targetRole: resume.targetRole,
        updatedAt: new Date().toISOString(),
        analysisRunCount: 0,
        exportCount: 0,
      };
      optimisticallyAddResume(queryClient, optimisticResume);
      const toastId = toast.loading(`Duplicating "${resume.title}"...`);
      return { toastId, optimisticId };
    },

    // ── Swap optimistic placeholder → real resume ────────────────────────────
    onSuccess: (dupedResume, _variables, context) => {
      if (context) {
        replaceOrRemoveOptimisticResume(queryClient, context.optimisticId, dupedResume);
      }
      // Background revalidation keeps cache consistent with server state
      queryClient.invalidateQueries({ queryKey: ["resumes"] });

      toast.success("Resume duplicated successfully.", {
        id: context?.toastId,
      });
    },

    // ── Roll back optimistic insert; offer safe retry ────────────────────────
    onError: (err, variables, context) => {
      // Remove the optimistic card so the list doesn't show a ghost entry
      if (context) {
        replaceOrRemoveOptimisticResume(queryClient, context.optimisticId, null);
      }

      // "Duplicate Again" reuses the SAME idempotency key from variables.
      // If the server actually succeeded (response was lost in transit), the
      // server returns the already-created copy rather than creating a second.
      const actionButton = {
        label: "Duplicate Again",
        onClick: () =>
          duplicateMutation.mutate({
            resume: variables.resume,
            idempotencyKey: variables.idempotencyKey,
          }),
      };

      toast.error(err.message || "Failed to duplicate resume. Please try again.", {
        id: context?.toastId,
        action: actionButton,
      });
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
