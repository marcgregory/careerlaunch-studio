import { prisma } from "../../../../../../lib/prisma";
import { requireApiUser } from "../../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../../lib/resume-store";
import { applyChanges, ApplyError } from "@careerlaunch/ai";
import type { ApplyOperation } from "@careerlaunch/ai";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/suggestions/apply
 *
 * Applies one or more safe operations to the resume document.
 * All mutation logic lives in packages/ai/apply — this route is a thin
 * authentication + persistence wrapper.
 *
 * Body: { operations: ApplyOperation[] }
 *
 * Responses:
 *   200 — { updatedResume: ResumeDocument, appliedChanges: AppliedChange[] }
 *   400 — { error: string } — invalid payload
 *   401 — { error: string } — not authenticated
 *   404 — { error: string } — resume not found
 *   409 — { error: string } — stale target (ApplyError)
 */
export async function POST(request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  let body: { operations?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.operations) || body.operations.length === 0) {
    return Response.json({ error: "operations must be a non-empty array" }, { status: 400 });
  }

  const operations = body.operations as ApplyOperation[];

  const resume = fromStoredResume(record);

  let result;
  try {
    result = applyChanges(resume, operations);
  } catch (error) {
    if (error instanceof ApplyError) {
      return Response.json(
        { error: error.message, reason: error.reason, operation: error.operation },
        { status: 409 },
      );
    }
    throw error;
  }

  // Persist the updated resume
  try {
    await prisma.resumeDocument.update({
      where: { id: resumeId },
      data: {
        body: toStoredResume(result.updatedResume),
      },
    });
  } catch {
    return Response.json(
      { error: "Failed to save updated resume" },
      { status: 500 },
    );
  }

  return Response.json({
    updatedResume: result.updatedResume,
    appliedChanges: result.appliedChanges,
  });
}
