"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ResumeCacheData, SerializedResume } from "./resume-actions";

type DeleteResumeModalProps = {
  resumeId: string;
  resumeTitle: string;
  open: boolean;
  onClose: () => void;
};

export function DeleteResumeModal({
  resumeId,
  resumeTitle,
  open,
  onClose,
}: DeleteResumeModalProps) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useIsoLayoutEffect(() => {
    if (!open) return;

    return () => {
      // No-op cleanup. We intentionally do not lock body scroll here because
      // the modal is position: fixed and the dashboard uses a position: sticky
      // aside. Locking body overflow (via hidden, clip, or scroll lock) breaks
      // the sticky positioning of the aside, causing it to disappear behind
      // the modal. The modal is purely visual (position: fixed) and does not
      // require scroll lock to function correctly.
    };
  }, [open]);

  if (!open) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    // ── Snapshot the current cache state for rollback ───────────────────────
    // Capture both the full cache snapshot and the specific resume being removed
    // so we can restore the exact list state if the server rejects the deletion.
    const previousData = queryClient.getQueryData<ResumeCacheData>(["resumes"]);

    // Find the resume and its position within its page so we can re-insert it
    // at the correct index if we need to roll back.
    let removedResume: SerializedResume | null = null;
    let removedPageIndex = 0;
    let removedItemIndex = 0;

    if (previousData) {
      outer: for (let pi = 0; pi < previousData.pages.length; pi++) {
        const page = previousData.pages[pi];
        for (let ri = 0; ri < page.resumes.length; ri++) {
          if (page.resumes[ri].id === resumeId) {
            removedResume = page.resumes[ri];
            removedPageIndex = pi;
            removedItemIndex = ri;
            break outer;
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── Optimistic remove ────────────────────────────────────────────────────
    queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
      if (!old) return old;
      return {
        ...old,
        pageParams: old.pageParams,
        pages: old.pages.map((p, i) =>
          i === 0
            ? {
                ...p,
                resumes: p.resumes.filter((r) => r.id !== resumeId),
                pagination: {
                  ...p.pagination,
                  total: Math.max(0, p.pagination.total - 1),
                },
                stats: p.stats
                  ? {
                      ...p.stats,
                      totalResumes: Math.max(0, p.stats.totalResumes - 1),
                      targetedCount: removedResume?.targetRole
                        ? Math.max(0, p.stats.targetedCount - 1)
                        : p.stats.targetedCount,
                      analyzedCount:
                        (removedResume?.analysisRunCount ?? 0) > 0
                          ? Math.max(0, p.stats.analyzedCount - 1)
                          : p.stats.analyzedCount,
                      exportCount: Math.max(
                        0,
                        p.stats.exportCount - (removedResume?.exportCount ?? 0)
                      ),
                    }
                  : undefined,
              }
            : {
                ...p,
                resumes: p.resumes.filter((r) => r.id !== resumeId),
              }
        ),
      };
    });

    toast.success("Resume deleted.");
    onClose();
    // ────────────────────────────────────────────────────────────────────────

    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Server rejected deletion. The resume has been restored.");
      }
    } catch (err) {
      // ── Rollback ─────────────────────────────────────────────────────────
      // Re-insert the removed resume at its original position.
      if (previousData) {
        queryClient.setQueryData<ResumeCacheData>(["resumes"], previousData);
      }
      toast.error(
        err instanceof Error ? err.message : "Failed to delete resume."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <div
        className="relative z-[110] w-full max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <Trash2 size={18} aria-hidden="true" />
          </div>
          <h2 id="delete-title" className="font-signal text-2xl font-black tracking-[-0.06em] text-[#123c3a]">
            Delete resume?
          </h2>
        </div>

        <p className="mt-3 text-sm font-medium leading-relaxed text-[#4b4b4b]">
          Are you sure you want to delete &ldquo;{resumeTitle}&rdquo;? This action
          cannot be undone.
        </p>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[#123c3a]/15 bg-white px-4 py-2 text-sm font-black text-[#123c3a] transition hover:-translate-y-0.5 hover:border-[#123c3a] hover:bg-[#b9ff66] focus:outline-none focus:ring-2 focus:ring-[#b9ff66] focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border-2 border-red-600 bg-red-600 px-4 py-2 text-sm font-black text-white shadow-[0_4px_0_#b91c1c] transition hover:-translate-y-0.5 hover:shadow-[0_2px_0_#b91c1c] focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {deleting ? "Deleting..." : "Delete resume"}
          </button>
        </div>
      </div>
    </div>
  );
}
