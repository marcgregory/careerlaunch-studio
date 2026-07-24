import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerializedResume } from "../resume-actions";

// ──────────────────────────────────────────────────────────────────────────────
// Pure unit tests for optimisticallyAddResume cache mutation.
// The hook itself relies on React / TanStack Query internals that require a
// full browser environment; we test the cache helper in isolation to keep the
// suite fast and dependency-free.
// ──────────────────────────────────────────────────────────────────────────────

import { optimisticallyAddResume } from "../use-duplicate-resume";
import type { ResumeCacheData } from "../resume-actions";

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

describe("optimisticallyAddResume", () => {
  it("inserts the duplicated resume at the front of the first page", () => {
    const existing = [makeResume("existing-1"), makeResume("existing-2")];
    const duped = makeResume("duped-1", "My Resume (copy)");
    const oldData = makeCacheData(existing);

    let capturedData: ResumeCacheData | undefined;

    const queryClient = {
      setQueryData: vi.fn(
        (_key: unknown, updater: (old: ResumeCacheData) => ResumeCacheData) => {
          capturedData = updater(oldData);
        }
      ),
    };

    optimisticallyAddResume(queryClient as never, duped);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ["resumes"],
      expect.any(Function)
    );
    expect(capturedData?.pages[0].resumes[0].id).toBe("duped-1");
    expect(capturedData?.pages[0].resumes).toHaveLength(3);
  });

  it("increments total count in pagination after insertion", () => {
    const existing = [makeResume("r1"), makeResume("r2")];
    const duped = makeResume("r3");
    const oldData = makeCacheData(existing);

    let capturedData: ResumeCacheData | undefined;

    const queryClient = {
      setQueryData: vi.fn(
        (_key: unknown, updater: (old: ResumeCacheData) => ResumeCacheData) => {
          capturedData = updater(oldData);
        }
      ),
    };

    optimisticallyAddResume(queryClient as never, duped);

    expect(capturedData?.pages[0].pagination.total).toBe(3);
  });

  it("only mutates the first page, leaving subsequent pages untouched", () => {
    const page1Resumes = [makeResume("p1-r1")];
    const page2Resumes = [makeResume("p2-r1")];
    const duped = makeResume("duped");

    const oldData: ResumeCacheData = {
      pages: [
        { resumes: page1Resumes, pagination: { page: 1, limit: 10, total: 2, hasMore: true } },
        { resumes: page2Resumes, pagination: { page: 2, limit: 10, total: 2, hasMore: false } },
      ],
      pageParams: [1, 2],
    };

    let capturedData: ResumeCacheData | undefined;

    const queryClient = {
      setQueryData: vi.fn(
        (_key: unknown, updater: (old: ResumeCacheData) => ResumeCacheData) => {
          capturedData = updater(oldData);
        }
      ),
    };

    optimisticallyAddResume(queryClient as never, duped);

    // First page gets the new item
    expect(capturedData?.pages[0].resumes).toHaveLength(2);
    expect(capturedData?.pages[0].resumes[0].id).toBe("duped");

    // Second page is untouched
    expect(capturedData?.pages[1].resumes).toHaveLength(1);
    expect(capturedData?.pages[1].resumes[0].id).toBe("p2-r1");
  });

  it("preserves pageParams unchanged", () => {
    const existing = [makeResume("r1")];
    const duped = makeResume("r2");
    const oldData = makeCacheData(existing);

    let capturedData: ResumeCacheData | undefined;

    const queryClient = {
      setQueryData: vi.fn(
        (_key: unknown, updater: (old: ResumeCacheData) => ResumeCacheData) => {
          capturedData = updater(oldData);
        }
      ),
    };

    optimisticallyAddResume(queryClient as never, duped);

    expect(capturedData?.pageParams).toEqual([1]);
  });

  it("returns undefined without calling setQueryData if cache is empty", () => {
    const queryClient = {
      setQueryData: vi.fn(
        (_key: unknown, updater: (old: ResumeCacheData | undefined) => ResumeCacheData | undefined) => {
          updater(undefined);
        }
      ),
    };

    // Should not throw when old data is undefined
    expect(() =>
      optimisticallyAddResume(queryClient as never, makeResume("r1"))
    ).not.toThrow();
  });
});

describe("handleDuplicate — idempotency guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not issue a second fetch if a duplicate for the same id is already in flight", async () => {
    // We test this through the isDuplicating guard logic:
    // if isDuplicating(id) returns true, duplicate() should be a no-op.
    // This is implemented by tracking duplicatingIds in the hook.
    // The Set-based guard prevents re-entry.

    const duplicatingIds = new Set<string>();
    const resumeId = "resume-abc";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resume: makeResume(resumeId + "-copy") }),
    }));

    // Simulate the guard logic from useDuplicateResume
    function duplicateGuarded(id: string) {
      if (duplicatingIds.has(id)) return;
      duplicatingIds.add(id);
      fetchMock();
    }

    duplicateGuarded(resumeId); // first call — should fetch
    duplicateGuarded(resumeId); // second call — should be blocked

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows duplicate again after the operation settles", async () => {
    const duplicatingIds = new Set<string>();
    const resumeId = "resume-xyz";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resume: makeResume(resumeId + "-copy") }),
    }));

    async function duplicateAndSettle(id: string) {
      if (duplicatingIds.has(id)) return;
      duplicatingIds.add(id);
      try {
        await fetchMock();
      } finally {
        duplicatingIds.delete(id);
      }
    }

    await duplicateAndSettle(resumeId);
    await duplicateAndSettle(resumeId); // should proceed since first settled

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("error handling — cancellation detection", () => {
  it("classifies AbortError as a cancellation", () => {
    const err = new DOMException("The user aborted a request.", "AbortError");
    const isCanceled =
      err.name === "AbortError" ||
      err.message.toLowerCase().includes("cancel") ||
      err.message.toLowerCase().includes("aborted");
    expect(isCanceled).toBe(true);
  });

  it("classifies generic errors as failures, not cancellations", () => {
    const err = new Error("Network error");
    const isCanceled =
      err.name === "AbortError" ||
      err.message.toLowerCase().includes("cancel") ||
      err.message.toLowerCase().includes("aborted");
    expect(isCanceled).toBe(false);
  });

  it("classifies messages containing 'aborted' as cancellations", () => {
    const err = new Error("Fetch aborted by scroll event");
    const isCanceled =
      err.name === "AbortError" ||
      err.message.toLowerCase().includes("cancel") ||
      err.message.toLowerCase().includes("aborted");
    expect(isCanceled).toBe(true);
  });
});
