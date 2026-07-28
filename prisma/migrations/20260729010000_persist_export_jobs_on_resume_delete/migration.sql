-- Persist ExportJob rows when a resume is deleted (rather than cascade-deleting).
-- ────────────────────────────────────────────────────────────────────────────
-- Context: The "PDF Exports" tile on /account/billing shows the user's
-- monthly export count. Today the count is derived from `ExportJob` rows,
-- which are cascade-deleted with the resume. So a user who exports and
-- then deletes the resume sees "0 this month" — which is wrong, because
-- the export DID happen and SHOULD count against quota / billing history.
--
-- Fix:
--   1. Add `userId` to `ExportJob` (snapshotted from the user at creation).
--   2. Make `resumeId` nullable and switch the FK to `ON DELETE SET NULL`.
--      Deleting a resume now orphans the `ExportJob` row instead of
--      deleting it — the `userId` snapshot keeps it queryable for billing
--      and quota purposes (per-resume history still works because the
--      non-null jobs are the ones that joined to a resume).
--
-- Backfill: existing rows have a non-null `resumeId`. We backfill `userId`
-- from the parent resume in a single UPDATE before flipping the constraint.

-- Step 1: add `userId` as nullable for the backfill window.
ALTER TABLE "ExportJob" ADD COLUMN "userId" TEXT;

-- Step 2: backfill `userId` from the parent resume.
UPDATE "ExportJob" ej
SET "userId" = rd."userId"
FROM "ResumeDocument" rd
WHERE ej."resumeId" = rd."id"
  AND ej."userId" IS NULL;

-- Step 3: any remaining nulls are orphan rows (no parent resume). For those
-- we have no `userId` source — delete them; they cannot be reclaimed.
DELETE FROM "ExportJob" WHERE "userId" IS NULL;

-- Step 4: enforce NOT NULL on userId now that backfill is complete.
ALTER TABLE "ExportJob" ALTER COLUMN "userId" SET NOT NULL;

-- Step 5: add the FK with ON DELETE CASCADE (User deletion removes all jobs).
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ExportJob_userId_createdAt_idx" ON "ExportJob"("userId", "createdAt");

-- Step 6: flip resumeId → nullable, and switch its FK to ON DELETE SET NULL.
ALTER TABLE "ExportJob" ALTER COLUMN "resumeId" DROP NOT NULL;

-- Drop the old cascade FK if it exists; recreate as SET NULL.
ALTER TABLE "ExportJob" DROP CONSTRAINT IF EXISTS "ExportJob_resumeId_fkey";
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "ResumeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;