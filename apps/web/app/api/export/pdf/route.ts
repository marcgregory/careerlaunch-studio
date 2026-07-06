import { renderResumePdf, resumeToHtml, type PdfOptions } from "@careerlaunch/rendering/pdf";
import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { fromStoredResume } from "../../../../lib/resume-store";
import { getRequestId } from "../../../../lib/request-id";
import { reportError } from "../../../../lib/error-reporting";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { canExportPdf, getPdfExportKind } from "../../../../lib/entitlements";
import { captureServerEvent } from "../../../../lib/server-analytics";

const RENDERER_URL = process.env.PDF_RENDERER_URL;
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  // Rate limit: 20 PDF exports per hour per user
  const rl = checkRateLimit(`export:${user.id}`, 20, 60 * 60 * 1000);
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
      { status: 402 },
    );
  }

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
    const filename = `${toSafeFilename(resume.title || "resume")}.pdf`;

    // Determine watermark based on plan
    const exportKind = await getPdfExportKind(user.id);
    const pdfOptions: PdfOptions = { watermarked: exportKind === "watermarked" };

    let pdf: ArrayBuffer;

    if (RENDERER_URL) {
      // Production: proxy to the external Docker PDF renderer service
      const html = resumeToHtml(resume, pdfOptions);
      const requestId = getRequestId(request);

      const res = await fetch(RENDERER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(RENDERER_TOKEN ? { Authorization: `Bearer ${RENDERER_TOKEN}` } : {}),
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({ html, watermarked: pdfOptions.watermarked }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "unknown");
        throw new Error(`PDF renderer returned ${res.status}: ${errBody}`);
      }

      pdf = await res.arrayBuffer();
    } else {
      // Local dev: use in-process Playwright renderer
      pdf = await renderResumePdf(resume, pdfOptions);
    }

    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "READY",
        fileUrl: `download:${filename}`
      }
    });

    // ── Funnel: pdf_exported (server-side) ──
    captureServerEvent("pdf_exported", user.id, {
      resumeId,
      templateId: resume.templateId,
      exportKind,
      fileSize: pdf.byteLength,
      title: resume.title,
      sectionCount: (resume.sectionOrder ?? []).length,
      experienceCount: (resume.experience ?? []).length,
      educationCount: (resume.education ?? []).length,
      skillsCount: (resume.skills ?? []).length,
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
    const requestId = getRequestId(request);
    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "PDF render failed"
      }
    });

    reportError(error, requestId, { resumeId, route: "export-pdf" });
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
