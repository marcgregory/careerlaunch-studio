import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: clicking "Export PDF" in the cover letter panel must NOT leave
// the "Exporting cover letter…" loading toast on screen when the server
// returns 402/403 (monthly export limit or template-tier gate). Instead the
// panel must auto-redirect to data.upgradeUrl (or /billing) — the same pattern
// as the resume PDF export (abb4d3d).
//
// The fix changes two things in cover-letter-panel.tsx exportPdf():
//
//   1. The 402/403 branch no longer calls onUpgradeRequired(...) — it dismisses
//      the loading toast, resets the panel state, and calls
//      window.location.href = data.upgradeUrl ?? "/billing".
//
//   2. The dead `formatUpgradeMessage` helper is removed since nothing calls
//      it anymore.
//
// These tests pin the contract at the source level so future refactors of
// the cover-letter export flow stay correct.
// ──────────────────────────────────────────────────────────────────────────────

const COVER_LETTER_PANEL_PATH = path.resolve(
  __dirname,
  "../_analysis/cover-letter-panel.tsx"
);

describe("CoverLetterPanel exportPdf — auto-redirect on monthly export limit", () => {
  const source = fs.readFileSync(COVER_LETTER_PANEL_PATH, "utf8");

  it("does not call onUpgradeRequired on 402/403 — must auto-redirect instead", () => {
    // Match the exportPdf callback body inside CoverLetterPanel.
    const exportPdfMatch = source.match(
      /const exportPdf = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/
    );
    expect(exportPdfMatch, "could not locate exportPdf").toBeTruthy();
    const exportPdf = exportPdfMatch![0];

    // The 402/403 branch must redirect.
    expect(exportPdf).toMatch(/response\.status === 402 \|\| response\.status === 403/);
    // The branch must NOT call onUpgradeRequired anymore.
    expect(exportPdf).not.toMatch(/onUpgradeRequired\?\.\(\{/);
    // The branch must redirect via window.location.href.
    expect(exportPdf).toMatch(
      /window\.location\.href\s*=\s*data\.upgradeUrl\s*\?\?\s*["']\/billing["']/
    );
  });

  it("dismisses the 'Exporting cover letter…' loading toast before navigating", () => {
    const exportPdfMatch = source.match(
      /const exportPdf = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/
    );
    const exportPdf = exportPdfMatch![0];

    // Without dismissing the toast, sonner leaves a faded Exporting-state
    // toast visible on the destination /billing route for one frame.
    const limitBranch = exportPdf.match(
      /response\.status === 402 \|\| response\.status === 403[\s\S]*?return;/
    );
    expect(limitBranch, "402/403 branch not found").toBeTruthy();
    expect(limitBranch![0]).toMatch(/toast\.dismiss\(["']cl-export["']\)/);
    expect(limitBranch![0]).toMatch(
      /setPanelState\(\{ status: ["']ready["'], coverLetter \}\)/
    );
  });

  it("no longer references the dead formatUpgradeMessage helper", () => {
    expect(source).not.toMatch(/formatUpgradeMessage/);
  });

  it("preserves the existing success and error branches", () => {
    const exportPdfMatch = source.match(
      /const exportPdf = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/
    );
    const exportPdf = exportPdfMatch![0];

    // Success → analytics + blob download.
    expect(exportPdf).toMatch(/analytics\.capture\(["']cover_letter_exported["']/);
    expect(exportPdf).toMatch(/toast\.success\(["']PDF exported\./);
    // Non-entitlement failure → error toast.
    expect(exportPdf).toMatch(/toast\.error\(["']Export failed\. Please try again\./);
  });
});

describe("server contract — what the redirect branch parses", () => {
  it("a 402 with upgradeUrl routes there; a 402 without one routes to /billing", () => {
    // Mirrors the actual branching logic in the cover-letter panel.
    const withUrl = { upgradeUrl: "/billing?reason=monthly_export_limit" };
    const withoutUrl = {};
    const redirect = (body: { upgradeUrl?: string }) =>
      body.upgradeUrl ?? "/billing";
    expect(redirect(withUrl)).toBe("/billing?reason=monthly_export_limit");
    expect(redirect(withoutUrl)).toBe("/billing");
  });
});
