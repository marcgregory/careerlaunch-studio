import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import { reportError } from "../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../lib/request-id";
import { captureServerEvent } from "../../../../../lib/server-analytics";
import { checkRateLimit } from "../../../../../lib/rate-limit";
import { requireEntitlement, FeatureKeys } from "../../../../../lib/entitlements";
import {
  runJobMatch,
  normalizeResume,
} from "@careerlaunch/ai";
import { initializeAI } from "../../../../../lib/ai-config";

// Initialize AI providers (idempotent — only runs once)
initializeAI();

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/job-match
 *
 * Compares the user's resume against a pasted job description.
 * Returns a match score, missing/present skills, and actionable suggestions.
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

  // Rate limit: 20 job matches per hour per user
  const rl = checkRateLimit(`job-match:${user.id}`, 20, 60 * 60 * 1000);
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
    return Response.json(
      { error: "jobDescription is required" },
      { status: 400 },
    );
  }

  try {
    const startedAt = Date.now();
    const resume = fromStoredResume(record);
    const normalized = normalizeResume(resume);

    const result = await runJobMatch({ resume: normalized, jobDescription });

    await prisma.analysisRun.create({
      data: {
        resumeId,
        type: "job_match",
        provider: "static",
        promptVersion: null,
        durationMs: Date.now() - startedAt,
        overallScore: result.matchScore,
        suggestionCount: result.suggestions.length,
      },
    });

    captureServerEvent("job_match_run", user.id, {
      resumeId,
      matchScore: result.matchScore,
      missingSkillsCount: result.missingSkills.length,
      suggestionsCount: result.suggestions.length,
    });

    return Response.json({
      matchScore: result.matchScore,
      missingSkills: result.missingSkills,
      presentSkills: result.presentSkills,
      suggestions: result.suggestions,
    });
  } catch (error) {
    reportError(error, getRequestId(request), { resumeId, route: "job-match" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Job match failed" },
      { status: 500 },
    );
  }
}
