"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ResumeCacheData, SerializedResume } from "./resume-actions";

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
              pagination: {
                ...p.pagination,
                total: p.pagination.total + 1,
              },
            }
          : p
      ),
    };
  });
}

type DuplicateContext = {
  toastId: string | number;
  resume: SerializedResume;
};

export function useDuplicateResume() {
  const queryClient = useQueryClient();

  const duplicateMutation = useMutation<
    SerializedResume,
    Error,
    SerializedResume,
    DuplicateContext
  >({
    mutationKey: ["duplicateResume"],
    mutationFn: async (resume: SerializedResume) => {
      const res = await fetch(`/api/resumes/${resume.id}/duplicate`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to duplicate" }));
        throw new Error(err.error || "Failed to duplicate resume");
      }

      const data = await res.json();
      const duped: SerializedResume = {
        id: data.resume.id,
        title: data.resume.title,
        targetRole: data.resume.targetRole ?? null,
        updatedAt: new Date().toISOString(),
        analysisRunCount: 0,
        exportCount: 0,
      };

      return duped;
    },
    onMutate: (resume: SerializedResume) => {
      const toastId = toast.loading(`Duplicating "${resume.title}"...`);
      return { toastId, resume };
    },
    onSuccess: (dupedResume, _variables, context) => {
      optimisticallyAddResume(queryClient, dupedResume);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });

      if (context?.toastId) {
        toast.success("Resume duplicated successfully.", {
          id: context.toastId,
        });
      } else {
        toast.success("Resume duplicated successfully.");
      }
    },
    onError: (err, _variables, context) => {
      const isCanceled =
        err.name === "AbortError" ||
        err.message.toLowerCase().includes("cancel") ||
        err.message.toLowerCase().includes("aborted");

      const resumeToRetry = context?.resume;
      const actionButton = resumeToRetry
        ? {
            label: "Duplicate Again",
            onClick: () => duplicateMutation.mutate(resumeToRetry),
          }
        : undefined;

      const message = isCanceled
        ? "Duplication was canceled because the operation was interrupted."
        : err.message || "Failed to duplicate resume. Please try again.";

      if (context?.toastId) {
        toast.error(message, {
          id: context.toastId,
          action: actionButton,
        });
      } else {
        toast.error(message, { action: actionButton });
      }
    },
  });

  const isAnyDuplicating = useIsMutating({ mutationKey: ["duplicateResume"] }) > 0;

  const isDuplicating = useCallback(
    (resumeId: string) => {
      // Check if there is an active mutation for this specific resume ID
      return (
        queryClient
          .getMutationCache()
          .findAll({ mutationKey: ["duplicateResume"], status: "pending" })
          .some((m) => {
            const vars = m.state.variables as SerializedResume | undefined;
            return vars?.id === resumeId;
          })
      );
    },
    [queryClient]
  );

  const duplicate = useCallback(
    (resume: SerializedResume) => {
      if (isDuplicating(resume.id)) return;
      duplicateMutation.mutate(resume);
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
