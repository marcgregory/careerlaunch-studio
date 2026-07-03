-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "resumeVersionId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "promptVersion" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION,
    "suggestionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisRun_resumeId_createdAt_idx" ON "AnalysisRun"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_resumeId_type_idx" ON "AnalysisRun"("resumeId", "type");

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "ResumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
