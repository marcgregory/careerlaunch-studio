-- AlterTable: Add lifetimeExportCount to User
-- ────────────────────────────────────────────────────────────────────────────
-- Lifetime PDF export count across all of this user's resumes — past AND
-- present. Incremented on every successful PDF export. NEVER decremented
-- when a resume is deleted (deleting a resume does not un-make the exports
-- that already happened). The dashboard "Exports" tile reads this so the
-- count survives resume deletion. Per-resume export history is still
-- derived from ExportJob.resumeId.
ALTER TABLE "User" ADD COLUMN     "lifetimeExportCount" INTEGER NOT NULL DEFAULT 0;