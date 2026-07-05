-- AlterTable
ALTER TABLE "AnalysisRun" ADD COLUMN     "acceptedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "appliedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SuggestionFeedback" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "analysisRunId" TEXT,
    "category" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "reasonText" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionEvent" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "analysisRunId" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestionFeedback_resumeId_idx" ON "SuggestionFeedback"("resumeId");

-- CreateIndex
CREATE INDEX "SuggestionFeedback_userId_createdAt_idx" ON "SuggestionFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SuggestionEvent_analysisRunId_idx" ON "SuggestionEvent"("analysisRunId");

-- CreateIndex
CREATE INDEX "SuggestionEvent_userId_createdAt_idx" ON "SuggestionEvent"("userId", "createdAt");
