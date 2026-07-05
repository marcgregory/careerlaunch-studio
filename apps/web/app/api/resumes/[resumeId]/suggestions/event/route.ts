import { prisma } from "../../../../../../lib/prisma";
import { requireApiUser } from "../../../../../../lib/auth";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/suggestions/event
 *
 * Log a lifecycle event for a suggestion (viewed, accepted, rejected, applied).
 * Non-critical path — failures are swallowed silently.
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
    action?: string;
    category?: string;
    analysisRunId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.suggestionId || !body.action || !body.category) {
    return Response.json(
      { error: "suggestionId, action, and category are required" },
      { status: 400 },
    );
  }

  const validActions = ["viewed", "accepted", "rejected", "applied"];
  if (!validActions.includes(body.action)) {
    return Response.json(
      { error: `action must be one of: ${validActions.join(", ")}` },
      { status: 400 },
    );
  }

  // Fire-and-forget
  try {
    await prisma.suggestionEvent.create({
      data: {
        suggestionId: body.suggestionId,
        userId: user.id,
        resumeId,
        action: body.action,
        category: body.category,
        analysisRunId: body.analysisRunId ?? null,
      },
    });
  } catch {
    // Non-critical
  }

  return Response.json({ ok: true });
}
