import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import { analyzeResume, registerProvider, MockProvider } from "@careerlaunch/ai";

// Register the MockProvider on first import
registerProvider("mock", new MockProvider());

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * GET /api/resumes/:resumeId/analyze
 *
 * Runs the full analysis pipeline on a resume and returns the analysis result.
 * Analysis is read-only — the resume document is never modified.
 *
 * Query parameters:
 *   - jobDescription (optional): URL-encoded job description for keyword matching
 */
export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  try {
    const resume = fromStoredResume(record);
    const result = await analyzeResume(resume);

    return Response.json({
      result: {
        resumeId: result.resumeId,
        analyzedAt: result.analyzedAt,
        overallScore: result.overallScore,
        suggestions: result.suggestions,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
