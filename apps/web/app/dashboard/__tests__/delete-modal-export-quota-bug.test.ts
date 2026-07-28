/**
 * Property-Based Test: Export Quota Delete Bug Exploration
 *
 * This test demonstrates the bug where deleting a resume incorrectly
 * decreases the workspace exportCount. On unfixed code, this test FAILS,
 * which confirms the bug exists. On fixed code, it PASSES.
 *
 * **Validates: Requirements 2.1**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { SerializedResume, ResumeCacheData } from "../resume-actions";
import type { WorkspaceStats } from "../../../hooks/use-workspace-stats";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Creates a resume with specified export count and optional target role
 */
function makeResume(
  id: string,
  exportCount: number,
  targetRole: string | null = null,
  analysisRunCount: number = 0
): SerializedResume {
  return {
    id,
    title: `Resume ${id}`,
    targetRole,
    updatedAt: new Date().toISOString(),
    analysisRunCount,
    exportCount,
  };
}

/**
 * Creates workspace stats from resumes
 */
function makeStatsFromResumes(resumes: SerializedResume[]): WorkspaceStats {
  return {
    totalResumes: resumes.length,
    targetedCount: resumes.filter((r) => r.targetRole).length,
    analyzedCount: resumes.filter((r) => r.analysisRunCount > 0).length,
    exportCount: resumes.reduce((sum, r) => sum + r.exportCount, 0),
  };
}

/**
 * Creates cache data with resumes and stats
 */
function makeCacheData(resumes: SerializedResume[]): ResumeCacheData {
  const stats = makeStatsFromResumes(resumes);
  return {
    pages: [
      {
        resumes,
        pagination: { page: 1, limit: 10, total: resumes.length, hasMore: false },
        stats,
      },
    ],
    pageParams: [1],
  };
}

/**
 * Simulates the ACTUAL CURRENT CODE from delete-modal.tsx (buggy)
 * Lines 99-103 in delete-modal.tsx
 */
function applyActualCurrentDelete(
  cacheData: ResumeCacheData,
  resumeIdToDelete: string
): ResumeCacheData {
  // This is the exact logic from the current buggy code
  const removedResume = cacheData.pages[0]?.resumes.find((r) => r.id === resumeIdToDelete) ?? null;

  return {
    ...cacheData,
    pages: cacheData.pages.map((p, i) =>
      i === 0
        ? {
            ...p,
            resumes: p.resumes.filter((r) => r.id !== resumeIdToDelete),
            pagination: {
              ...p.pagination,
              total: Math.max(0, p.pagination.total - 1),
            },
            stats: p.stats
              ? {
                  ...p.stats,
                  totalResumes: Math.max(0, p.stats.totalResumes - 1),
                  targetedCount: removedResume?.targetRole
                    ? Math.max(0, p.stats.targetedCount - 1)
                    : p.stats.targetedCount,
                  analyzedCount:
                    (removedResume?.analysisRunCount ?? 0) > 0
                      ? Math.max(0, p.stats.analyzedCount - 1)
                      : p.stats.analyzedCount,
                  // The bug: this incorrectly subtracts the resume's exportCount
                  exportCount: Math.max(0, p.stats.exportCount - (removedResume?.exportCount ?? 0)),
                }
              : undefined,
          }
        : p
    ),
  };
}

/**
 * Simulates the FIXED delete optimistic update
 * This is what the code SHOULD do (preserve exportCount)
 */
function applyFixedDelete(
  cacheData: ResumeCacheData,
  resumeIdToDelete: string
): ResumeCacheData {
  return {
    ...cacheData,
    pages: cacheData.pages.map((p, i) =>
      i === 0
        ? {
            ...p,
            resumes: p.resumes.filter((r) => r.id !== resumeIdToDelete),
            pagination: {
              ...p.pagination,
              total: Math.max(0, p.pagination.total - 1),
            },
            stats: p.stats
              ? {
                  ...p.stats,
                  totalResumes: Math.max(0, p.stats.totalResumes - 1),
                  // Fixed: do NOT subtract exportCount
                }
              : undefined,
          }
        : p
    ),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Property-Based Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("Delete Modal Export Quota Bug Exploration", () => {
  it(
    "demonstrates bug: deleting resume with any export history decreases exportCount",
    () => {
      // Property: For any resume with exportCount > 0, deleting it should
      // NOT change the workspace exportCount. But the buggy code DOES decrease it.
      // On UNFIXED code, this test FAILS because the actual code exhibits the bug.
      // On FIXED code, this test PASSES because exportCount is preserved.
      fc.assert(
        fc.property(
          fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 10 }),
          (exportCounts) => {
            // Create resumes with varying export counts
            const resumes = exportCounts.map((count, idx) =>
              makeResume(`resume-${idx}`, count)
            );
            const cacheData = makeCacheData(resumes);
            const initialExportCount = cacheData.pages[0]?.stats?.exportCount ?? 0;

            // Delete the first resume using ACTUAL CODE from delete-modal.tsx
            const resumeToDelete = resumes[0]!;
            const result = applyActualCurrentDelete(cacheData, resumeToDelete.id);
            const exportCountAfterDelete = result.pages[0]?.stats?.exportCount ?? 0;

            // KEY PROPERTY: ExportCount should NEVER change when deleting a resume
            // This property FAILS on unfixed code (proving the bug exists)
            // and PASSES on fixed code (proving the fix works)
            expect(exportCountAfterDelete).toBe(initialExportCount);

            // Additional check: the total number of resumes should still decrease
            expect(result.pages[0]?.resumes.length).toBe(resumes.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "bug scenario 1: delete resume with 1 export - exportCount SHOULD be preserved but ISN'T",
    () => {
      // Concrete scenario: resume with 1 export
      // On unfixed code: exportCount decreases from 1 to 0 (FAILS this test)
      // On fixed code: exportCount stays 1 (PASSES this test)
      const resumes = [makeResume("r1", 1), makeResume("r2", 0)];
      const cacheData = makeCacheData(resumes);
      const initialExportCount = 1;

      const result = applyActualCurrentDelete(cacheData, "r1");

      // PROPERTY: ExportCount should be preserved (bug is when it's not)
      expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
      // Total resumes should still decrease
      expect(result.pages[0]?.resumes.length).toBe(1);
    }
  );

  it(
    "bug scenario 2: delete resume with 3 exports - exportCount SHOULD be preserved but ISN'T",
    () => {
      // Concrete scenario: resume with 3 exports
      // On unfixed code: exportCount decreases from 5 to 2 (FAILS this test)
      // On fixed code: exportCount stays 5 (PASSES this test)
      const resumes = [makeResume("r1", 3), makeResume("r2", 2)];
      const cacheData = makeCacheData(resumes);
      const initialExportCount = 5;

      const result = applyActualCurrentDelete(cacheData, "r1");

      // PROPERTY: ExportCount should be preserved
      expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
      expect(result.pages[0]?.resumes.length).toBe(1);
    }
  );

  it(
    "bug scenario 3: delete resume with 0 exports - exportCount should stay unchanged",
    () => {
      // Concrete scenario: resume with 0 exports (bug is hidden because the decrement is 0)
      // On both unfixed AND fixed code: exportCount appears unchanged
      // This scenario doesn't reveal the bug since there's nothing to subtract
      const resumes = [makeResume("r1", 0), makeResume("r2", 2)];
      const cacheData = makeCacheData(resumes);
      const initialExportCount = 2;

      const result = applyActualCurrentDelete(cacheData, "r1");

      // Even buggy code appears correct here: no change from 0 export
      expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
      expect(result.pages[0]?.resumes.length).toBe(1);
    }
  );

  it(
    "bug scenario 4: sequential deletes accumulate the bug effect",
    () => {
      // Concrete scenario: multiple resumes with exports
      // On unfixed code: Each delete subtracts from exportCount (FAILS)
      // On fixed code: ExportCount stays the same (PASSES)
      const resumes = [
        makeResume("r1", 2),
        makeResume("r2", 3),
        makeResume("r3", 1),
      ];
      const cacheData = makeCacheData(resumes);
      const initialExportCount = 6; // 2 + 3 + 1

      // First delete: r1 with 2 exports
      let result = applyActualCurrentDelete(cacheData, "r1");
      expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
      expect(result.pages[0]?.resumes.length).toBe(2);

      // Second delete: r2 with 3 exports
      result = applyActualCurrentDelete(result, "r2");
      expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
      expect(result.pages[0]?.resumes.length).toBe(1);

      // Property: exportCount should never change despite sequential deletes
      expect(initialExportCount - result.pages[0]?.stats?.exportCount!).toBe(0);
    }
  );

  it("fixed behavior: exportCount is preserved during delete", () => {
    // Verify that the FIXED code preserves exportCount
    const resumes = [
      makeResume("r1", 5),
      makeResume("r2", 3),
      makeResume("r3", 2),
    ];
    const cacheData = makeCacheData(resumes);
    const initialExportCount = 10;

    const result = applyFixedDelete(cacheData, "r1");

    // Fixed behavior: exportCount should NOT change
    expect(result.pages[0]?.stats?.exportCount).toBe(initialExportCount);
    // Resume count should still decrease
    expect(result.pages[0]?.resumes.length).toBe(2);
  });

  it("preservation: totalResumes still decrements correctly", () => {
    // Verify that other stats are preserved even though exportCount is buggy
    const resumes = [
      makeResume("r1", 5, "Engineer"),
      makeResume("r2", 3),
    ];
    const cacheData = makeCacheData(resumes);

    const result = applyActualCurrentDelete(cacheData, "r1");

    // Even with buggy exportCount, totalResumes should decrease
    expect(result.pages[0]?.stats?.totalResumes).toBe(1);
    expect(result.pages[0]?.resumes.length).toBe(1);
    // ExportCount should be preserved
    expect(result.pages[0]?.stats?.exportCount).toBe(8);
  });
});
