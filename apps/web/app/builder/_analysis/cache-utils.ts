import type { QueryClient } from "@tanstack/react-query";
import type { ResumeCacheData } from "../../dashboard/resume-actions";

/**
 * Synchronously updates the TanStack Query cache for ["resumes"] whenever
 * an analysis run completes for a resume.
 *
 * Increments `analysisRunCount` for the targeted resume and updates
 * `analyzedCount` in workspace stats if this resume was previously unanalyzed.
 *
 * Ensures returning to /dashboard immediately displays the completed analysis
 * status without waiting for network refetch or showing stale UI state.
 */
export function syncAnalysisInDashboardCache(
  queryClient: QueryClient,
  resumeId: string,
) {
  queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
    if (!old) return old;

    let wasUnanalyzed = false;

    const newPages = old.pages.map((page) => ({
      ...page,
      resumes: page.resumes.map((r) => {
        if (r.id === resumeId) {
          if ((r.analysisRunCount ?? 0) === 0) {
            wasUnanalyzed = true;
          }
          return {
            ...r,
            analysisRunCount: (r.analysisRunCount ?? 0) + 1,
          };
        }
        return r;
      }),
    }));

    if (wasUnanalyzed && newPages[0]?.stats) {
      newPages[0] = {
        ...newPages[0],
        stats: {
          ...newPages[0].stats,
          analyzedCount: (newPages[0].stats.analyzedCount ?? 0) + 1,
        },
      };
    }

    return {
      ...old,
      pages: newPages,
    };
  });
}
