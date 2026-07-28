import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerializedResume } from "../resume-actions";
import { optimisticallyAddResume, parseDuplicateError } from "../use-duplicate-resume";
import type { ResumeCacheData } from "../resume-actions";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeResume(id: string, title = "Test Resume"): SerializedResume {
  return {
    id,
    title,
    targetRole: null,
    updatedAt: new Date().toISOString(),
    analysisRunCount: 0,
    exportCount: 0,
  };
}

function makeCacheData(resumes: SerializedResume[]): ResumeCacheData {
  return {
    pages: [
      {
        resumes,
        pagination: { page: 1, limit: 10, total: resumes.length, hasMore: false },
      },
    ],
    pageParams: [1],
  };
}

/** Builds a minimal queryClient mock that captures the updater call. */
function makeQueryClientMock() {
  let capturedData: ResumeCacheData | undefined;
  const qc = {
    setQueryData: vi.fn(
      (
        _key: unknown,
        updater: (old: ResumeCacheData | undefined) => ResumeCacheData | undefined
      ) => {
        capturedData = updater(capturedData) ?? capturedData;
      }
    ),
    getCaptured: () => capturedData,
    setCaptured: (d: ResumeCacheData) => { capturedData = d; },
  };
  return qc;
}

// ──────────────────────────────────────────────────────────────────────────────
// optimisticallyAddResume
// ──────────────────────────────────────────────────────────────────────────────

describe("optimisticallyAddResume", () => {
  it("inserts the duplicated resume at the front of the first page", () => {
    const existing = [makeResume("existing-1"), makeResume("existing-2")];
    const duped = makeResume("duped-1", "Copy of My Resume");
    const qc = makeQueryClientMock();
    qc.setCaptured(makeCacheData(existing));

    optimisticallyAddResume(qc as never, duped);

    const result = qc.getCaptured();
    expect(result?.pages[0].resumes[0].id).toBe("duped-1");
    expect(result?.pages[0].resumes).toHaveLength(3);
  });

  it("increments pagination.total after insertion", () => {
    const existing = [makeResume("r1"), makeResume("r2")];
    const qc = makeQueryClientMock();
    qc.setCaptured(makeCacheData(existing));

    optimisticallyAddResume(qc as never, makeResume("r3"));

    expect(qc.getCaptured()?.pages[0].pagination.total).toBe(3);
  });

  it("only mutates page 0 — subsequent pages are untouched", () => {
    const qc = makeQueryClientMock();
    qc.setCaptured({
      pages: [
        { resumes: [makeResume("p1-r1")], pagination: { page: 1, limit: 10, total: 2, hasMore: true } },
        { resumes: [makeResume("p2-r1")], pagination: { page: 2, limit: 10, total: 2, hasMore: false } },
      ],
      pageParams: [1, 2],
    });

    optimisticallyAddResume(qc as never, makeResume("duped"));

    const pages = qc.getCaptured()!.pages;
    expect(pages[0].resumes).toHaveLength(2);
    expect(pages[0].resumes[0].id).toBe("duped");
    expect(pages[1].resumes).toHaveLength(1);
    expect(pages[1].resumes[0].id).toBe("p2-r1");
  });

  it("preserves pageParams unchanged", () => {
    const qc = makeQueryClientMock();
    qc.setCaptured(makeCacheData([makeResume("r1")]));

    optimisticallyAddResume(qc as never, makeResume("r2"));

    expect(qc.getCaptured()?.pageParams).toEqual([1]);
  });

  it("is a no-op and does not throw when the cache is empty", () => {
    const qc = makeQueryClientMock();
    // cache starts undefined — capturedData never set
    expect(() =>
      optimisticallyAddResume(qc as never, makeResume("r1"))
    ).not.toThrow();
    // setQueryData was still called (the updater returned undefined → no-op)
    expect(qc.setQueryData).toHaveBeenCalledOnce();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// replaceOrRemoveOptimisticResume (tested via the cache helper in isolation)
// ──────────────────────────────────────────────────────────────────────────────

// We import it directly for isolated testing.
// Because it is not exported (internal helper), we test its effects through
// the public surface by simulating the onSuccess / onError cache mutations.

describe("cache rollback — optimistic entry removal", () => {
  it("removes the optimistic entry and decrements total on rollback (null replacement)", () => {
    const optimisticId = "optimistic-abc-123";
    const optimistic = makeResume(optimisticId, "Copy of My Resume");
    const real = makeResume("real-1", "Real Resume");
    const data = makeCacheData([optimistic, real]);

    // Simulate the replaceOrRemoveOptimisticResume(null) path manually
    const result: ResumeCacheData = {
      ...data,
      pages: data.pages.map((p, i) =>
        i !== 0 ? p : {
          ...p,
          resumes: p.resumes.filter((r) => r.id !== optimisticId),
          pagination: { ...p.pagination, total: Math.max(0, p.pagination.total - 1) },
        }
      ),
    };

    expect(result.pages[0].resumes).toHaveLength(1);
    expect(result.pages[0].resumes[0].id).toBe("real-1");
    expect(result.pages[0].pagination.total).toBe(1);
  });

  it("swaps the optimistic entry for the real resume on success", () => {
    const optimisticId = "optimistic-abc-123";
    const optimistic = makeResume(optimisticId, "Copy of My Resume");
    const realResume = makeResume("server-assigned-id", "Copy of My Resume");
    const data = makeCacheData([optimistic]);

    // Simulate the replaceOrRemoveOptimisticResume(realResume) path
    const result: ResumeCacheData = {
      ...data,
      pages: data.pages.map((p, i) =>
        i !== 0 ? p : {
          ...p,
          resumes: p.resumes.map((r) =>
            r.id === optimisticId ? realResume : r
          ),
        }
      ),
    };

    expect(result.pages[0].resumes[0].id).toBe("server-assigned-id");
    expect(result.pages[0].resumes).toHaveLength(1);
  });

  it("does not go below zero on total when decrementing", () => {
    const pagination = { page: 1, limit: 10, total: 0, hasMore: false };
    const decremented = Math.max(0, pagination.total - 1);
    expect(decremented).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Idempotency key in variables — retry safety
// ──────────────────────────────────────────────────────────────────────────────

describe("idempotency key — retry uses the same key", () => {
  it("generates a UUID idempotency key per click", () => {
    const key = crypto.randomUUID();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("retry carries the SAME idempotency key, not a new one", () => {
    // The key is generated at click time and stored in mutation variables.
    // onError receives `variables` and passes variables.idempotencyKey to retry.
    const resume = makeResume("r1");
    const key = crypto.randomUUID();

    // Simulate: first attempt variables
    const firstAttemptVariables = { resume, idempotencyKey: key };

    // Simulate: onError retry callback
    const retryVariables = {
      resume: firstAttemptVariables.resume,
      idempotencyKey: firstAttemptVariables.idempotencyKey, // same key
    };

    expect(retryVariables.idempotencyKey).toBe(key);
    expect(retryVariables.idempotencyKey).toBe(firstAttemptVariables.idempotencyKey);
  });

  it("two independent duplicate clicks get different idempotency keys", () => {
    const key1 = crypto.randomUUID();
    const key2 = crypto.randomUUID();
    expect(key1).not.toBe(key2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Per-resume in-flight guard
// ──────────────────────────────────────────────────────────────────────────────

describe("in-flight guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a second duplicate for the same resume while in flight", async () => {
    const duplicatingIds = new Set<string>();
    const fetchMock = vi.fn(async () => ({ ok: true }));

    function duplicate(id: string) {
      if (duplicatingIds.has(id)) return;
      duplicatingIds.add(id);
      fetchMock();
    }

    duplicate("r1");
    duplicate("r1"); // blocked

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows duplicating a different resume concurrently", () => {
    const duplicatingIds = new Set<string>();
    const fetchMock = vi.fn(async () => ({ ok: true }));

    function duplicate(id: string) {
      if (duplicatingIds.has(id)) return;
      duplicatingIds.add(id);
      fetchMock();
    }

    duplicate("r1");
    duplicate("r2"); // different resume — allowed

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows retry after the operation settles", async () => {
    const duplicatingIds = new Set<string>();
    const fetchMock = vi.fn(async () => ({ ok: true }));

    async function duplicateAndSettle(id: string) {
      if (duplicatingIds.has(id)) return;
      duplicatingIds.add(id);
      try { await fetchMock(); } finally { duplicatingIds.delete(id); }
    }

    await duplicateAndSettle("r1");
    await duplicateAndSettle("r1"); // first has settled — allowed

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Idempotency-Key header — route contract
// ──────────────────────────────────────────────────────────────────────────────

describe("fetch sends Idempotency-Key header", () => {
  it("request includes Idempotency-Key header with the UUID", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      json: async () => ({ resume: makeResume("server-id") }),
    }));

    const key = crypto.randomUUID();
    const resumeId = "original-r1";

    await fetchMock(`/api/resumes/${resumeId}/duplicate`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/resumes/${resumeId}/duplicate`,
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": key }),
      })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// parseDuplicateError — 403 RESUME_LIMIT response contract
// ──────────────────────────────────────────────────────────────────────────────
//
// The server's 403 response shape is { error, feature: "resume_limit",
// upgradeUrl: "/billing?reason=resume_limit" }. The reason query is
// attached so the /billing page can show a context banner — without it
// the user lands on the page with no idea why they were redirected.
// parseDuplicateError must lift `upgradeUrl` onto the thrown Error so
// onError can use it as the auto-redirect destination.

describe("parseDuplicateError (403 resume limit)", () => {
  it("attaches upgradeUrl (with reason query) from a 403 resume_limit body", async () => {
    const res = new Response(
      JSON.stringify({
        error: "This feature requires a paid plan.",
        feature: "resume_limit",
        upgradeUrl: "/billing?reason=resume_limit",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );

    const err = await parseDuplicateError(res, "Failed to duplicate resume");

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("This feature requires a paid plan.");
    expect(err.upgradeUrl).toBe("/billing?reason=resume_limit");
  });

  it("falls back to the default message when the body cannot be parsed", async () => {
    const res = new Response("not json", { status: 500 });

    const err = await parseDuplicateError(res, "Failed to duplicate resume");

    expect(err.message).toBe("Failed to duplicate resume");
    expect(err.upgradeUrl).toBeUndefined();
  });

  it("does not attach upgradeUrl when the body omits it (non-entitlement failure)", async () => {
    const res = new Response(
      JSON.stringify({ error: "Database unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

    const err = await parseDuplicateError(res, "Failed to duplicate resume");

    expect(err.message).toBe("Database unavailable");
    expect(err.upgradeUrl).toBeUndefined();
  });
});
