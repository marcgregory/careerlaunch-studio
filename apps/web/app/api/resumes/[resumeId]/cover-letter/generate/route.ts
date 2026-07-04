import { prisma } from "../../../../../../lib/prisma";
import { requireApiUser } from "../../../../../../lib/auth";
import { fromStoredResume } from "../../../../../../lib/resume-store";
import { reportError } from "../../../../../../lib/error-reporting";
import { getRequestId } from "../../../../../../lib/request-id";
import { generateCoverLetter } from "@careerlaunch/ai";
import type { CoverLetterDocument } from "@careerlaunch/domain";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * POST /api/resumes/:resumeId/cover-letter/generate
 *
 * Generates a cover letter draft using the AI mock provider,
 * upserts it, and returns the result.
 *
 * Body:
 *   jobDescription (optional): string
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

  const body = await request.json().catch(() => ({})) as { jobDescription?: string };

  try {
    const resume = fromStoredResume(record);
    const generated = generateCoverLetter({
      resume,
      jobDescription: body.jobDescription || undefined,
    });

    // Upsert the generated letter
    const existing = await prisma.coverLetter.findFirst({
      where: { resumeId },
    });

    let coverLetter;
    if (existing) {
      coverLetter = await prisma.coverLetter.update({
        where: { id: existing.id },
        data: {
          body: generated.body,
          salutation: generated.salutation ?? existing.salutation,
          closing: generated.closing ?? existing.closing,
          jobDescription: body.jobDescription ?? existing.jobDescription,
        },
      });
    } else {
      coverLetter = await prisma.coverLetter.create({
        data: {
          userId: user.id,
          resumeId,
          body: generated.body,
          salutation: generated.salutation ?? "Dear Hiring Manager,",
          closing: generated.closing ?? "Sincerely,",
          jobDescription: body.jobDescription ?? null,
        },
      });
    }

    return Response.json({ coverLetter: toCoverLetterDocument(coverLetter) });
  } catch (error) {
    reportError(error, getRequestId(request), { resumeId, route: "cover-letter-generate" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Cover letter generation failed" },
      { status: 500 },
    );
  }
}

function toCoverLetterDocument(record: {
  id: string;
  resumeId: string;
  title: string;
  recipientName: string | null;
  recipientTitle: string | null;
  companyName: string | null;
  companyAddress: string | null;
  salutation: string;
  body: string;
  closing: string;
  signatureName: string | null;
  jobDescription: string | null;
}): CoverLetterDocument {
  return {
    id: record.id,
    resumeId: record.resumeId,
    title: record.title,
    recipientName: record.recipientName ?? "",
    recipientTitle: record.recipientTitle ?? "",
    companyName: record.companyName ?? "",
    companyAddress: record.companyAddress ?? "",
    salutation: record.salutation,
    body: record.body,
    closing: record.closing,
    signatureName: record.signatureName ?? "",
    jobDescription: record.jobDescription ?? "",
  };
}
