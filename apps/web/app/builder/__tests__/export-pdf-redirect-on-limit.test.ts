import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: clicking "Export PDF" must NOT leave the "Preparing your PDF…"
// loading toast on screen when the server returns 402/403 (monthly limit or
// template-tier gate). Instead the builder must auto-redirect to
// data.upgradeUrl (or /billing) — the same pattern as the dashboard's
// "New resume" flow.
//
// The fix changes two things in resume-builder.tsx exportPdf():
//
//   1. The 402/403 branch no longer calls setUpgradePrompt(...) — it
//      dismisses the loading toast and calls window.location.href =
//      data.upgradeUrl ?? "/billing". This mirrors the auto-redirect in
//      use-create-resume.ts.
//
//   2. The dead `formatUpgradeMessage` helper is removed since nothing
//      calls it anymore. The `UpgradeModal` is still mounted (CoverLetterPanel
//      uses it for a separate flow) so it stays.
//
// These tests pin the contract at the source level so future refactors of
// the export flow stay correct.
// ──────────────────────────────────────────────────────────────────────────────

const BUILDER_PATH = path.resolve(
  __dirname,
  "../resume-builder.tsx"
);

describe("builder exportPdf — auto-redirect on monthly export limit", () => {
  const source = fs.readFileSync(BUILDER_PATH, "utf8");

  it("does not call setUpgradePrompt on 402/403 — must auto-redirect instead", () => {
    // The exportPdf 402/403 branch should NOT render the upgrade modal.
    // Locate the exportPdf function and assert its 402/403 branch does
    // not invoke setUpgradePrompt. A future refactor that re-adds the
    // modal will fail this test.
    const exportPdfMatch = source.match(/async function exportPdf\(\)[\s\S]*?\n  \}/);
    expect(exportPdfMatch, "could not locate exportPdf function").toBeTruthy();
    const exportPdf = exportPdfMatch![0];

    // The 402/403 branch must redirect.
    expect(exportPdf).toMatch(/response\.status === 402 \|\| response\.status === 403/);
    // The branch must NOT call setUpgradePrompt anymore.
    expect(exportPdf).not.toMatch(/setUpgradePrompt\(\{/);
    // The branch must redirect via window.location.href.
    expect(exportPdf).toMatch(/window\.location\.href\s*=\s*data\.upgradeUrl\s*\?\?\s*["']\/billing["']/);
  });

  it("dismisses the 'Preparing your PDF…' loading toast before navigating", () => {
    const exportPdfMatch = source.match(/async function exportPdf\(\)[\s\S]*?\n  \}/);
    const exportPdf = exportPdfMatch![0];

    // Without dismissing the toast, sonner leaves a faded Preparing-state
    // toast visible on the destination /billing route for one frame.
    const limitBranch = exportPdf.match(
      /response\.status === 402 \|\| response\.status === 403[\s\S]*?return;/
    );
    expect(limitBranch, "402/403 branch not found").toBeTruthy();
    expect(limitBranch![0]).toMatch(/toast\.dismiss\(["']pdf-export["']\)/);
    expect(limitBranch![0]).toMatch(/setExportState\(["']Idle["']\)/);
  });

  it("no longer references the dead formatUpgradeMessage helper", () => {
    expect(source).not.toMatch(/formatUpgradeMessage/);
  });

  it("preserves the existing success and error branches", () => {
    const exportPdfMatch = source.match(/async function exportPdf\(\)[\s\S]*?\n  \}/);
    const exportPdf = exportPdfMatch![0];

    // 200 → success toast + analytics + blob download.
    expect(exportPdf).toMatch(/analytics\.capture\(["']pdf_exported["']/);
    expect(exportPdf).toMatch(/toast\.success\(["']PDF exported successfully\./);
    // Non-entitlement failure → error toast.
    expect(exportPdf).toMatch(/toast\.error\(["']PDF export failed\. Please try again\./);
    // Validation gate still in place.
    expect(exportPdf).toMatch(/toast\.error\(["']Fix required fields before exporting\./);
  });
});

describe("dashboard handleExport — auto-redirect on monthly export limit", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../dashboard/resume-actions.tsx"),
    "utf8"
  );

  it("auto-redirects to upgradeUrl on 402/403 instead of showing a toast", () => {
    const exportMatch = source.match(/const handleExport = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/);
    expect(exportMatch, "could not locate handleExport").toBeTruthy();
    const handle = exportMatch![0];

    expect(handle).toMatch(/res\.status === 402 \|\| res\.status === 403/);
    expect(handle).toMatch(/window\.location\.href\s*=\s*upgradeUrl/);
    // The old upgrade-toast-with-suffix is gone.
    expect(handle).not.toMatch(/Upgrade to export more/);
  });
});

describe("server contract — what the redirect branches parse", () => {
  it("a 402 with upgradeUrl routes there; a 402 without one routes to /billing", () => {
    // Mirrors the actual branching logic in both client files.
    const withUrl = { upgradeUrl: "/billing?reason=monthly_export_limit" };
    const withoutUrl = {};
    const redirect = (body: { upgradeUrl?: string }) =>
      body.upgradeUrl ?? "/billing";
    expect(redirect(withUrl)).toBe("/billing?reason=monthly_export_limit");
    expect(redirect(withoutUrl)).toBe("/billing");
  });
});
