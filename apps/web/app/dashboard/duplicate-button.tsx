"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DuplicateButton({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to duplicate" }));
        alert(err.error);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to duplicate resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#123c3a]/15 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#4b4b4b] transition hover:border-[#123c3a]/30 hover:text-[#123c3a] disabled:opacity-50"
      title="Duplicate resume"
    >
      <Copy size={14} />
      {loading ? "..." : "Copy"}
    </button>
  );
}
