import {
  renderCoverLetterPdf,
  coverLetterToHtml,
} from "@careerlaunch/rendering/cover-letter-pdf";
import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { fromStoredResume } from "../../../../lib/resume-store";
import { getRequestId } from "../../../../lib/request-id";
import { reportError } from "../../../../lib/error-reporting";
import { checkRateLimit } from "../../../../lib/rate-limit";
import type { CoverLetterDocument } from "@careerlaunch/domain";
import { canExportPdf, getPdfExportKind } from "../../../../lib/entitlements";

const RENDERER_URL = process.env.PDF_RENDERER_URL;
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;

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

  // Rate limit: 20 cover letter PDF exports per hour per user
  const rl = checkRateLimit(`cover-letter-export:${user.id}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // Entitlement check: monthly export limit
  const exportCheck = await canExportPdf(user.id);
  if (!exportCheck.allowed) {
    return Response.json(
      { error: "Monthly export limit reached. Upgrade to Professional for unlimited exports.", upgradeUrl: "/billing" },
      { status: 403 },
    );
  }

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

    const filename = `cover-letter-${toSafeFilename(resume.title || "resume")}.pdf`;
    let pdf: ArrayBuffer;

    if (RENDERER_URL) {
      // Production: proxy to the external Docker PDF renderer service
      const html = coverLetterToHtml(coverLetter, resume);
      const requestId = getRequestId(request);

      const res = await fetch(RENDERER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(RENDERER_TOKEN ? { Authorization: `Bearer ${RENDERER_TOKEN}` } : {}),
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({ html }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "unknown");
        throw new Error(`PDF renderer returned ${res.status}: ${errBody}`);
      }

      pdf = await res.arrayBuffer();
    } else {
      // Local dev: use in-process Playwright renderer
      pdf = await renderCoverLetterPdf(coverLetter, resume);
    }

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
    const requestId = getRequestId(request);
    reportError(error, requestId, {
      coverLetterId,
      route: "export-cover-letter-pdf",
    });
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
