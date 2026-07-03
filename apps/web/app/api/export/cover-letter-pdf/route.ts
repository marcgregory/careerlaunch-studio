import { renderCoverLetterPdf } from "@careerlaunch/rendering/cover-letter-pdf";
import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { fromStoredResume } from "../../../../lib/resume-store";
import type { CoverLetterDocument } from "@careerlaunch/domain";

/**
 * POST /api/export/cover-letter-pdf
 *
 * Generates and returns a PDF of a cover letter.
 *
 * Body:
 *   coverLetterId: string
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { coverLetterId } = (await request.json().catch(() => ({}))) as { coverLetterId?: string };
  if (!coverLetterId) {
    return Response.json({ error: "coverLetterId is required" }, { status: 400 });
  }

  const coverLetterRecord = await prisma.coverLetter.findFirst({
    where: { id: coverLetterId, userId: user.id },
  });

  if (!coverLetterRecord) {
    return Response.json({ error: "Cover letter not found" }, { status: 404 });
  }

  const resumeRecord = await prisma.resumeDocument.findFirst({
    where: { id: coverLetterRecord.resumeId, userId: user.id },
  });

  if (!resumeRecord) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  try {
    const resume = fromStoredResume(resumeRecord);
    const coverLetter: CoverLetterDocument = {
      id: coverLetterRecord.id,
      resumeId: coverLetterRecord.resumeId,
      title: coverLetterRecord.title,
      recipientName: coverLetterRecord.recipientName ?? "",
      recipientTitle: coverLetterRecord.recipientTitle ?? "",
      companyName: coverLetterRecord.companyName ?? "",
      companyAddress: coverLetterRecord.companyAddress ?? "",
      salutation: coverLetterRecord.salutation,
      body: coverLetterRecord.body,
      closing: coverLetterRecord.closing,
      signatureName: coverLetterRecord.signatureName ?? "",
      jobDescription: coverLetterRecord.jobDescription ?? "",
    };

    const pdf = await renderCoverLetterPdf(coverLetter, resume);
    const filename = `cover-letter-${toSafeFilename(resume.title || "resume")}.pdf`;

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "PDF render failed" },
      { status: 500 },
    );
  }
}

function toSafeFilename(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cover-letter"
  );
}
