"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, Edit3, EllipsisVertical, Loader2, Trash2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RenameModal } from "./rename-modal";
import { DeleteResumeModal } from "./delete-modal";

type ResumeActionsProps = {
  resumeId: string;
  resumeTitle: string;
};

export function ResumeActions({ resumeId, resumeTitle }: ResumeActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDuplicate() {
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
      setOpen(false);
    }
  }

  async function handleExport() {
    setActionLoading("export");
    try {
      const res = await fetch(`/api/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to export" }));
        toast.error(err.error);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast.success("PDF export started. Check your exports.");
      }
      router.refresh();
    } catch {
      toast.error("Failed to export resume");
    } finally {
      setActionLoading(null);
      setOpen(false);
    }
  }

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#123c3a]/10 bg-white text-[#4b4b4b] transition hover:border-[#123c3a]/30 hover:bg-[#f3f3f3] hover:text-[#123c3a]"
            title="More actions"
            aria-label="More actions"
          >
            <EllipsisVertical size={16} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            avoidCollisions
            className="z-50 min-w-[180px] origin-top-right animate-[fadeIn_0.1s_ease-out] rounded-2xl border border-[#123c3a]/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(18,60,58,0.18)]"
          >
            <DropdownMenu.Item
              onSelect={() => { setRenameOpen(true); }}
              disabled={actionLoading !== null}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
            >
              <Edit3 size={15} className="text-[#4b4b4b]" />
              Rename
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={handleDuplicate}
              disabled={actionLoading !== null}
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
              disabled={actionLoading !== null}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#123c3a] outline-none transition hover:bg-[#f3f3f3] disabled:opacity-40"
            >
              {actionLoading === "export" ? (
                <Loader2 size={15} className="animate-spin text-[#4b4b4b]" />
              ) : (
                <Download size={15} className="text-[#4b4b4b]" />
              )}
              Export PDF
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-[#123c3a]/8" />

            <DropdownMenu.Item
              onSelect={() => { setDeleteOpen(true); }}
              disabled={actionLoading !== null}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 outline-none transition hover:bg-red-50 disabled:opacity-40"
            >
              {actionLoading === "delete" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {renameOpen && (
        <RenameModal
          resumeId={resumeId}
          currentTitle={resumeTitle}
          onClose={() => setRenameOpen(false)}
          onRenamed={() => { router.refresh(); }}
        />
      )}

      {deleteOpen && (
        <DeleteResumeModal
          resumeId={resumeId}
          resumeTitle={resumeTitle}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => { router.refresh(); }}
        />
      )}
    </>
  );
}
