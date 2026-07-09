"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type RenameModalProps = {
  resumeId: string;
  currentTitle: string;
  onClose: () => void;
  onRenamed: () => void;
};

export function RenameModal({ resumeId, currentTitle, onClose, onRenamed }: RenameModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty.");
      return;
    }
    if (trimmed === currentTitle) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to rename" }));
        toast.error(err.error);
        return;
      }
      toast.success("Resume renamed.");
      onRenamed();
      onClose();
    } catch {
      toast.error("Failed to rename resume");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="w-[90vw] max-w-md rounded-[28px] border border-[#123c3a]/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-signal text-2xl font-black tracking-[-0.06em] text-[#123c3a]">
          Rename resume
        </h2>
        <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
          Give your resume a descriptive name so you can find it later.
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-[14px] border border-[#123c3a]/15 bg-white px-3 py-2.5 text-sm text-[#123c3a] shadow-sm outline-none transition placeholder:text-[#4b4b4b]/50 focus:border-[#6bbf22] focus:ring-4 focus:ring-[#b9ff66]/40"
            placeholder="e.g. Google Frontend Application"
            maxLength={120}
          />

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[#123c3a]/15 bg-white px-4 py-2 text-sm font-black text-[#123c3a] transition hover:-translate-y-0.5 hover:border-[#123c3a] hover:bg-[#b9ff66] focus:outline-none focus:ring-2 focus:ring-[#b9ff66] focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border-2 border-[#123c3a] bg-[#123c3a] px-4 py-2 text-sm font-black text-white shadow-[0_4px_0_#072f2c] transition hover:-translate-y-0.5 hover:shadow-[0_2px_0_#072f2c] focus:outline-none focus:ring-2 focus:ring-[#123c3a] focus:ring-offset-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
