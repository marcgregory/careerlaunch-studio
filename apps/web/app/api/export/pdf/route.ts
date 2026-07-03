import { renderResumePdf } from "@careerlaunch/rendering/pdf";
import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { fromStoredResume } from "../../../../lib/resume-store";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { resumeId } = (await request.json().catch(() => ({}))) as { resumeId?: string };
  if (!resumeId) return Response.json({ error: "resumeId is required" }, { status: 400 });

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id }
  });

  if (!record) return Response.json({ error: "Resume not found" }, { status: 404 });

  const exportJob = await prisma.exportJob.create({
    data: {
      resumeId,
      format: "PDF",
      status: "PROCESSING"
    }
  });

  try {
    const resume = fromStoredResume(record);
    const pdf = await renderResumePdf(resume);
    const filename = `${toSafeFilename(resume.title || "resume")}.pdf`;

    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "READY",
        fileUrl: `download:${filename}`
      }
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "PDF render failed"
      }
    });

    return Response.json({ error: "PDF render failed" }, { status: 500 });
  }
}

function toSafeFilename(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "resume"
  );
}



