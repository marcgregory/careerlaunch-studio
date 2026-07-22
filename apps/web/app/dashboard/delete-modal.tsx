"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ResumeCacheData } from "./resume-actions";

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
    console.log('[DeleteModal] open changed:', { open, scrollY: window.scrollY, innerHeight: window.innerHeight, scrollHeight: document.documentElement.scrollHeight });
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    console.log('[DeleteModal] body locked. scrollY before lock:', window.scrollY);

    // Snapshot aside rect
    const asideEl = document.querySelector('aside');
    if (asideEl) {
      const r = asideEl.getBoundingClientRect();
      console.log('[DeleteModal] ASIDE before lock:', { top: r.top, left: r.left, width: r.width, height: r.height, position: getComputedStyle(asideEl).position, zIndex: getComputedStyle(asideEl).zIndex });
    }

    // Sample aside rect 5 times over 250ms
    const asideSample = setInterval(() => {
      const a = document.querySelector('aside');
      if (a) {
        const r = a.getBoundingClientRect();
        console.log('[ASIDE sample]', { top: r.top.toFixed(1), left: r.left.toFixed(1), width: r.width.toFixed(1), scrollY: window.scrollY });
      } else {
        console.log('[ASIDE sample] NOT FOUND');
      }
    }, 50);

    return () => {
      clearInterval(asideSample);
      const asideEl2 = document.querySelector('aside');
      if (asideEl2) {
        const r = asideEl2.getBoundingClientRect();
        console.log('[DeleteModal] ASIDE after unlock:', { top: r.top, left: r.left, width: r.width, height: r.height });
      }
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      console.log('[DeleteModal] body unlocked. scrollY after unlock:', window.scrollY);
    };
  }, [open]);

  if (!open) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    // Optimistic remove from cache
    queryClient.setQueryData<ResumeCacheData>(["resumes"], (old) => {
      if (!old) return old;
      return {
        ...old,
        pageParams: old.pageParams,
        pages: old.pages.map((p) => ({
          ...p,
          resumes: p.resumes.filter((r) => r.id !== resumeId),
        })),
      };
    });

    toast.success("Resume deleted.");
    onClose();

    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete from server. Reverting...");
      }
      // Background revalidate
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    } catch {
      toast.error("Failed to delete from server");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm sm:p-6">
      <div
        className="relative z-[110] w-full max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <Trash2 size={18} />
          </div>
          <h2 className="font-signal text-2xl font-black tracking-[-0.06em] text-[#123c3a]">
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
