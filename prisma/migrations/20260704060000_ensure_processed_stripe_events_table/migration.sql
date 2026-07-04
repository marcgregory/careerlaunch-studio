-- Idempotent follow-up migration: create ProcessedStripeEvent if missing
-- The original migration (20260704050000) was recorded in _prisma_migrations
-- but the table may not exist in some environments.
CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_createdAt_idx"
ON "ProcessedStripeEvent"("createdAt");
