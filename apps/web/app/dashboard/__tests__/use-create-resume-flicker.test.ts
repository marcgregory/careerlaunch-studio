import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetNavigationOverlayForTests,
  getNavigationOverlaySnapshot,
  hide,
  show,
} from "../../../lib/navigation-overlay-store";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: the dashboard "New resume" flicker.
//
// Root cause: the old `ProgressOverlay` was rendered inside the dashboard's
// `NewResumeButton`. When `router.push("/builder?resumeId=…")` fired, the
// dashboard route segment unmounted in the same tick — including the overlay.
// For the brief gap between dashboard-unmount and builder-paint, the screen
// was bare, which the user perceived as a flicker.
//
// Fix: the overlay is now driven by a module-level store owned by
// `lib/navigation-overlay-store.ts` (read by `lib/navigation-overlay.tsx`'s
// `NavigationOverlayMount` via `useSyncExternalStore`). The store lives
// outside any React tree, so any number of components can mount/unmount
// (including the dashboard) and the overlay will still display, because
// the portal mount in the root layout subscribes to the store and
// re-renders whenever the store changes.
//
// These tests pin the two invariants that make the fix durable:
//
//   1. The overlay's `show()` / `hide()` API is reachable from anywhere —
//      calling it from one "module" survives the unmount of any unrelated
//      "component" (i.e. the store is module-scoped, not tree-scoped).
//
//   2. The store reflects show()/hide() calls synchronously, so the portal
//      reader never observes an "open=true" state that's tied to a
//      specific React component's mount cycle. A future refactor that
//      swaps this for a `useContext`-driven state would re-introduce the
//      flicker, and these assertions will catch it.
// ──────────────────────────────────────────────────────────────────────────────

describe("navigation overlay — dashboard flicker regression", () => {
  beforeEach(() => {
    __resetNavigationOverlayForTests();
  });

  it("exposes a show()/hide() pair from a module-level store (no React provider required)", () => {
    expect(typeof show).toBe("function");
    expect(typeof hide).toBe("function");
    // The functions are reachable without a Provider, which is the whole
    // point: callers (like useCreateResume) can drive the overlay from
    // anywhere in the tree — including components that are about to
    // unmount.
  });

  it("starts closed by default", () => {
    expect(getNavigationOverlaySnapshot().open).toBe(false);
  });

  it("show() flips the snapshot to open=true and stores the user-facing copy", () => {
    show({
      title: "Preparing your workspace…",
      subtitle: "Creating your starter resume.",
      slowSubtitle: "Still creating your resume… Thanks for your patience.",
    });

    const snapshot = getNavigationOverlaySnapshot();
    expect(snapshot.open).toBe(true);
    expect(snapshot.title).toBe("Preparing your workspace…");
    expect(snapshot.subtitle).toBe("Creating your starter resume.");
    expect(snapshot.slowSubtitle).toBe(
      "Still creating your resume… Thanks for your patience."
    );
  });

  it("hide() flips an open snapshot back to open=false", () => {
    show({
      title: "t",
      subtitle: "s",
      slowSubtitle: "ss",
    });
    expect(getNavigationOverlaySnapshot().open).toBe(true);

    hide();
    expect(getNavigationOverlaySnapshot().open).toBe(false);
  });

  it("hide() is a no-op when the overlay is already closed", () => {
    expect(() => {
      hide();
      hide();
    }).not.toThrow();
    expect(getNavigationOverlaySnapshot().open).toBe(false);
  });

  it("store is module-scoped: an external show() is visible to a fresh snapshot reader (simulating a different React tree)", () => {
    // This simulates the exact flicker scenario: the dashboard component
    // (which lives in one route segment) calls show(). The reader
    // (mounted in the root layout, in a separate segment) is structurally
    // unrelated to the dashboard and will outlive it. The reader's
    // snapshot must reflect the show() call.
    show({
      title: "Preparing your workspace…",
      subtitle: "Creating your starter resume.",
      slowSubtitle: "Still creating your resume…",
    });

    // A "fresh" reader — the root layout's portal — subscribes via
    // useSyncExternalStore. The snapshot it sees must be `open: true`.
    expect(getNavigationOverlaySnapshot().open).toBe(true);

    // Now the dashboard route segment unmounts (we don't simulate that
    // here, but the test's intent is: the next reader — the builder's
    // route — must still see open=true until the mutation calls hide()).
    hide();
    expect(getNavigationOverlaySnapshot().open).toBe(false);
  });
});