import { describe, it, expect, vi } from "vitest";
import { parseCreateError } from "../create-resume-errors";

// ──────────────────────────────────────────────────────────────────────────────
// parseCreateError
// ──────────────────────────────────────────────────────────────────────────────

describe("parseCreateError", () => {
  it("lifts upgradeUrl onto the thrown Error when present", async () => {
    const res = new Response(
      JSON.stringify({
        error: "Resume limit reached.",
        feature: "resume_limit",
        upgradeUrl: "/billing?reason=resume_limit",
      }),
      { status: 403 }
    );
    const err = await parseCreateError(res, "Failed to create resume");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Resume limit reached.");
    expect((err as { upgradeUrl?: string }).upgradeUrl).toBe(
      "/billing?reason=resume_limit"
    );
  });

  it("falls back to the supplied message when the body has no error field", async () => {
    const res = new Response("{}", { status: 500 });
    const err = await parseCreateError(res, "Failed to create resume");
    expect(err.message).toBe("Failed to create resume");
    expect((err as { upgradeUrl?: string }).upgradeUrl).toBeUndefined();
  });

  it("handles malformed JSON without throwing", async () => {
    const res = new Response("not json", { status: 502 });
    const err = await parseCreateError(res, "Failed to create resume");
    expect(err.message).toBe("Failed to create resume");
  });

  it("uses the response body's error message when present even without upgradeUrl", async () => {
    const res = new Response(JSON.stringify({ error: "Server unavailable" }), {
      status: 503,
    });
    const err = await parseCreateError(res, "Failed to create resume");
    expect(err.message).toBe("Server unavailable");
    expect((err as { upgradeUrl?: string }).upgradeUrl).toBeUndefined();
  });
});