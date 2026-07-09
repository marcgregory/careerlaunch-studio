"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type DeleteResumeModalProps = {
  resumeId: string;
  resumeTitle: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteResumeModal({
  resumeId,
  resumeTitle,
  open,
  onClose,
  onDeleted,
}: DeleteResumeModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = String(scrollbarWidth) + "px";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  if (!open) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete resume" }));
        setError(err.error ?? "Failed to delete resume");
        return;
      }
      toast.success("Resume deleted.");
      onDeleted();
      onClose();
    } catch {
      setError("Failed to delete resume");
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
