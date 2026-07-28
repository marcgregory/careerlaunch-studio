import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: clicking "New resume" must not show any popup/modal.
//
// The user reported that the global NavigationOverlay (the
// "Preparing your workspace…" spinner) was flashing briefly between the
// click and the redirect/navigation. The flash was visible enough to read
// as "a popup appears when I click New resume."
//
// The fix removes `navigationOverlay.show(...)` from `useCreateResume`'s
// `onMutate`. The hook now fires the POST with no UI side-effects, and
// the destination's loading.tsx (or the auto-redirect to /billing) is the
// only feedback the user sees.
//
// These tests pin the contract at the source level:
//
//   1. `use-create-resume.ts` does NOT import the navigation overlay or
//      the `show` function. A future refactor that re-adds the import will
//      fail this test and force the author to justify reintroducing the
//      popup.
//
//   2. `new-resume-button.tsx` does NOT render a `<ProgressOverlay>` or
//      any modal/dialog. Same intent.
//
// If a future flow genuinely needs an overlay (e.g. a long-running export
// that keeps the user on the same route), wire it through a new dedicated
// hook so this test continues to describe the create flow's no-popup rule.
// ──────────────────────────────────────────────────────────────────────────────

const HOOK_PATH = path.resolve(
  __dirname,
  "../use-create-resume.ts"
);
const BUTTON_PATH = path.resolve(
  __dirname,
  "../new-resume-button.tsx"
);

describe("useCreateResume — no popup on click", () => {
  const hookSource = fs.readFileSync(HOOK_PATH, "utf8");

  it("does not import the navigation overlay", () => {
    expect(hookSource).not.toMatch(
      /import\s+\{[^}]*\}\s+from\s+["']\.\.\/\.\.\/lib\/navigation-overlay["']/
    );
    expect(hookSource).not.toMatch(
      /from\s+["']\.\.\/\.\.\/lib\/navigation-overlay-store["']/
    );
  });

  it("does not call navigationOverlay.show()", () => {
    expect(hookSource).not.toMatch(/navigationOverlay\.show\s*\(/);
  });

  it("does not import or render ProgressOverlay", () => {
    expect(hookSource).not.toMatch(/ProgressOverlay/);
    expect(hookSource).not.toMatch(/from\s+["'].*progress-overlay["']/);
  });
});

describe("NewResumeButton — no popup markup", () => {
  const buttonSource = fs.readFileSync(BUTTON_PATH, "utf8");

  it("does not render ProgressOverlay", () => {
    expect(buttonSource).not.toMatch(/ProgressOverlay/);
    expect(buttonSource).not.toMatch(/from\s+["'].*progress-overlay["']/);
  });

  it("does not render any modal/dialog component", () => {
    // The button is intentionally a single <a> element. A future refactor
    // that wraps it in a Dialog, Modal, or fixed-position overlay would
    // reintroduce the flash — this assertion will catch that.
    expect(buttonSource).not.toMatch(/<Dialog\b/);
    expect(buttonSource).not.toMatch(/<Modal\b/);
    expect(buttonSource).not.toMatch(/className="[^"]*fixed\s+inset-0/);
  });
});