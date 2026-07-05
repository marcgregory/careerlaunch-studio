import { prisma } from "../../../../../../lib/prisma";
import { requireApiUser } from "../../../../../../lib/auth";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/suggestions/feedback
 *
 * Submit user feedback on an AI suggestion.
 * This is a non-critical path — all feedback is best-effort.
 * Route should never affect the user's ability to continue.
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
    select: { id: true },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  let body: {
    suggestionId?: string;
    helpful?: boolean;
    reason?: string;
    reasonText?: string;
    category?: string;
    provider?: string;
    model?: string;
    promptVersion?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.suggestionId || typeof body.helpful !== "boolean") {
    return Response.json(
      { error: "suggestionId and helpful are required" },
      { status: 400 },
    );
  }

  // Fire-and-forget: catch any DB errors silently
  try {
    await prisma.suggestionFeedback.create({
      data: {
        suggestionId: body.suggestionId,
        userId: user.id,
        resumeId,
        category: body.category ?? "unknown",
        helpful: body.helpful,
        reason: body.reason ?? null,
        reasonText: body.reasonText ?? null,
        provider: body.provider ?? null,
        model: body.model ?? null,
        promptVersion: body.promptVersion ?? null,
      },
    });
  } catch {
    // Non-critical — swallow DB errors
  }

  return Response.json({ ok: true });
}
