import { prisma } from "../../../../../../lib/prisma";
import { requireApiUser } from "../../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../../lib/resume-store";
import { reportError } from "../../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../../lib/request-id";
import { checkRateLimit } from "../../../../../../lib/rate-limit";
import { applyChanges, ApplyError, normalizeResume, createOperations } from "@careerlaunch/ai";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/suggestions/apply-bulk
 *
 * Apply multiple suggestions at once. Each suggestion is mapped to operations
 * via the operation factory, then applied via the apply engine.
 * Returns per-suggestion results — partial success is possible.
 *
 * Body:
 *   { "suggestions": Suggestion[] }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  const rl = checkRateLimit(`apply-bulk:${user.id}`, 30, 60 * 60 * 1000);
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

  let body: { suggestions?: Array<unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const suggestions = body.suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return Response.json({ error: "suggestions array is required" }, { status: 400 });
  }

  try {
    const resume = fromStoredResume(record);
    const normalized = normalizeResume(resume);

    // Map all suggestions to operations
    const allOperations = [];
    for (const suggestion of suggestions) {
      const ops = createOperations(suggestion as any, normalized);
      if (ops) {
        allOperations.push(...ops);
      }
    }

    if (allOperations.length === 0) {
      return Response.json({
        updatedResume: resume,
        appliedChanges: [],
        results: suggestions.map(() => ({ applied: false, error: "No applicable operations" })),
      });
    }

    // Apply all operations at once (the apply engine handles ordering)
    const result = applyChanges(resume, allOperations);

    // Persist the updated resume
    await prisma.resumeDocument.update({
      where: { id: resumeId },
      data: {
        body: toStoredResume(result.updatedResume),
        updatedAt: new Date(),
      },
    });

    return Response.json({
      updatedResume: result.updatedResume,
      appliedChanges: result.appliedChanges,
    });
  } catch (error) {
    if (error instanceof ApplyError) {
      return Response.json(
        { error: error.message, operation: error.operation },
        { status: 409 },
      );
    }
    reportError(error, getRequestId(request), { resumeId, route: "apply-bulk" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to apply suggestions" },
      { status: 500 },
    );
  }
}
