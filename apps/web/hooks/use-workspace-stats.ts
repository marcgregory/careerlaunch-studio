"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ResumeCacheData } from "../app/dashboard/resume-actions";

export type WorkspaceStats = {
  totalResumes: number;
  targetedCount: number;
  analyzedCount: number;
  exportCount: number;
};

/**
 * Derives workspace stats directly from the ["resumes"] TanStack Query cache
 * using React's useSyncExternalStore.
 *
 * Zero network requests, zero duplicate observers, zero loading delays.
 * Updates instantly (0ms) whenever setQueryData or cache mutations occur.
 */
export function useWorkspaceStats(ssrFallback: WorkspaceStats): WorkspaceStats {
  const queryClient = useQueryClient();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return queryClient.getQueryCache().subscribe(onStoreChange);
    },
    [queryClient]
  );

  const getSnapshot = useCallback(
    () => queryClient.getQueryData<ResumeCacheData>(["resumes"]),
    [queryClient]
  );

  const cacheData = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo<WorkspaceStats>(() => {
    if (!cacheData?.pages || cacheData.pages.length === 0) return ssrFallback;

    const serverStats = cacheData.pages[0]?.stats;
    if (serverStats) {
      return serverStats;
    }

    const allResumes = cacheData.pages.flatMap((p) => p.resumes);
    const totalFromPagination = cacheData.pages[0]?.pagination?.total;
    const totalResumes =
      typeof totalFromPagination === "number" && totalFromPagination > 0
        ? totalFromPagination
        : allResumes.length > 0
        ? allResumes.length
        : ssrFallback.totalResumes;

    return {
      totalResumes,
      targetedCount: Math.max(ssrFallback.targetedCount, allResumes.filter((r) => !!r.targetRole).length),
      analyzedCount: Math.max(ssrFallback.analyzedCount, allResumes.filter((r) => r.analysisRunCount > 0).length),
      exportCount: Math.max(ssrFallback.exportCount, allResumes.reduce((sum, r) => sum + (r.exportCount ?? 0), 0)),
    };
  }, [cacheData, ssrFallback]);
}
