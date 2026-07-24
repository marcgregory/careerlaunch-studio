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
    if (!cacheData?.pages) return ssrFallback;

    const allResumes = cacheData.pages.flatMap((p) => p.resumes);
    return {
      totalResumes: cacheData.pages[0]?.pagination.total ?? allResumes.length,
      targetedCount: allResumes.filter((r) => !!r.targetRole).length,
      analyzedCount: allResumes.filter((r) => r.analysisRunCount > 0).length,
      exportCount: allResumes.reduce((sum, r) => sum + (r.exportCount ?? 0), 0),
    };
  }, [cacheData, ssrFallback]);
}
