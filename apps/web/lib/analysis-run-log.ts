import { prisma } from "./prisma";

type AnalysisRunInput = {
  resumeId: string;
  type: string;
  provider: string;
  promptVersion: string | null;
  durationMs: number;
  overallScore: number | null;
  suggestionCount: number;
};

export async function recordAnalysisRun(data: AnalysisRunInput): Promise<void> {
  try {
    await prisma.analysisRun.create({ data });
  } catch (error) {
    console.warn(
      "[analysis-run] failed to persist analysis run",
      error instanceof Error ? error.message : String(error),
    );
  }
}
