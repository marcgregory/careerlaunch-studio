/**
 * Diagnostic: Compare User.lifetimeExportCount against the actual ExportJob
 * rows in the database. Useful for spotting drift between the denormalised
 * counter and the source of truth.
 *
 * Run with: DATABASE_URL=... npx tsx scripts/check-export-counter-consistency.ts
 *
 * Use the user id (or list) printed in the output to investigate mismatches.
 * If the counter is LOWER than the row count, exports were not bumped. If the
 * counter is HIGHER, jobs were deleted (e.g. cascade from old schema) but
 * the counter kept its value — that's fine, we just can't recover the rows.
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const client = new PrismaClient();

  try {
    const users = await client.user.findMany({
      select: { id: true, email: true, lifetimeExportCount: true },
    });

    for (const user of users) {
      const rowCount = await client.exportJob.count({ where: { userId: user.id } });
      const monthlyCount = await client.exportJob.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          format: "PDF",
        },
      });

      const status =
        rowCount === user.lifetimeExportCount
          ? "OK"
          : rowCount > user.lifetimeExportCount
          ? "UNDER"
          : "OVER";

      console.log(
        `[${status}] user=${user.email} id=${user.id} ` +
          `lifetime=${user.lifetimeExportCount} total_jobs=${rowCount} monthly_jobs=${monthlyCount}`,
      );

      if (status === "UNDER") {
        console.log(
          `  ↳ ${user.lifetimeExportCount} → ${rowCount} (diff +${rowCount - user.lifetimeExportCount}). ` +
            `Likely cause: backfill script was not run, or exports before the column existed were missed.`,
        );
      }
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch((err) => {
  console.error("[check] failed:", err);
  process.exit(1);
});
