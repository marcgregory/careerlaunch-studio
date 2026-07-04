-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Convert existing userId index to unique constraint (one subscription per user)
DROP INDEX IF EXISTS "Subscription_userId_idx";
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
