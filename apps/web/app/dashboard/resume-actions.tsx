"use client";

import { Download, Edit3, EllipsisVertical, Loader2, Trash2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { RenameModal } from "./rename-modal";

type ResumeActionsProps = {
  resumeId: string;
  resumeTitle: string;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onDeleteClick: () => void;
};

/**
 * ResumeActions renders ONLY a plain trigger button.
 * The actual DropdownMenu is rendered globally by ResumeList
 * so there is exactly ONE Radix Root in the entire DOM at any time.
 *
 * This eliminates the root cause: multiple Radix Roots competing
 * with each other's document-level outside-click listeners.
 */
export function ResumeActions({
  resumeId,
  resumeTitle,
  isMenuOpen,
  onMenuOpenChange,
  onDeleteClick,
}: ResumeActionsProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuOpenChange(true);
    },
    [onMenuOpenChange],
  );

  const handleRenameSelect = useCallback(() => {
    onMenuOpenChange(false);
    setTimeout(() => setRenameOpen(true), 0);
  }, [onMenuOpenChange]);

  const handleDeleteSelect = useCallback(() => {
    onMenuOpenChange(false);
    requestAnimationFrame(() => onDeleteClick());
  }, [onMenuOpenChange, onDeleteClick]);

  const handleDuplicate = useCallback(async () => {
    onMenuOpenChange(false);
    setActionLoading("duplicate");
    try {
      const res = await fetch(`/api/resumes/${resumeId}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to duplicate" }));
        toast.error(err.error);
        return;
      }
      toast.success("Resume duplicated successfully.");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate resume");
    } finally {
      setActionLoading(null);
    }
  }, [resumeId, router, onMenuOpenChange]);

  const handleExport = useCallback(async () => {
    onMenuOpenChange(false);
    setActionLoading("export");
    try {
      const res = await fetch(`/api/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });

      if (!res.ok) {
        let errorMsg = "Failed to export resume";
        try {
          const cloned = res.clone();
          const jsonErr = await cloned.json().catch(() => null);
          if (jsonErr?.error) {
            errorMsg = jsonErr.error;
            if (jsonErr.upgradeUrl) errorMsg += " — Upgrade to export more.";
          }
        } catch {
          const textErr = await res.text().catch(() => null);
          if (textErr) errorMsg = textErr;
        }
        toast.error(errorMsg);
        return;
      }

      const blob = await res.blob();
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?(.+?)"?\s*$/)?.[1]
          ?.replace(/^"|"$/g, "") ?? `${resumeTitle.replace(/[^a-z0-9]/gi, "-")}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully.");
      router.refresh();
    } catch {
      toast.error("Failed to export resume");
    } finally {
      setActionLoading(null);
    }
  }, [resumeId, resumeTitle, router, onMenuOpenChange]);

  const handleRenameClose = useCallback(() => setRenameOpen(false), []);
  const handleRenamed = useCallback(() => router.refresh(), [router]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        data-resume-actions-trigger-for={resumeId}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition-colors hover:border-[#123c3a]/30 hover:bg-[#f3f3f3] hover:text-[#123c3a]"
        title="More actions"
        aria-label="More actions"
      >
        {actionLoading === "duplicate" || actionLoading === "export" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <EllipsisVertical size={16} />
        )}
      </button>

      {renameOpen && (
        <RenameModal
          resumeId={resumeId}
          currentTitle={resumeTitle}
          onClose={handleRenameClose}
          onRenamed={handleRenamed}
        />
      )}
    </>
  );
}
