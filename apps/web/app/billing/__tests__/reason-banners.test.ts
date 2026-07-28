import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: /billing must show a context banner explaining WHY the user
// was redirected. Auto-redirect flows (use-create-resume, use-duplicate-resume,
// PDF export, cover-letter PDF export) all drop the user on /billing — without
// a banner the page silently opens and the user has no idea what limit they
// hit.
//
// The contract:
//   • The auto-redirect flows receive { error, feature, upgradeUrl } from the
//     server. The upgradeUrl MUST carry `?reason=…` so the /billing page can
//     pick the right banner.
//   • The /billing page MUST map each known reason to a human-readable banner.
//     Unrecognized reasons render no banner (no crash, no silent fallback
//     copy) so we can add new reasons intentionally.
//
// These tests pin both halves of the contract at the source level.
// ──────────────────────────────────────────────────────────────────────────────

// Tests live at apps/web/app/billing/__tests__/, so `../` is the billing
// folder, `../..` is apps/web/app, `../../..` is apps/web.
const WEBROOT = path.resolve(__dirname, "../../..");

const BILLING_PAGE = path.resolve(__dirname, "../page.tsx");

describe("/billing page — reason → banner mapping", () => {
  const source = fs.readFileSync(BILLING_PAGE, "utf8");

  it("declares a REASON_BANNERS map for the known entitlement reasons", () => {
    expect(source).toMatch(/const REASON_BANNERS:\s*Record<string, string>/);
    // Each known reason must produce a banner.
    expect(source).toMatch(/resume_limit:\s*\n\s*["']You've reached/);
    expect(source).toMatch(/monthly_export_limit:\s*\n\s*["']You've hit your monthly export limit/);
  });

  it("uses reasonMessage (or undefined) to drive the banner copy", () => {
    // The message chain must include reasonMessage as one of its branches
    // so that ?reason=… actually surfaces in the rendered banner.
    expect(source).toMatch(/reasonMessage/);
  });

  it("renders the banner in the existing yellow highlight container", () => {
    // The banner container is the b9ff66 highlight box on line ~310. As
    // long as the {message} expression is wired to that container, the
    // banner shows. Pin both halves of the wiring.
    expect(source).toMatch(/\{message\s*&&\s*\(/);
    expect(source).toMatch(/\{message\}/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Server side: every auto-redirect endpoint MUST attach ?reason=… to its
// upgradeUrl. Plain "/billing" leaves the user with no explanation.
// ──────────────────────────────────────────────────────────────────────────────

describe("auto-redirect flows — upgradeUrl always carries ?reason=…", () => {
  it("create-resume route: gates on RESUME_LIMIT via requireEntitlement (which carries ?reason=…)", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/api/resumes/route.ts"),
      "utf8",
    );
    // The route delegates to the entitlements helper, which we test
    // separately below. Pin the call site so a future refactor that
    // inlines the gate and forgets the reason query will fail here.
    expect(source).toMatch(/requireEntitlement\(user\.id, FeatureKeys\.RESUME_LIMIT\)/);
  });

  it("duplicate-resume route: reason matches RESUME_LIMIT feature (via requireEntitlement)", () => {
    const entitlements = fs.readFileSync(
      path.join(WEBROOT, "lib/entitlements.ts"),
      "utf8",
    );
    expect(entitlements).toMatch(/requireEntitlement[\s\S]*?upgradeUrl:\s*`\/billing\?reason=\$\{encodeURIComponent\(feature\)\}`/);
  });

  it("PDF export route: upgradeUrl carries ?reason=monthly_export_limit", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/api/export/pdf/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/upgradeUrl:\s*"\/billing\?reason=monthly_export_limit"/);
  });

  it("cover-letter PDF export route: upgradeUrl carries ?reason=monthly_export_limit", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/api/export/cover-letter-pdf/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/upgradeUrl:\s*"\/billing\?reason=monthly_export_limit"/);
  });

  it("template entitlement route: reason matches USE_PREMIUM_TEMPLATES feature", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/api/resumes/[resumeId]/route.ts"),
      "utf8",
    );
    expect(source).toMatch(
      /upgradeUrl:\s*`\/billing\?reason=\$\{encodeURIComponent\(FeatureKeys\.USE_PREMIUM_TEMPLATES\)\}`/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Decision rule: when the client sees a 402/403 response with an upgradeUrl
// that contains ?reason=…, it MUST use the upgradeUrl as-is (not strip the
// query) when redirecting. The query is load-bearing — it drives the banner.
// ──────────────────────────────────────────────────────────────────────────────

describe("client redirect — preserves the ?reason=… query string", () => {
  it("dashboard handleExport does not strip the query string", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/dashboard/resume-actions.tsx"),
      "utf8",
    );
    const handleMatch = source.match(/const handleExport = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/);
    expect(handleMatch, "could not locate handleExport").toBeTruthy();
    const handle = handleMatch![0];
    expect(handle).toMatch(/window\.location\.href\s*=\s*upgradeUrl/);
  });

  it("builder exportPdf does not strip the query string", () => {
    const source = fs.readFileSync(
      path.join(WEBROOT, "app/builder/resume-builder.tsx"),
      "utf8",
    );
    const exportMatch = source.match(/async function exportPdf\(\)[\s\S]*?\n  \}/);
    const fn = exportMatch![0];
    expect(fn).toMatch(/window\.location\.href\s*=\s*data\.upgradeUrl\s*\?\?\s*["']\/billing["']/);
  });
});
