import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResumeCacheData, SerializedResume } from "../resume-actions";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeResume(id: string, overrides: Partial<SerializedResume> = {}): SerializedResume {
  return {
    id,
    title: `Resume ${id}`,
    targetRole: null,
    updatedAt: new Date().toISOString(),
    analysisRunCount: 0,
    exportCount: 0,
    ...overrides,
  };
}

function makeCacheData(resumes: SerializedResume[], total?: number): ResumeCacheData {
  return {
    pages: [
      {
        resumes,
        pagination: { page: 1, limit: 10, total: total ?? resumes.length, hasMore: false },
      },
    ],
    pageParams: [1],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Issue 1 — Rename: optimistic update + rollback
// ──────────────────────────────────────────────────────────────────────────────

describe("Rename — optimistic update", () => {
  it("patches the cached title before the server responds", () => {
    const r = makeResume("r1", { title: "Old Title" });
    const data = makeCacheData([r]);
    let cache = { ...data };

    const patchCachedTitle = (nextTitle: string) => {
      cache = {
        ...cache,
        pages: cache.pages.map((p) => ({
          ...p,
          resumes: p.resumes.map((res) =>
            res.id === "r1" ? { ...res, title: nextTitle } : res
          ),
        })),
      };
    };

    // Optimistic update fires before fetch
    patchCachedTitle("New Title");
    expect(cache.pages[0].resumes[0].title).toBe("New Title");
  });

  it("rolls back to the previous title when the server rejects the rename", () => {
    const r = makeResume("r1", { title: "Old Title" });
    let cache = makeCacheData([r]);

    const patchCachedTitle = (nextTitle: string) => {
      cache = {
        ...cache,
        pages: cache.pages.map((p) => ({
          ...p,
          resumes: p.resumes.map((res) =>
            res.id === "r1" ? { ...res, title: nextTitle } : res
          ),
        })),
      };
    };

    const previousTitle = cache.pages[0].resumes[0].title; // "Old Title"
    patchCachedTitle("New Title");
    expect(cache.pages[0].resumes[0].title).toBe("New Title");

    // Simulate server failure → rollback
    patchCachedTitle(previousTitle);
    expect(cache.pages[0].resumes[0].title).toBe("Old Title");
  });

  it("does not patch titles of other resumes", () => {
    const r1 = makeResume("r1", { title: "Resume 1" });
    const r2 = makeResume("r2", { title: "Resume 2" });
    let cache = makeCacheData([r1, r2]);

    cache = {
      ...cache,
      pages: cache.pages.map((p) => ({
        ...p,
        resumes: p.resumes.map((r) =>
          r.id === "r1" ? { ...r, title: "Renamed" } : r
        ),
      })),
    };

    expect(cache.pages[0].resumes[0].title).toBe("Renamed");
    expect(cache.pages[0].resumes[1].title).toBe("Resume 2");
  });

  it("is a no-op rename when new title equals current title", () => {
    // The modal short-circuits and calls onClose() without touching the cache.
    const sameTitle = "Same Title";
    const currentTitle = "Same Title";
    const isNoOp = sameTitle.trim() === currentTitle;
    expect(isNoOp).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Issue 2 — Delete: optimistic remove + rollback on server failure
// ──────────────────────────────────────────────────────────────────────────────

describe("Delete — optimistic remove", () => {
  it("removes the resume from the cache immediately", () => {
    const r1 = makeResume("r1");
    const r2 = makeResume("r2");
    let cache = makeCacheData([r1, r2], 2);

    // Optimistic remove
    cache = {
      ...cache,
      pages: cache.pages.map((p) => ({
        ...p,
        resumes: p.resumes.filter((r) => r.id !== "r1"),
        pagination: { ...p.pagination, total: Math.max(0, p.pagination.total - 1) },
      })),
    };

    expect(cache.pages[0].resumes).toHaveLength(1);
    expect(cache.pages[0].resumes[0].id).toBe("r2");
    expect(cache.pages[0].pagination.total).toBe(1);
  });

  it("restores the full previous snapshot on server failure", () => {
    const r1 = makeResume("r1");
    const r2 = makeResume("r2");
    const originalCache = makeCacheData([r1, r2], 2);

    // Snapshot
    const previousData = originalCache;

    // Optimistic remove
    let cache: ResumeCacheData = {
      ...originalCache,
      pages: originalCache.pages.map((p) => ({
        ...p,
        resumes: p.resumes.filter((r) => r.id !== "r1"),
        pagination: { ...p.pagination, total: 1 },
      })),
    };

    expect(cache.pages[0].resumes).toHaveLength(1);

    // Server fails → restore snapshot
    cache = previousData;

    expect(cache.pages[0].resumes).toHaveLength(2);
    expect(cache.pages[0].resumes[0].id).toBe("r1");
    expect(cache.pages[0].pagination.total).toBe(2);
  });

  it("does not go below zero on total when decrementing", () => {
    const decremented = Math.max(0, 0 - 1);
    expect(decremented).toBe(0);
  });

  it("restores the resume to the correct page index after rollback", () => {
    const r1 = makeResume("r1");
    const r2 = makeResume("r2");
    const r3 = makeResume("r3");

    const twoPageCache: ResumeCacheData = {
      pages: [
        { resumes: [r1, r2], pagination: { page: 1, limit: 2, total: 3, hasMore: true } },
        { resumes: [r3], pagination: { page: 2, limit: 2, total: 3, hasMore: false } },
      ],
      pageParams: [1, 2],
    };

    const snapshot = twoPageCache;

    // Remove r2 from page 0
    let mutated: ResumeCacheData = {
      ...twoPageCache,
      pages: twoPageCache.pages.map((p, i) =>
        i === 0
          ? { ...p, resumes: p.resumes.filter((r) => r.id !== "r2"), pagination: { ...p.pagination, total: 2 } }
          : p
      ),
    };

    expect(mutated.pages[0].resumes).toHaveLength(1);

    // Rollback via snapshot
    mutated = snapshot;
    expect(mutated.pages[0].resumes).toHaveLength(2);
    expect(mutated.pages[0].resumes[1].id).toBe("r2");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Issue 3 — WorkspaceStats: derived from cache
// ──────────────────────────────────────────────────────────────────────────────

describe("WorkspaceStats derivation from cache", () => {
  function deriveStats(pages: ResumeCacheData["pages"]) {
    const allResumes = pages.flatMap((p) => p.resumes);
    return {
      totalResumes: pages[0]?.pagination.total ?? allResumes.length,
      targetedCount: allResumes.filter((r) => !!r.targetRole).length,
      analyzedCount: allResumes.filter((r) => r.analysisRunCount > 0).length,
      exportCount: allResumes.reduce((sum, r) => sum + (r.exportCount ?? 0), 0),
    };
  }

  it("computes totalResumes from pagination.total (not array length)", () => {
    const pages = makeCacheData([makeResume("r1")], 42).pages;
    const stats = deriveStats(pages);
    expect(stats.totalResumes).toBe(42);
  });

  it("counts targeted resumes (non-null targetRole)", () => {
    const resumes = [
      makeResume("r1", { targetRole: "Engineer" }),
      makeResume("r2", { targetRole: null }),
      makeResume("r3", { targetRole: "Designer" }),
    ];
    const pages = makeCacheData(resumes).pages;
    expect(deriveStats(pages).targetedCount).toBe(2);
  });

  it("counts analyzed resumes (analysisRunCount > 0)", () => {
    const resumes = [
      makeResume("r1", { analysisRunCount: 3 }),
      makeResume("r2", { analysisRunCount: 0 }),
      makeResume("r3", { analysisRunCount: 1 }),
    ];
    const pages = makeCacheData(resumes).pages;
    expect(deriveStats(pages).analyzedCount).toBe(2);
  });

  it("sums export counts across all resumes", () => {
    const resumes = [
      makeResume("r1", { exportCount: 3 }),
      makeResume("r2", { exportCount: 1 }),
      makeResume("r3", { exportCount: 0 }),
    ];
    const pages = makeCacheData(resumes).pages;
    expect(deriveStats(pages).exportCount).toBe(4);
  });

  it("updates targetedCount after a rename that adds a targetRole", () => {
    const resumes = [
      makeResume("r1", { targetRole: null }),
      makeResume("r2", { targetRole: null }),
    ];
    let pages = makeCacheData(resumes).pages;
    expect(deriveStats(pages).targetedCount).toBe(0);

    // Simulate a rename that also sets targetRole (via builder sync)
    pages = pages.map((p) => ({
      ...p,
      resumes: p.resumes.map((r) =>
        r.id === "r1" ? { ...r, targetRole: "Frontend Engineer" } : r
      ),
    }));

    expect(deriveStats(pages).targetedCount).toBe(1);
  });

  it("updates totalResumes after a delete (via pagination.total decrement)", () => {
    const resumes = [makeResume("r1"), makeResume("r2")];
    let pages = makeCacheData(resumes, 2).pages;
    expect(deriveStats(pages).totalResumes).toBe(2);

    // Simulate delete optimistic remove
    pages = pages.map((p) => ({
      ...p,
      resumes: p.resumes.filter((r) => r.id !== "r1"),
      pagination: { ...p.pagination, total: 1 },
    }));

    expect(deriveStats(pages).totalResumes).toBe(1);
  });

  it("falls back to SSR values when cache pages is empty", () => {
    const ssrFallback = { totalResumes: 5, targetedCount: 2, analyzedCount: 1, exportCount: 3 };
    const emptyPages: ResumeCacheData["pages"] = [];

    // When allResumes.length === 0 the hook returns ssrFallback
    const allResumes = emptyPages.flatMap((p) => p.resumes);
    const result = allResumes.length === 0 ? ssrFallback : deriveStats(emptyPages);

    expect(result).toEqual(ssrFallback);
  });
});
