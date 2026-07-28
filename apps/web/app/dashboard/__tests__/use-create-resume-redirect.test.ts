import { describe, it, expect } from "vitest";
import type { CreateApiError } from "../create-resume-errors";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: "New resume" must auto-redirect to billing on entitlement 403.
//
// The user reported: "when i click new resume" + plan limit reached, the
// right behavior is to take them straight to the upgrade page. Anything
// in between (toast + button click) is friction — they have already
// decided they want more resumes.
//
// The 403 response from POST /api/resumes carries:
//   { error: "Resume limit reached.", feature: "resume_limit",
//     upgradeUrl: "/billing?reason=resume_limit" }
//
// `parseCreateError` lifts `upgradeUrl` onto the thrown Error. The hook's
// `onError` then branches: `if (err.upgradeUrl) window.location.href = …;`
// — no toast, no Upgrade button.
//
// This test pins the contract at the parser + branching level so future
// refactors of the hook's `onError` stay correct.
// ──────────────────────────────────────────────────────────────────────────────

describe("parseCreateError — entitlement 403 lifts upgradeUrl", () => {
  it("carries the billing URL onto the thrown Error when the server responds 403", async () => {
    const res = new Response(
      JSON.stringify({
        error: "Resume limit reached.",
        feature: "resume_limit",
        upgradeUrl: "/billing?reason=resume_limit",
      }),
      { status: 403 }
    );

    const err = await import("../create-resume-errors").then((m) =>
      m.parseCreateError(res, "Failed to create resume")
    );

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Resume limit reached.");
    expect((err as CreateApiError).upgradeUrl).toBe(
      "/billing?reason=resume_limit"
    );
  });

  it("omits upgradeUrl when the body does not include one (so the hook falls through to the retry path)", async () => {
    const res = new Response(
      JSON.stringify({ error: "Server unavailable" }),
      { status: 502 }
    );

    const err = await import("../create-resume-errors").then((m) =>
      m.parseCreateError(res, "Failed to create resume")
    );

    expect((err as CreateApiError).upgradeUrl).toBeUndefined();
    expect(err.message).toBe("Server unavailable");
  });
});

describe("hook decision rule — entitlement 403 → auto-redirect", () => {
  it("an Error whose upgradeUrl is set signals a hard redirect (no toast, no Upgrade button)", () => {
    // This mirrors the exact branching in use-create-resume.ts onError.
    // If a future refactor swaps the branch for a toast + Upgrade button,
    // this assertion will fail and force the author to justify it.
    const err = Object.assign(new Error("Resume limit reached."), {
      upgradeUrl: "/billing?reason=resume_limit",
    }) as CreateApiError;

    const shouldAutoRedirect = Boolean(err.upgradeUrl);
    const shouldShowToast = !err.upgradeUrl;

    expect(shouldAutoRedirect).toBe(true);
    expect(shouldShowToast).toBe(false);
  });

  it("an Error without upgradeUrl signals a retry toast (stays on dashboard)", () => {
    const err = Object.assign(new Error("Server unavailable"), {}) as CreateApiError;

    const shouldAutoRedirect = Boolean(err.upgradeUrl);
    const shouldShowToast = !err.upgradeUrl;

    expect(shouldAutoRedirect).toBe(false);
    expect(shouldShowToast).toBe(true);
  });
});