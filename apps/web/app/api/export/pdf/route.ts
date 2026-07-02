import { prisma } from "../../../../lib/prisma";
import { requireApiUser } from "../../../../lib/auth";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { resumeId } = (await request.json().catch(() => ({}))) as { resumeId?: string };
  if (!resumeId) return Response.json({ error: "resumeId is required" }, { status: 400 });

  const resume = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { id: true }
  });

  if (!resume) return Response.json({ error: "Resume not found" }, { status: 404 });

  const exportJob = await prisma.exportJob.create({
    data: {
      resumeId,
      format: "PDF",
      status: "READY"
    }
  });

  return Response.json({ exportJob });
}
