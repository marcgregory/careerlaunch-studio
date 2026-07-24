"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ResumeCacheData } from "../app/dashboard/resume-actions";

const PAGE_SIZE = 10;

async function fetchResumesPage(page: number) {
  const res = await fetch(`/api/resumes?page=${page}&limit=${PAGE_SIZE}`);
  if (!res.ok) throw new Error("Failed to load resumes");
  return res.json();
}

export type WorkspaceStats = {
  totalResumes: number;
  targetedCount: number;
  analyzedCount: number;
  exportCount: number;
};

/**
 * Derives workspace stats directly from the ["resumes"] TanStack Query cache
 * that ResumeList already owns. No extra network request is issued.
 *
 * Falls back to SSR-provided initial values on first render so the sidebar is
 * never blank. Updates reactively after every Rename, Delete, or Duplicate.
 */
export function useWorkspaceStats(ssrFallback: WorkspaceStats): WorkspaceStats {
  // Select:true means we only subscribe to the query — we do NOT trigger a
  // fetch here. The query is already owned and fetched by ResumeList.
  const { data } = useInfiniteQuery<
    ResumeCacheData["pages"][number],
    Error,
    ResumeCacheData,
    string[],
    number
  >({
    queryKey: ["resumes"],
    queryFn: ({ pageParam }) => fetchResumesPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    // Never refetch from this hook — ResumeList manages the lifecycle.
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return useMemo<WorkspaceStats>(() => {
    if (!data?.pages) return ssrFallback;

    const allResumes = data.pages.flatMap((p) => p.resumes);
    if (allResumes.length === 0) return ssrFallback;

    return {
      totalResumes: data.pages[0]?.pagination.total ?? allResumes.length,
      targetedCount: allResumes.filter((r) => !!r.targetRole).length,
      analyzedCount: allResumes.filter((r) => r.analysisRunCount > 0).length,
      exportCount: allResumes.reduce((sum, r) => sum + (r.exportCount ?? 0), 0),
    };
  }, [data, ssrFallback]);
}
