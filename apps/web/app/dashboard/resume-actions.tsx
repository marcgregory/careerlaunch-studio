"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, Edit3, EllipsisVertical, Loader2, Trash2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { RenameModal } from "./rename-modal";

type ResumeActionsProps = {
  resumeId: string;
  resumeTitle: string;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onDeleteClick?: () => void;
  disabled?: boolean;
};

export function ResumeActions({
  resumeId,
  resumeTitle,
  menuOpen,
  onMenuOpenChange,
  onDeleteClick,
  disabled = false,
}: ResumeActionsProps) {
  const router = useRouter();
  // Fully controlled via props — no local open/close/hover state
  const open = menuOpen ?? false;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  /** Exclusive open: toggle this card's menu, closing any other */
  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuOpenChange?.(!open);
    },
    [onMenuOpenChange, open],
  );

  /** Only handle outside-click / escape close; trigger clicks are handled above */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onMenuOpenChange?.(false);
    },
    [onMenuOpenChange],
  );

  const closeMenu = useCallback(() => {
    onMenuOpenChange?.(false);
  }, [onMenuOpenChange]);

  const handleRenameSelect = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      setRenameOpen(true);
    }, 0);
  }, [closeMenu]);

  const handleDeleteSelect = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      onDeleteClick?.();
    }, 0);
  }, [closeMenu, onDeleteClick]);

  const handleDuplicate = useCallback(async () => {
    setActionLoading("duplicate");
    try {
      const res = await fetch(`/api/resumes/${resumeId}/duplicate`, {
        method: "POST",
      });
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
      closeMenu();
    }
  }, [resumeId, router, closeMenu]);

  const handleExport = useCallback(async () => {
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
            if (jsonErr.upgradeUrl) {
              errorMsg += " — Upgrade to export more.";
            }
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
      closeMenu();
    }
  }, [resumeId, resumeTitle, router, closeMenu]);

  const handleRenameClose = useCallback(() => setRenameOpen(false), []);

  const handleRenamed = useCallback(() => {
    router.refresh();
  }, [router]);

  // Memoize menu items so they don't recreate on every render
  const menuContent = useMemo(() => {
    const isLoading = actionLoading !== null;
    return (
      <DropdownMenu.Content
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        avoidCollisions
        className="z-[60] min-w-[180px] origin-top-right animate-[fadeIn_0.1s_ease-out] rounded-2xl border border-[#123c3a]/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(18,60,58,0.18)]"
      >
        <DropdownMenu.Item
          onSelect={handleRenameSelect}
          disabled={isLoading}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
        >
          <Edit3 size={15} className="text-[#4b4b4b]" />
          Rename
        </DropdownMenu.Item>

        <DropdownMenu.Item
          onSelect={handleDuplicate}
          disabled={isLoading}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
        >
          {actionLoading === "duplicate" ? (
            <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
          ) : (
            <Copy size={15} className="text-[#4b4b4b]" />
          )}
          Duplicate
        </DropdownMenu.Item>

        <DropdownMenu.Item
          onSelect={handleExport}
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
        </DropdownMenu.Item>

        <DropdownMenu.Separator className="my-1 h-px bg-[#123c3a]/8" />

        <DropdownMenu.Item
          onSelect={handleDeleteSelect}
          disabled={isLoading}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 outline-none transition hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 size={15} />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    );
  }, [
    actionLoading,
    handleRenameSelect,
    handleDuplicate,
    handleExport,
    handleDeleteSelect,
  ]);

  return (
    <>
      <DropdownMenu.Root open={disabled ? false : open} onOpenChange={handleOpenChange}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            onClick={handleTriggerClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition-colors hover:border-[#123c3a]/30 hover:bg-[#f3f3f3] hover:text-[#123c3a]"
            title="More actions"
            aria-label="More actions"
          >
            <EllipsisVertical size={16} />
          </button>
        </DropdownMenu.Trigger>

        {!disabled && menuContent}
      </DropdownMenu.Root>

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
