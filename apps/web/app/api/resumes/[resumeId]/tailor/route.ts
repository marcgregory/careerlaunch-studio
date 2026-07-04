import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import { reportError } from "../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../lib/request-id";
import { checkRateLimit } from "../../../../../lib/rate-limit";
import { requireEntitlement, FeatureKeys } from "../../../../../lib/entitlements";
import { runTailoring, runJobAnalysis, runGapAnalysis, normalizeResume } from "@careerlaunch/ai";
import { initializeAI } from "../../../../../lib/ai-config";

initializeAI();

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/tailor
 *
 * Runs the full AI tailoring pipeline: job analysis → gap analysis → tailoring.
 * Returns before/after rewrite suggestions for summary, experience bullets, and skills.
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

  // Rate limit: 10 tailor runs per hour per user
  const rl = checkRateLimit(`tailor:${user.id}`, 10, 60 * 60 * 1000);
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
    const resume = fromStoredResume(record);
    const normalized = normalizeResume(resume);

    // Phase 1: Analyze job
    const jobAnalysis = await runJobAnalysis({ jobDescription });

    // Phase 2: Gap analysis
    const gapAnalysis = await runGapAnalysis({
      resume: normalized,
      jobAnalysis,
      jobDescription,
    });

    // Phase 3: Tailoring
    const suggestions = await runTailoring({
      resume: normalized,
      jobAnalysis,
      gapAnalysis,
    });

    return Response.json({ suggestions });
  } catch (error) {
    reportError(error, getRequestId(request), { resumeId, route: "tailor" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Tailoring failed" },
      { status: 500 },
    );
  }
}
