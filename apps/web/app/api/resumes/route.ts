import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/auth";
import { createStarterResume, fromStoredResume, toStoredResume } from "../../../lib/resume-store";
import { can, FeatureKeys } from "../../../lib/entitlements";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumes = await prisma.resumeDocument.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, targetRole: true, updatedAt: true }
  });

  return Response.json({ resumes });
}

export async function POST() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const allowed = await can(user.id, FeatureKeys.RESUME_LIMIT);
  if (!allowed) {
    return Response.json(
      { error: "Resume limit reached.", feature: FeatureKeys.RESUME_LIMIT, upgradeUrl: "/billing" },
      { status: 403 },
    );
  }

  const starter = createStarterResume();
  const resume = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      title: starter.title,
      targetRole: starter.targetRole,
      body: toStoredResume(starter),
      versions: {
        create: {
          body: toStoredResume(starter),
          note: "Initial draft"
        }
      }
    }
  });

  return Response.json({ resume: fromStoredResume(resume) }, { status: 201 });
}
