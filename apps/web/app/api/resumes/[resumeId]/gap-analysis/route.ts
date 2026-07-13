import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import { reportError } from "../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../lib/request-id";
import { captureServerEvent } from "../../../../../lib/server-analytics";
import { checkRateLimit } from "../../../../../lib/rate-limit";
import { requireEntitlement, FeatureKeys } from "../../../../../lib/entitlements";
import { recordAnalysisRun } from "../../../../../lib/analysis-run-log";
import { runGapAnalysis, runJobAnalysis, normalizeResume } from "@careerlaunch/ai";
import { initializeAI } from "../../../../../lib/ai-config";

// Initialize AI providers (idempotent)
initializeAI();

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/gap-analysis
 *
 * Runs the full AI tailoring pipeline: job analysis → gap analysis.
 * Returns match score, skill comparison, weak sections, and recommendations.
 *
 * Body:
 *   { "jobDescription": "..." }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const entitlementGate = await requireEntitlement(user.id, FeatureKeys.RUN_JOB_MATCH);
  if (entitlementGate) return entitlementGate;

  const resumeId = await getResumeId(context);

  // Rate limit: 10 gap analyses per hour per user
  const rl = checkRateLimit(`gap-analysis:${user.id}`, 10, 60 * 60 * 1000);
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

  let body: { jobDescription?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobDescription = body.jobDescription?.trim();
  if (!jobDescription) {
    return Response.json({ error: "jobDescription is required" }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const resume = fromStoredResume(record);
    const normalized = normalizeResume(resume);

    // Phase 1: Analyze the job description
    const jobAnalysis = await runJobAnalysis({ jobDescription });

    // Phase 2: Gap analysis
    const gapAnalysis = await runGapAnalysis({
      resume: normalized,
      jobAnalysis,
      jobDescription,
    });

    await recordAnalysisRun({
      resumeId,
      type: "gap_analysis",
      provider: "ai",
      promptVersion: null,
      durationMs: Date.now() - startedAt,
      overallScore: gapAnalysis.matchScore,
      suggestionCount: gapAnalysis.recommendations.length,
    });

    captureServerEvent("gap_analysis_run", user.id, {
      resumeId,
      matchScore: gapAnalysis.matchScore,
      missingSkillsCount: gapAnalysis.missingSkills.length,
    });

    return Response.json({
      jobAnalysis,
      gapAnalysis,
    });
  } catch (error) {
    reportError(error, getRequestId(request), { resumeId, route: "gap-analysis" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Gap analysis failed" },
      { status: 500 },
    );
  }
}
