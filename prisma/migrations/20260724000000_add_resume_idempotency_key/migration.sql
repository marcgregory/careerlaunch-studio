-- Add nullable idempotencyKey to ResumeDocument for duplicate-request idempotency.
-- The column is NULL for all existing resumes. A unique index on (userId, idempotencyKey)
-- lets the duplicate route detect and short-circuit replayed requests without creating
-- a second copy of the resume.

ALTER TABLE "ResumeDocument"
  ADD COLUMN "idempotencyKey" TEXT;

-- NULL values are excluded from uniqueness checks in PostgreSQL, so existing rows
-- (all NULL) do not violate this constraint.
CREATE UNIQUE INDEX "ResumeDocument_userId_idempotencyKey_key"
  ON "ResumeDocument"("userId", "idempotencyKey");
