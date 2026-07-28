/**
 * Backfill script: Populate User.lifetimeExportCount from existing ExportJob
 * rows that survived resume deletion (i.e. still attached to a non-deleted
 * resume). This handles the case where users exported before the
 * lifetimeExportCount column existed and have surviving ExportJob rows.
 *
 * Exports whose ExportJob rows were cascade-deleted with their resume
 * CANNOT be recovered — they were physically removed when the resume was
 * deleted. Going forward, new exports will be tracked correctly because
 * the export route increments lifetimeExportCount on every success.
 *
 * Usage:
 *   npx tsx scripts/backfill-lifetime-export-count.ts
 */

import { prisma } from "@careerlaunch/web/lib/prisma";

// We import via the workspace path, but if that doesn't resolve, we can
// import prisma directly from the apps/web/lib path.

import { PrismaClient } from "@prisma/client";

async function main() {
  // Use a fresh client to avoid stale generation cache
  const client = new PrismaClient();

  try {
    // ── Get lifetime count from surviving ExportJob rows per user ───────────
    // Aggregate counts per userId through the resume relation. Jobs whose
    // resume was deleted are gone (cascade), so they don't appear here.
    const counts = await client.exportJob.groupBy({
      by: ["resumeId"],
      _count: { id: true },
    });

    // Now we need to map resumeId -> userId to sum per user. We can't do
    // this in a single groupBy because groupBy doesn't allow joins.
    // Fetch all resumes with their userId for the resumeIds we have.
    const resumeIds = counts.map((c) => c.resumeId);
    const resumes = await client.resumeDocument.findMany({
      where: { id: { in: resumeIds } },
      select: { id: true, userId: true },
    });
    const resumeToUser = new Map(resumes.map((r) => [r.id, r.userId]));

    const userCounts = new Map<string, number>();
    for (const c of counts) {
      const userId = resumeToUser.get(c.resumeId);
      if (!userId) continue;
      userCounts.set(userId, (userCounts.get(userId) ?? 0) + c._count.id);
    }

    // ── Apply backfill ──────────────────────────────────────────────────────
    let updated = 0;
    for (const [userId, count] of userCounts) {
      // Only bump if the existing value is lower (don't overwrite a
      // higher counter that was already incremented by new exports).
      const result = await client.user.updateMany({
        where: { id: userId, lifetimeExportCount: { lt: count } },
        data: { lifetimeExportCount: count },
      });
      if (result.count > 0) updated += 1;
    }

    console.log(
      `[backfill] scanned ${userCounts.size} users with surviving exports, ` +
        `updated ${updated} to reflect historical activity.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});