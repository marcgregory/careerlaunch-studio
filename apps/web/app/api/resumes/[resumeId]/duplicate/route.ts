import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../lib/resume-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { resumeId } = await context.params;

  const original = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!original) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  const originalResume = fromStoredResume(original);

  const duplicated = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      title: `Copy of ${original.title}`,
      targetRole: original.targetRole,
      body: toStoredResume(originalResume),
      versions: {
        create: {
          body: toStoredResume(originalResume),
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
