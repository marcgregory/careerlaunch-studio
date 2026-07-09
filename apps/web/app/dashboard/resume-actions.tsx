"use client";

import { Download, Edit3, EllipsisVertical, Loader2, Trash2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RenameModal } from "./rename-modal";

type ResumeActionsProps = {
  resumeId: string;
  resumeTitle: string;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onDeleteClick: () => void;
};

type MenuPos = { top: number; right: number } | null;

export function ResumeActions({
  resumeId,
  resumeTitle,
  isMenuOpen,
  onMenuOpenChange,
  onDeleteClick,
}: ResumeActionsProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  // Position the menu when it opens
  useEffect(() => {
    if (!isMenuOpen) {
      setMenuPos(null);
      return;
    }
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, [isMenuOpen]);

  // Global mousedown outside-click (uses mousedown, not pointerdown, so it
  // stays within the same click event and avoids the Radix cross-event race)
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onMenuOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMenuOpen, onMenuOpenChange]);

  // Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMenuOpen, onMenuOpenChange]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuOpenChange(!isMenuOpen);
    },
    [onMenuOpenChange, isMenuOpen],
  );

  const handleRename = useCallback(() => {
    onMenuOpenChange(false);
    setTimeout(() => setRenameOpen(true), 0);
  }, [onMenuOpenChange]);

  const handleDelete = useCallback(() => {
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

  const isLoading = actionLoading !== null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition-colors hover:border-[#123c3a]/30 hover:bg-[#f3f3f3] hover:text-[#123c3a]"
        title="More actions"
        aria-label="More actions"
        aria-expanded={isMenuOpen}
      >
        {actionLoading === "duplicate" || actionLoading === "export" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <EllipsisVertical size={16} />
        )}
      </button>

      {isMenuOpen && menuPos && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[180px] origin-top-right animate-[fadeIn_0.1s_ease-out] rounded-2xl border border-[#123c3a]/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(18,60,58,0.18)]"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleRename}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
          >
            <Edit3 size={15} className="text-[#4b4b4b]" />
            Rename
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleDuplicate}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
          >
            {actionLoading === "duplicate" ? (
              <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
            ) : (
              <Copy size={15} className="text-[#4b4b4b]" />
            )}
            Duplicate
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleExport}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
          >
            {actionLoading === "export" ? (
              <>
                <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={15} className="text-[#4b4b4b]" />
                Export PDF
              </>
            )}
          </button>

          <div className="my-1 h-px bg-[#123c3a]/8" />

          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 outline-none transition hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      )}

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
