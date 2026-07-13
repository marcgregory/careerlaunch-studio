import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../lib/resume-store";
import { can, FeatureKeys } from "../../../../../lib/entitlements";

export async function POST(
  _request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const allowed = await can(user.id, FeatureKeys.RESUME_LIMIT);
  if (!allowed) {
    return Response.json(
      { error: "Resume limit reached.", feature: FeatureKeys.RESUME_LIMIT, upgradeUrl: "/billing" },
      { status: 403 },
    );
  }

  const { resumeId } = await context.params;

  const original = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!original) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  const originalResume = fromStoredResume(original);
  const duplicatedResume = {
    ...originalResume,
    id: "pending-duplicate",
    title: `Copy of ${original.title}`,
    targetRole: original.targetRole ?? originalResume.targetRole,
  };

  const duplicated = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      title: duplicatedResume.title,
      targetRole: original.targetRole,
      body: toStoredResume(duplicatedResume),
      versions: {
        create: {
          body: toStoredResume(duplicatedResume),
          note: `Duplicated from ${resumeId}`,
        },
      },
    },
  });

  return Response.json(
    { resume: fromStoredResume(duplicated) },
    { status: 201 },
  );
}
