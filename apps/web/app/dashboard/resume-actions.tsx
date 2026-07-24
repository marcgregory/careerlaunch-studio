"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, Edit3, EllipsisVertical, Loader2, Trash2, Copy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDuplicateResume } from "./use-duplicate-resume";

export type ResumeCacheData = {
  pages: Array<{ resumes: SerializedResume[]; pagination: { page: number; limit: number; total: number; hasMore: boolean } }>;
  pageParams: number[];
};

export type SerializedResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: string;
  analysisRunCount: number;
  exportCount: number;
};

type ResumeActionsProps = {
  resume: SerializedResume;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
};


export function ResumeActions({
  resume,
  isMenuOpen,
  onMenuOpenChange,
  onRenameClick,
  onDeleteClick,
}: ResumeActionsProps) {
  const { duplicate, isDuplicating } = useDuplicateResume();
  const isCurrentlyDuplicating = isDuplicating(resume.id);

  // Optimistic cards (id starts with "optimistic-") haven't been committed
  // to the server yet. Rename/Delete must be blocked until the real ID arrives,
  // otherwise those API calls hit /api/resumes/optimistic-xxxx → 404.
  const isOptimistic = resume.id.startsWith("optimistic-");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRenameSelect = useCallback(() => {
    onMenuOpenChange(false);
    onRenameClick();
  }, [onMenuOpenChange, onRenameClick]);

  const handleDeleteSelect = useCallback(() => {
    onMenuOpenChange(false);
    requestAnimationFrame(() => onDeleteClick());
  }, [onMenuOpenChange, onDeleteClick]);

  const handleDuplicate = useCallback(() => {
    onMenuOpenChange(false);
    duplicate(resume);
  }, [onMenuOpenChange, duplicate, resume]);

  const handleExport = useCallback(async () => {
    onMenuOpenChange(false);
    setActionLoading("export");
    try {
      const res = await fetch(`/api/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id }),
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
          ?.match(/filename="?(.+?)"\s*$/)?.[1]
          ?.replace(/^"|"$/g, "") ?? `${resume.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully.");
    } catch {
      toast.error("Failed to export resume");
    } finally {
      setActionLoading(null);
    }
  }, [resume.id, resume.title, onMenuOpenChange]);

  const menuContent = useMemo(() => {
    // Only block menu actions when this card itself has a pending export/action.
    // isCurrentlyDuplicating (source card in flight) is intentionally excluded:
    // it only needs to block the Duplicate item itself, not the whole menu.
    const isLoading = actionLoading !== null;
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions
          className="z-[999] min-w-[180px] origin-top-right animate-[fadeIn_0.1s_ease-out] rounded-2xl border border-[#123c3a]/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(18,60,58,0.18)]"
        >
          {/* Rename — disabled while this card is still an optimistic placeholder */}
          <DropdownMenu.Item
            onSelect={handleRenameSelect}
            disabled={isLoading || isOptimistic}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isOptimistic ? (
              <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
            ) : (
              <Edit3 size={15} className="text-[#4b4b4b]" />
            )}
            {isOptimistic ? "Saving…" : "Rename"}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={handleDuplicate}
            disabled={isLoading || isOptimistic || isCurrentlyDuplicating}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCurrentlyDuplicating ? (
              <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
            ) : (
              <Copy size={15} className="text-[#4b4b4b]" />
            )}
            Duplicate
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={handleExport}
            disabled={isLoading || isOptimistic}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* Delete — disabled while this card is still an optimistic placeholder */}
          <DropdownMenu.Item
            onSelect={handleDeleteSelect}
            disabled={isLoading || isOptimistic}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 outline-none transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={15} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    );
  }, [
    actionLoading,
    isOptimistic,
    isCurrentlyDuplicating,
    handleRenameSelect,
    handleDuplicate,
    handleExport,
    handleDeleteSelect,
  ]);

  return (
    <>
      <DropdownMenu.Root open={isMenuOpen} onOpenChange={onMenuOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition-colors hover:border-[#123c3a]/30 hover:bg-[#f3f3f3] hover:text-[#123c3a]"
            title={isOptimistic ? "Saving duplicate…" : "More actions"}
            aria-label={isOptimistic ? "Saving duplicate…" : "More actions"}
          >
            {isOptimistic || actionLoading === "export" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <EllipsisVertical size={16} />
            )}
          </button>
        </DropdownMenu.Trigger>
        {isMenuOpen ? menuContent : null}
      </DropdownMenu.Root>
    </>
  );
}
