import { prisma } from "../../../../lib/prisma";
import { requireApiUser } from "../../../../lib/auth";
import { fromStoredResume, parseResumePayload, toStoredResume } from "../../../../lib/resume-store";
import { canUseTemplateByUser, FeatureKeys } from "../../../../lib/entitlements";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resume = await prisma.resumeDocument.findFirst({
    where: { id: await getResumeId(context), userId: user.id }
  });

  if (!resume) return Response.json({ error: "Resume not found" }, { status: 404 });
  return Response.json({ resume: fromStoredResume(resume) });
}

export async function PUT(request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);
  const existing = await prisma.resumeDocument.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!existing) return Response.json({ error: "Resume not found" }, { status: 404 });

  try {
    const payload = parseResumePayload(await request.json());
    const currentResume = fromStoredResume(existing);
    const templateChanged = payload.templateId !== currentResume.templateId;
    const templateAllowed = !templateChanged || await canUseTemplateByUser(user.id, payload.templateId);
    if (!templateAllowed) {
      return Response.json(
        {
          error: "This template requires a paid plan.",
          feature: FeatureKeys.USE_PREMIUM_TEMPLATES,
          upgradeUrl: "/billing",
        },
        { status: 403 },
      );
    }

    const updated = await prisma.resumeDocument.update({
      where: { id: resumeId },
      data: {
        title: payload.title,
        targetRole: payload.targetRole,
        body: toStoredResume({ ...payload, id: resumeId })
      }
    });

    return Response.json({ resume: fromStoredResume(updated) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid resume payload" }, { status: 400 });
  }
}
