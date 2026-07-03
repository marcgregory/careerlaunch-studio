"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  Download,
  Save,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { CoverLetterDocument } from "@careerlaunch/domain";

type PanelState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "ready"; coverLetter: CoverLetterDocument }
  | { status: "saving" }
  | { status: "exporting" }
  | { status: "error"; error: string };

interface CoverLetterPanelProps {
  resumeId: string;
}

export function CoverLetterPanel({ resumeId }: CoverLetterPanelProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [panelState, setPanelState] = useState<PanelState>({ status: "idle" });
  const [coverLetter, setCoverLetter] = useState<CoverLetterDocument | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSalutation, setEditSalutation] = useState("");
  const [editClosing, setEditClosing] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Load existing cover letter on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/resumes/${resumeId}/cover-letter`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.coverLetter) {
          const cl = data.coverLetter as CoverLetterDocument;
          setCoverLetter(cl);
          setEditBody(cl.body);
          setEditSalutation(cl.salutation);
          setEditClosing(cl.closing);
          setRecipientName(cl.recipientName);
          setRecipientTitle(cl.recipientTitle);
          setCompanyName(cl.companyName);
          setCompanyAddress(cl.companyAddress);
          setPanelState({ status: "ready", coverLetter: cl });
        }
      })
      .catch(() => { /* silent — user sees idle state */ });
    return () => { cancelled = true; };
  }, [resumeId]);

  // ── Generate draft ────────────────────────────────────────────
  const generateDraft = useCallback(async () => {
    setPanelState({ status: "generating" });

    try {
      const response = await fetch(`/api/resumes/${resumeId}/cover-letter/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim() || undefined }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }

      const data = await response.json();
      const cl = data.coverLetter as CoverLetterDocument;
      setCoverLetter(cl);
      setEditBody(cl.body);
      setEditSalutation(cl.salutation);
      setEditClosing(cl.closing);
      setRecipientName(cl.recipientName);
      setRecipientTitle(cl.recipientTitle);
      setCompanyName(cl.companyName);
      setCompanyAddress(cl.companyAddress);
      setPanelState({ status: "ready", coverLetter: cl });
    } catch (error) {
      setPanelState({
        status: "error",
        error: error instanceof Error ? error.message : "Generation failed",
      });
    }
  }, [resumeId, jobDescription]);

  // ── Save ──────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    setPanelState((prev) => ({ ...prev, status: "saving" as const }));

    try {
      const payload: Partial<CoverLetterDocument> = {
        id: coverLetter?.id ?? undefined,
        body: editBody,
        salutation: editSalutation,
        closing: editClosing,
        recipientName,
        recipientTitle,
        companyName,
        companyAddress,
        jobDescription,
      };

      const response = await fetch(`/api/resumes/${resumeId}/cover-letter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }

      const data = await response.json();
      const cl = data.coverLetter as CoverLetterDocument;
      setCoverLetter(cl);
      setPanelState({ status: "ready", coverLetter: cl });
    } catch (error) {
      setPanelState({
        status: "error",
        error: error instanceof Error ? error.message : "Save failed",
      });
    }
  }, [
    resumeId,
    coverLetter?.id,
    editBody,
    editSalutation,
    editClosing,
    recipientName,
    recipientTitle,
    companyName,
    companyAddress,
    jobDescription,
  ]);

  // ── Export PDF ────────────────────────────────────────────────
  const exportPdf = useCallback(async () => {
    if (!coverLetter?.id) return;
    setPanelState({ status: "exporting" });

    try {
      const response = await fetch("/api/export/cover-letter-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetterId: coverLetter.id }),
      });

      if (!response.ok) throw new Error("PDF export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cover-letter.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setPanelState({ status: "ready", coverLetter });
    } catch (error) {
      setPanelState({
        status: "error",
        error: error instanceof Error ? error.message : "Export failed",
      });
    }
  }, [coverLetter]);

  // ── Reset to idle ──────────────────────────────────────────────
  function resetToIdle() {
    setPanelState({ status: "idle" });
    setCoverLetter(null);
    setEditBody("");
  }

  // ── Render: idle state ────────────────────────────────────────
  if (panelState.status === "idle") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#e8f5e9]">
            <FileText size={26} className="text-[#00796f]" />
          </div>
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Cover Letter
            </h2>
            <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-[#4b4b4b]">
              Generate a cover letter draft from your resume. Optionally paste a job description for a tailored version.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Optional: Paste job description for a tailored cover letter..."
            rows={4}
            className="w-full resize-none rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-4 text-sm leading-relaxed placeholder:text-[#4b4b4b]/40 focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
          <button
            type="button"
            onClick={generateDraft}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#123c3a] bg-[#123c3a] px-6 font-black text-white transition hover:bg-[#1a5550]"
          >
            <Sparkles size={18} /> Generate Draft
          </button>
        </div>
      </section>
    );
  }

  // ── Render: generating state ──────────────────────────────────
  if (panelState.status === "generating") {
    return (
      <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 size={28} className="animate-spin text-[#123c3a]" />
          <div>
            <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
              Drafting your cover letter
            </h2>
            <p className="mt-1 text-sm font-medium text-[#4b4b4b]">
              Generating content from your resume...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: error state ───────────────────────────────────────
  if (panelState.status === "error") {
    return (
      <section className="rounded-[30px] border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <AlertCircle size={24} className="text-red-600" />
          <div>
            <h2 className="font-signal text-lg font-black tracking-[-0.04em] text-red-800">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm font-medium text-red-700">{panelState.error}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetToIdle}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 text-xs font-black text-red-800 transition hover:bg-red-100"
            >
              Start Over
            </button>
            {coverLetter && (
              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#123c3a]/10 bg-white px-4 text-xs font-black text-[#123c3a] transition hover:bg-[#b9ff66]"
              >
                Retry Save
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Render: ready / saving / exporting ────────────────────────
  const isSaving = panelState.status === "saving";
  const isExporting = panelState.status === "exporting";

  return (
    <section className="rounded-[30px] border border-[#123c3a]/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-signal text-xl font-black tracking-[-0.05em]">
          Cover Letter
        </h2>
        <button
          type="button"
          onClick={resetToIdle}
          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#123c3a]/10 bg-white px-3 text-xs font-black text-[#4b4b4b] transition hover:bg-[#b9ff66]"
        >
          <RefreshCw size={14} /> Regenerate
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {/* Recipient fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
              Recipient name
            </label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Jane Smith"
              className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
              Recipient title
            </label>
            <input
              value={recipientTitle}
              onChange={(e) => setRecipientTitle(e.target.value)}
              placeholder="Hiring Manager"
              className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
              Company
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
              Company address
            </label>
            <input
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
            />
          </div>
        </div>

        {/* Salutation */}
        <div>
          <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
            Salutation
          </label>
          <input
            value={editSalutation}
            onChange={(e) => setEditSalutation(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
            Body
          </label>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={14}
            className="mt-1 w-full resize-y rounded-2xl border border-[#123c3a]/10 bg-[#f8f8f5] p-4 text-sm leading-relaxed focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
        </div>

        {/* Closing */}
        <div>
          <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#4b4b4b]">
            Closing
          </label>
          <input
            value={editClosing}
            onChange={(e) => setEditClosing(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#123c3a]/10 bg-[#f8f8f5] px-3 py-2 text-sm focus:border-[#00796f] focus:outline-none focus:ring-1 focus:ring-[#00796f]"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={saveDraft}
            disabled={isSaving}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#123c3a] bg-[#123c3a] px-4 font-black text-white transition hover:bg-[#1a5550] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={isExporting || !coverLetter?.id}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#123c3a]/10 bg-white px-4 font-black text-[#123c3a] transition hover:bg-[#b9ff66] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>

        {isSaving && (
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#00796f]">
            <Loader2 size={14} className="animate-spin" />
            Saving draft...
          </div>
        )}

        {coverLetter && panelState.status === "ready" && (
          <div className="flex items-center justify-center gap-2 pt-1 text-xs font-medium text-[#4b4b4b]">
            <CheckCircle2 size={12} className="text-[#00796f]" />
            Draft saved
          </div>
        )}
      </div>
    </section>
  );
}
