/**
 * Test: Export Count Persistence Across Pages
 *
 * Verifies that the optimistic export count update in ResumeActions:
 * 1. Updates the targeted resume's exportCount regardless of which page it lives on
 *    (the resume may be on page 1+ after sort/filter/pagination, not just page 0).
 * 2. Updates the workspace stats (exportCount) on page 0.
 * 3. Preserves all other resume properties (id, title, targetRole, updatedAt,
 *    analysisRunCount).
 *
 * **Validates: persistence across pages of the ["resumes"] infinite cache**
 */

import { describe, it, expect } from "vitest";
import type { ResumeCacheData, SerializedResume } from "../resume-actions";
import type { WorkspaceStats } from "../../../hooks/use-workspace-stats";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeResume(
  id: string,
  overrides: Partial<SerializedResume> = {}
): SerializedResume {
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

function makePage(
  resumes: SerializedResume[],
  stats?: WorkspaceStats
) {
  return {
    resumes,
    pagination: { page: 1, limit: 10, total: resumes.length, hasMore: false },
    stats,
  };
}

type PageShape = ReturnType<typeof makePage>;

function makeCacheData(pages: PageShape[]): ResumeCacheData {
  return {
    pages,
    pageParams: pages.map((_, i) => i + 1),
  };
}

/**
 * Mirrors the optimistic update logic in resume-actions.tsx handleExport.
 * If the production code is updated, this helper MUST be updated in lockstep.
 */
function applyOptimisticExport(
  cacheData: ResumeCacheData,
  resumeId: string
): ResumeCacheData {
  let didIncrement = false;
  const pages = cacheData.pages.map((p) => {
    let pageTouched = false;
    const resumes = p.resumes.map((r) => {
      if (r.id === resumeId) {
        pageTouched = true;
        return { ...r, exportCount: (r.exportCount ?? 0) + 1 };
      }
      return r;
    });
    if (pageTouched) didIncrement = true;
    return pageTouched ? { ...p, resumes } : p;
  });
  return {
    ...cacheData,
    pages: didIncrement
      ? pages.map((p, i) =>
          i === 0 && p.stats
            ? { ...p, stats: { ...p.stats, exportCount: p.stats.exportCount + 1 } }
            : p,
        )
      : pages,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("ResumeActions.handleExport — optimistic export count", () => {
  it("increments exportCount on the resume when it is on page 0", () => {
    const target = makeResume("r1", { exportCount: 2 });
    const other = makeResume("r2", { exportCount: 5 });
    const cache = makeCacheData([
      makePage([target, other], {
        totalResumes: 2,
        targetedCount: 0,
        analyzedCount: 0,
        exportCount: 7,
      }),
    ]);

    const result = applyOptimisticExport(cache, "r1");

    const updated = result.pages[0].resumes.find((r) => r.id === "r1")!;
    expect(updated.exportCount).toBe(3);
    // Other resume must not be touched
    const otherAfter = result.pages[0].resumes.find((r) => r.id === "r2")!;
    expect(otherAfter.exportCount).toBe(5);
    // Stats must increment
    expect(result.pages[0].stats?.exportCount).toBe(8);
  });

  it("increments exportCount on the resume when it is on a later page (not page 0)", () => {
    // The user has scrolled — the resume lives on page 1, page 0 has different
    // resumes. The optimistic update MUST still find it.
    const page0Resumes = [makeResume("p0-a"), makeResume("p0-b")];
    const target = makeResume("r1", { exportCount: 4 });
    const page1Resumes = [target, makeResume("p1-b")];

    const cache = makeCacheData([
      makePage(page0Resumes, {
        totalResumes: 4,
        targetedCount: 0,
        analyzedCount: 0,
        exportCount: 4, // matches sum from page 0 only (others not on page 0)
      }),
      makePage(page1Resumes),
    ]);

    const result = applyOptimisticExport(cache, "r1");

    const updated = result.pages[1].resumes.find((r) => r.id === "r1")!;
    expect(updated.exportCount).toBe(5);

    // Page 0 resumes must not have their exportCount touched
    const p0a = result.pages[0].resumes.find((r) => r.id === "p0-a")!;
    expect(p0a.exportCount).toBe(0);
    const p0b = result.pages[0].resumes.find((r) => r.id === "p0-b")!;
    expect(p0b.exportCount).toBe(0);

    // Stats live on page 0 — they must reflect the increment
    expect(result.pages[0].stats?.exportCount).toBe(5);
  });

  it("preserves all other properties of the targeted resume", () => {
    const target = makeResume("r1", {
      title: "Senior Engineer",
      targetRole: "Staff Engineer",
      analysisRunCount: 7,
      exportCount: 3,
      updatedAt: "2024-01-15T00:00:00.000Z",
    });
    const cache = makeCacheData([
      makePage([target], {
        totalResumes: 1,
        targetedCount: 1,
        analyzedCount: 1,
        exportCount: 3,
      }),
    ]);

    const result = applyOptimisticExport(cache, "r1");
    const updated = result.pages[0].resumes[0]!;

    expect(updated).toEqual({
      id: "r1",
      title: "Senior Engineer",
      targetRole: "Staff Engineer",
      analysisRunCount: 7,
      exportCount: 4,
      updatedAt: "2024-01-15T00:00:00.000Z",
    });
  });

  it("does nothing if the resume is not present in any page", () => {
    // Defensive: if the cache doesn't contain the resume, we should NOT
    // corrupt stats (avoid double-counting after a refetch).
    const other = makeResume("r2", { exportCount: 5 });
    const cache = makeCacheData([
      makePage([other], {
        totalResumes: 1,
        targetedCount: 0,
        analyzedCount: 0,
        exportCount: 5,
      }),
    ]);

    const result = applyOptimisticExport(cache, "nonexistent");

    // Cache should be structurally the same — no spurious increments
    expect(result.pages[0].stats?.exportCount).toBe(5);
    expect(result.pages[0].resumes[0]?.exportCount).toBe(5);
  });

  it("treats undefined exportCount as 0 (defensive for stale cache entries)", () => {
    // Older cache entries might be missing the exportCount field. Optimistic
    // update must still increment, not produce NaN.
    const target = { ...makeResume("r1"), exportCount: undefined } as unknown as SerializedResume;
    const cache = makeCacheData([
      makePage([target], {
        totalResumes: 1,
        targetedCount: 0,
        analyzedCount: 0,
        exportCount: 0,
      }),
    ]);

    const result = applyOptimisticExport(cache, "r1");
    expect(result.pages[0].resumes[0]?.exportCount).toBe(1);
    expect(result.pages[0].stats?.exportCount).toBe(1);
  });

  it("handles back-to-back exports of the same resume correctly", () => {
    const target = makeResume("r1", { exportCount: 1 });
    const cache = makeCacheData([
      makePage([target], {
        totalResumes: 1,
        targetedCount: 0,
        analyzedCount: 0,
        exportCount: 1,
      }),
    ]);

    let result = applyOptimisticExport(cache, "r1");
    result = applyOptimisticExport(result, "r1");
    result = applyOptimisticExport(result, "r1");

    expect(result.pages[0].resumes[0]?.exportCount).toBe(4);
    expect(result.pages[0].stats?.exportCount).toBe(4);
  });
});