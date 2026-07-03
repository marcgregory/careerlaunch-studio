import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume } from "../../../../../lib/resume-store";
import type { CoverLetterDocument } from "@careerlaunch/domain";

async function getResumeId(context: { params: Promise<{ resumeId: string }> }) {
  const params = await context.params;
  return params.resumeId;
}

/**
 * GET /api/resumes/:resumeId/cover-letter
 *
 * Returns the existing cover letter for this resume, or null if none exists.
 */
export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  const coverLetter = await prisma.coverLetter.findFirst({
    where: { resumeId },
  });

  return Response.json({ coverLetter: coverLetter ? toCoverLetterDocument(coverLetter) : null });
}

/**
 * PUT /api/resumes/:resumeId/cover-letter
 *
 * Upserts the cover letter for this resume.
 */
export async function PUT(request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumeId = await getResumeId(context);

  const record = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!record) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<CoverLetterDocument>;

  const coverLetter = await prisma.coverLetter.upsert({
    where: { id: body.id ?? "" },
    create: {
      userId: user.id,
      resumeId,
      title: body.title ?? "Cover Letter",
      recipientName: body.recipientName ?? null,
      recipientTitle: body.recipientTitle ?? null,
      companyName: body.companyName ?? null,
      companyAddress: body.companyAddress ?? null,
      salutation: body.salutation ?? "Dear Hiring Manager,",
      body: body.body ?? "",
      closing: body.closing ?? "Sincerely,",
      signatureName: body.signatureName ?? null,
      jobDescription: body.jobDescription ?? null,
    },
    update: {
      title: body.title,
      recipientName: body.recipientName,
      recipientTitle: body.recipientTitle,
      companyName: body.companyName,
      companyAddress: body.companyAddress,
      salutation: body.salutation,
      body: body.body,
      closing: body.closing,
      signatureName: body.signatureName,
      jobDescription: body.jobDescription,
    },
  });

  return Response.json({ coverLetter: toCoverLetterDocument(coverLetter) });
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
