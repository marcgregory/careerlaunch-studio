import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import { reportError } from "../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../lib/request-id";
import { captureServerEvent } from "../../../../../lib/server-analytics";
import { checkRateLimit } from "../../../../../lib/rate-limit";
import { analyzeResume } from "@careerlaunch/ai";
import { initializeAI } from "../../../../../lib/ai-config";

// Initialize AI providers (idempotent — only runs once)
initializeAI();

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * GET /api/resumes/:resumeId/analyze
 *
 * Runs the full analysis pipeline on a resume and returns the analysis result.
 * Analysis is read-only — the resume document is never modified.
 * Each run is persisted as an AnalysisRun record for reproducibility,
 * analytics, and debugging.
 *
 * Query parameters:
 *   - jobDescription (optional): URL-encoded job description for keyword matching
 */
export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  // Rate limit: 10 analyses per hour per user
  const rl = checkRateLimit(`analyze:${user.id}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  try {
    const resume = fromStoredResume(record);
    const result = await analyzeResume(resume);

    // Persist the analysis run for audit, reproducibility, and history
    await prisma.analysisRun.create({
      data: {
        resumeId,
        type: "full",
        provider: result.metadata.providersUsed.join(","),
        promptVersion: null,
        durationMs: result.metadata.duration,
        overallScore: result.overallScore,
        suggestionCount: result.suggestions.length,
      },
    });

    // Fire server-side analytics event
    captureServerEvent("analysis_run", user.id, {
      resumeId,
      overallScore: result.overallScore,
      suggestionCount: result.suggestions.length,
    });

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
    reportError(error, getRequestId(_request), { resumeId, route: "analyze" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
