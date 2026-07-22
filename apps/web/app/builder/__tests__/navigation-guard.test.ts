import { describe, expect, it, vi } from "vitest";
import { applyBackAction, decideBackAction, type SaveState } from "../save-pipeline";

/**
 * The Builder's back-to-dashboard button is a small piece of behavior with
 * three meaningful states: navigate, flush, or block. The decision tree and
 * the flush-then-navigate flow are pure, so we can cover them without
 * React or a router mock.
 */

describe("decideBackAction", () => {
  it("navigates immediately when there is nothing to flush and no error", () => {
    const action = decideBackAction({
      saveState: "Saved",
      hasInFlightSave: false,
      hasUnsavedSnapshot: false,
    });
    expect(action).toBe("navigate");
  });

  it("flushes when the badge says 'Saving' even if the ref has not been populated yet", () => {
    // Belt-and-suspenders: the UI label is the user-visible truth.
    const action = decideBackAction({
      saveState: "Saving",
      hasInFlightSave: false,
      hasUnsavedSnapshot: false,
    });
    expect(action).toBe("flush");
  });

  it("flushes when a save is in flight even if the saveState badge still says 'Saved'", () => {
    const action = decideBackAction({
      saveState: "Saved",
      hasInFlightSave: true,
      hasUnsavedSnapshot: false,
    });
    expect(action).toBe("flush");
  });

  it("flushes when the resume differs from the saved snapshot ('Unsaved' badge)", () => {
    const action = decideBackAction({
      saveState: "Unsaved",
      hasInFlightSave: false,
      hasUnsavedSnapshot: true,
    });
    expect(action).toBe("flush");
  });

  it("blocks when the latest save failed, so the user can retry instead of losing data", () => {
    const action = decideBackAction({
      saveState: "Error",
      hasInFlightSave: false,
      hasUnsavedSnapshot: true,
    });
    expect(action).toBe("block");
  });

  it("blocks even if the resume matches the saved snapshot, because the user saw a failure", () => {
    const action = decideBackAction({
      saveState: "Error",
      hasInFlightSave: false,
      hasUnsavedSnapshot: false,
    });
    expect(action).toBe("block");
  });

  it("always prioritizes Error over in-flight saves — block beats flush", () => {
    const action = decideBackAction({
      saveState: "Error",
      hasInFlightSave: true,
      hasUnsavedSnapshot: true,
    });
    expect(action).toBe("block");
  });
});

describe("applyBackAction", () => {
  it("navigates without flushing when the decision is 'navigate'", async () => {
    const flush = vi.fn(async () => true);
    const shouldNavigate = await applyBackAction("navigate", flush);
    expect(flush).not.toHaveBeenCalled();
    expect(shouldNavigate).toBe(true);
  });

  it("blocks navigation without calling flush when the decision is 'block'", async () => {
    const flush = vi.fn(async () => true);
    const shouldNavigate = await applyBackAction("block", flush);
    expect(flush).not.toHaveBeenCalled();
    expect(shouldNavigate).toBe(false);
  });

  it("flushes and navigates only when the flush succeeds", async () => {
    const flush = vi.fn(async () => true);
    const shouldNavigate = await applyBackAction("flush", flush);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(shouldNavigate).toBe(true);
  });

  it("stays in the builder when the flush returns false", async () => {
    const flush = vi.fn(async () => false);
    const shouldNavigate = await applyBackAction("flush", flush);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(shouldNavigate).toBe(false);
  });

  it("flushes once per click when two clicks fire before the first resolves", async () => {
    const pending: Array<(value: boolean) => void> = [];
    const flush = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          pending.push(resolve);
        }),
    );

    const first = applyBackAction("flush", flush);
    const second = applyBackAction("flush", flush);

    // Resolve each pending flush individually.
    pending[0](true);
    pending[1](true);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(flush).toHaveBeenCalledTimes(2);
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
  }, 10_000);

  it("propagates a thrown error as a non-navigation outcome", async () => {
    const flush = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(applyBackAction("flush", flush)).rejects.toThrow("network down");
  });
});
