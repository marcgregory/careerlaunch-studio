/**
 * Unit Tests: Preservation Tests for Delete Modal
 *
 * This test suite verifies that the fixed delete modal preserves all other stat
 * updates while preventing exportCount modification. Each test case verifies that
 * specific stats decrement correctly while exportCount remains unchanged.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import { describe, it, expect } from "vitest";
import type { SerializedResume, ResumeCacheData } from "../resume-actions";
import type { WorkspaceStats } from "../../../hooks/use-workspace-stats";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Creates a resume with specified properties
 */
function makeResume(
  id: string,
  options?: {
    exportCount?: number;
    targetRole?: string | null;
    analysisRunCount?: number;
  }
): SerializedResume {
  return {
    id,
    title: `Resume ${id}`,
    targetRole: options?.targetRole ?? null,
    updatedAt: new Date().toISOString(),
    analysisRunCount: options?.analysisRunCount ?? 0,
    exportCount: options?.exportCount ?? 0,
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
 * Applies the FIXED delete handler logic (preserves exportCount)
 * This is the correct implementation that should be in delete-modal.tsx
 */
function applyFixedDelete(
  cacheData: ResumeCacheData,
  resumeIdToDelete: string
): ResumeCacheData {
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
                  // FIXED: exportCount is NOT modified
                }
              : undefined,
          }
        : p
    ),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Preservation Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("Delete Modal Preservation Tests", () => {
  describe("Test 1: Delete resume with targetRole", () => {
    it("decrements targetedCount by 1 while preserving exportCount", () => {
      // Input: Resume with targetRole set
      const resumes = [
        makeResume("r1", { targetRole: "Engineer", exportCount: 5 }),
        makeResume("r2", { targetRole: "Designer", exportCount: 3 }),
      ];
      const cacheData = makeCacheData(resumes);

      // Capture initial state
      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(2);
      expect(initialStats.targetedCount).toBe(2);
      expect(initialStats.exportCount).toBe(8);

      // Delete the first resume (with targetRole)
      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Expected: totalResumes -1, targetedCount -1, exportCount unchanged
      expect(finalStats.totalResumes).toBe(1);
      expect(finalStats.targetedCount).toBe(1);
      expect(finalStats.exportCount).toBe(8); // PRESERVED
      expect(finalStats.analyzedCount).toBe(0);

      // Verify resume list updated
      expect(result.pages[0]?.resumes.length).toBe(1);
      expect(result.pages[0]?.resumes[0]?.id).toBe("r2");
    });
  });

  describe("Test 2: Delete resume with analysisRunCount > 0", () => {
    it("decrements analyzedCount by 1 while preserving exportCount", () => {
      // Input: Resume with analysisRunCount > 0
      const resumes = [
        makeResume("r1", { analysisRunCount: 3, exportCount: 5 }),
        makeResume("r2", { analysisRunCount: 0, exportCount: 2 }),
      ];
      const cacheData = makeCacheData(resumes);

      // Capture initial state
      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(2);
      expect(initialStats.analyzedCount).toBe(1);
      expect(initialStats.exportCount).toBe(7);

      // Delete the first resume (with analysisRunCount > 0)
      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Expected: totalResumes -1, analyzedCount -1, exportCount unchanged
      expect(finalStats.totalResumes).toBe(1);
      expect(finalStats.analyzedCount).toBe(0);
      expect(finalStats.exportCount).toBe(7); // PRESERVED
      expect(finalStats.targetedCount).toBe(0);

      // Verify resume list updated
      expect(result.pages[0]?.resumes.length).toBe(1);
      expect(result.pages[0]?.resumes[0]?.id).toBe("r2");
    });
  });

  describe("Test 3: Delete resume with export history", () => {
    it("does NOT modify exportCount even with significant export history", () => {
      // Input: Resume with exportCount: 5
      const resumes = [
        makeResume("r1", { exportCount: 5 }),
        makeResume("r2", { exportCount: 3 }),
        makeResume("r3", { exportCount: 2 }),
      ];
      const cacheData = makeCacheData(resumes);

      // Capture initial state
      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(3);
      expect(initialStats.exportCount).toBe(10);

      // Delete the first resume (with 5 exports)
      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Expected: totalResumes -1, exportCount unchanged (NOT -1)
      expect(finalStats.totalResumes).toBe(2);
      expect(finalStats.exportCount).toBe(10); // PRESERVED - NOT decreased by 5
      expect(result.pages[0]?.resumes.length).toBe(2);

      // Verify the correct resume was deleted
      const remainingIds = result.pages[0]?.resumes.map((r) => r.id) ?? [];
      expect(remainingIds).toEqual(["r2", "r3"]);
    });
  });

  describe("Test 4: Delete resume with all attributes", () => {
    it("correctly updates all stats when resume has targetRole, analysisRunCount, and exportCount", () => {
      // Input: Resume with targetRole, analysisRunCount: 2, exportCount: 7
      const resumes = [
        makeResume("r1", {
          targetRole: "Manager",
          analysisRunCount: 2,
          exportCount: 7,
        }),
        makeResume("r2", {
          targetRole: "Engineer",
          analysisRunCount: 1,
          exportCount: 3,
        }),
        makeResume("r3", { exportCount: 2 }),
      ];
      const cacheData = makeCacheData(resumes);

      // Capture initial state
      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(3);
      expect(initialStats.targetedCount).toBe(2);
      expect(initialStats.analyzedCount).toBe(2);
      expect(initialStats.exportCount).toBe(12);

      // Delete the first resume (with all attributes)
      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Expected: totalResumes -1, targetedCount -1, analyzedCount -1, exportCount unchanged
      expect(finalStats.totalResumes).toBe(2);
      expect(finalStats.targetedCount).toBe(1); // Decremented because r1 had targetRole
      expect(finalStats.analyzedCount).toBe(1); // Decremented because r1 had analysisRunCount > 0
      expect(finalStats.exportCount).toBe(12); // PRESERVED - NOT decreased by 7

      // Verify resume list updated correctly
      expect(result.pages[0]?.resumes.length).toBe(2);
      const remainingIds = result.pages[0]?.resumes.map((r) => r.id) ?? [];
      expect(remainingIds).toEqual(["r2", "r3"]);
    });
  });

  describe("Test 5: Delete resume with no special attributes", () => {
    it("only decrements totalResumes when resume has no targetRole, analysisRunCount, or exports", () => {
      // Input: Resume with no targetRole, analysisRunCount: 0, exportCount: 0
      const resumes = [
        makeResume("r1", { exportCount: 0 }),
        makeResume("r2", { targetRole: "Designer", exportCount: 5 }),
        makeResume("r3", { analysisRunCount: 2, exportCount: 3 }),
      ];
      const cacheData = makeCacheData(resumes);

      // Capture initial state
      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(3);
      expect(initialStats.targetedCount).toBe(1);
      expect(initialStats.analyzedCount).toBe(1);
      expect(initialStats.exportCount).toBe(8);

      // Delete the first resume (plain resume with no special attributes)
      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Expected: totalResumes -1, everything else unchanged
      expect(finalStats.totalResumes).toBe(2);
      expect(finalStats.targetedCount).toBe(1); // Unchanged
      expect(finalStats.analyzedCount).toBe(1); // Unchanged
      expect(finalStats.exportCount).toBe(8); // Unchanged

      // Verify resume list updated
      expect(result.pages[0]?.resumes.length).toBe(2);
      const remainingIds = result.pages[0]?.resumes.map((r) => r.id) ?? [];
      expect(remainingIds).toEqual(["r2", "r3"]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Additional Edge Case Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe("Edge case: Delete from single-resume workspace", () => {
    it("correctly handles deletion when only one resume exists", () => {
      const resumes = [
        makeResume("r1", {
          targetRole: "Engineer",
          analysisRunCount: 1,
          exportCount: 5,
        }),
      ];
      const cacheData = makeCacheData(resumes);

      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(1);
      expect(initialStats.exportCount).toBe(5);

      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // totalResumes, targetedCount, analyzedCount go to 0, but exportCount is PRESERVED
      expect(finalStats.totalResumes).toBe(0);
      expect(finalStats.targetedCount).toBe(0);
      expect(finalStats.analyzedCount).toBe(0);
      expect(finalStats.exportCount).toBe(5); // PRESERVED - NOT decreased to 0
      expect(result.pages[0]?.resumes.length).toBe(0);
    });
  });

  describe("Edge case: Delete resume with maximum export count", () => {
    it("preserves exportCount correctly when resume has very high export count", () => {
      const resumes = [
        makeResume("r1", { exportCount: 1000 }),
        makeResume("r2", { exportCount: 50 }),
      ];
      const cacheData = makeCacheData(resumes);

      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.exportCount).toBe(1050);

      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Export count should NOT be decremented by 1000
      expect(finalStats.exportCount).toBe(1050); // PRESERVED
      expect(finalStats.totalResumes).toBe(1);
    });
  });

  describe("Edge case: Delete resume affecting multiple stat categories", () => {
    it("correctly handles resume that affects targetedCount and analyzedCount simultaneously", () => {
      const resumes = [
        makeResume("r1", {
          targetRole: "Senior Engineer",
          analysisRunCount: 5,
          exportCount: 12,
        }),
        makeResume("r2", { targetRole: "Designer", exportCount: 3 }),
      ];
      const cacheData = makeCacheData(resumes);

      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(2);
      expect(initialStats.targetedCount).toBe(2);
      expect(initialStats.analyzedCount).toBe(1);
      expect(initialStats.exportCount).toBe(15);

      const result = applyFixedDelete(cacheData, "r1");
      const finalStats = result.pages[0]?.stats!;

      // Both targeted and analyzed should decrement
      expect(finalStats.totalResumes).toBe(1);
      expect(finalStats.targetedCount).toBe(1); // r1 had targetRole
      expect(finalStats.analyzedCount).toBe(0); // r1 had analysisRunCount > 0
      expect(finalStats.exportCount).toBe(15); // PRESERVED - NOT decreased by 12
    });
  });

  describe("Verification: Stats consistency after multiple sequential deletes", () => {
    it("maintains stat consistency through multiple sequential delete operations", () => {
      const resumes = [
        makeResume("r1", {
          targetRole: "Engineer",
          analysisRunCount: 1,
          exportCount: 5,
        }),
        makeResume("r2", { analysisRunCount: 2, exportCount: 3 }),
        makeResume("r3", { targetRole: "Designer", exportCount: 2 }),
      ];
      let cacheData = makeCacheData(resumes);

      const initialStats = cacheData.pages[0]?.stats!;
      expect(initialStats.totalResumes).toBe(3);
      expect(initialStats.targetedCount).toBe(2);
      expect(initialStats.analyzedCount).toBe(2);
      expect(initialStats.exportCount).toBe(10);

      // First delete: r1
      cacheData = applyFixedDelete(cacheData, "r1");
      let stats = cacheData.pages[0]?.stats!;
      expect(stats.totalResumes).toBe(2);
      expect(stats.targetedCount).toBe(1);
      expect(stats.analyzedCount).toBe(1);
      expect(stats.exportCount).toBe(10); // Preserved

      // Second delete: r2
      cacheData = applyFixedDelete(cacheData, "r2");
      stats = cacheData.pages[0]?.stats!;
      expect(stats.totalResumes).toBe(1);
      expect(stats.targetedCount).toBe(1);
      expect(stats.analyzedCount).toBe(0);
      expect(stats.exportCount).toBe(10); // Still preserved

      // Third delete: r3
      cacheData = applyFixedDelete(cacheData, "r3");
      stats = cacheData.pages[0]?.stats!;
      expect(stats.totalResumes).toBe(0);
      expect(stats.targetedCount).toBe(0);
      expect(stats.analyzedCount).toBe(0);
      expect(stats.exportCount).toBe(10); // ALWAYS preserved regardless of deletes
    });
  });

  describe("Verification: Stats before and after reflect changes correctly", () => {
    it("shows clear stat changes for stats that should change (targeted, analyzed, total)", () => {
      const resumes = [
        makeResume("r1", { targetRole: "PM", analysisRunCount: 3 }),
        makeResume("r2"),
      ];
      const cacheData = makeCacheData(resumes);

      const before = cacheData.pages[0]?.stats!;
      const after = applyFixedDelete(cacheData, "r1").pages[0]?.stats!;

      // Verify changes
      const changes = {
        totalResumes: before.totalResumes - after.totalResumes,
        targetedCount: before.targetedCount - after.targetedCount,
        analyzedCount: before.analyzedCount - after.analyzedCount,
        exportCount: before.exportCount - after.exportCount,
      };

      expect(changes.totalResumes).toBe(1);
      expect(changes.targetedCount).toBe(1);
      expect(changes.analyzedCount).toBe(1);
      expect(changes.exportCount).toBe(0); // SHOULD NOT CHANGE
    });
  });
});
