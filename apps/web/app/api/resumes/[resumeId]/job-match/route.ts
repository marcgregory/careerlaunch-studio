import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import {
  runJobMatch,
  normalizeResume,
  registerProvider,
  MockProvider,
} from "@careerlaunch/ai";

// Register the MockProvider on first import (needed by analysis pipeline)
registerProvider("mock", new MockProvider());

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
 *
 * Response:
 *   {
 *     "matchScore": 76,
 *     "missingSkills": ["TypeScript"],
 *     "presentSkills": ["Python"],
 *     "suggestions": [...]
 *   }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

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

    const result = runJobMatch({ resume: normalized, jobDescription });

    // Persist the analysis run for audit and analytics
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

    return Response.json({
      matchScore: result.matchScore,
      missingSkills: result.missingSkills,
      presentSkills: result.presentSkills,
      suggestions: result.suggestions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Job match failed" },
      { status: 500 },
    );
  }
}
