import { renderResumePdf, resumeToHtml, type PdfOptions } from "@careerlaunch/rendering/pdf";
import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { fromStoredResume } from "../../../../lib/resume-store";
import { getRequestId } from "../../../../lib/request-id";
import { reportError } from "../../../../lib/error-reporting";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { canExportPdf, getPdfExportKind } from "../../../../lib/entitlements";
import { captureServerEvent } from "../../../../lib/server-analytics";
import { pdfRendererErrorResponse, renderHtmlToPdfViaRenderer } from "../../../../lib/pdf-renderer-client";

const RENDERER_URL = process.env.PDF_RENDERER_URL;
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;

export const maxDuration = 60;

// ── In-memory PDF cache (cleared on server restart) ──
// Key: `${resumeId}:${updatedAt}:${templateId}:${watermarked}`
// Value: { pdf: ArrayBuffer; cachedAt: number }
const pdfCache = new Map<string, { pdf: ArrayBuffer; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(resumeId: string, updatedAt: Date, templateId: string, watermarked: boolean): string {
  return `${resumeId}:${updatedAt.getTime()}:${templateId}:${watermarked}`;
}

export async function POST(request: Request) {
  const startTotal = Date.now();
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

  // Entitlement check: monthly export limit. The `reason` query tells the
  // billing page which banner to show — without it, the user lands on
  // /billing with no idea why they were redirected.
  const exportCheck = await canExportPdf(user.id);
  if (!exportCheck.allowed) {
    return Response.json(
      {
        error: "Monthly export limit reached. Upgrade to Professional for unlimited exports.",
        upgradeUrl: "/billing?reason=monthly_export_limit",
      },
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
      userId: user.id,
      resumeId,
      format: "PDF",
      status: "PROCESSING"
    }
  });

  /**
   * Bump the user's lifetime export counter on success. We use a flag
   * (`counterBumped`) instead of incrementing eagerly so that FAILED
   * renders are NOT counted. The counter lives on the `User` row, which
   * outlives `ResumeDocument` — so the value survives resume deletion
   * and the dashboard "Exports" tile keeps showing historical activity.
   */
  const userId = user.id;
  async function bumpLifetimeExportCount() {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lifetimeExportCount: { increment: 1 } },
      });
    } catch (counterError) {
      // Don't fail the export just because the counter couldn't be bumped.
      console.warn(
        "[pdf-export] failed to bump lifetimeExportCount",
        counterError instanceof Error ? counterError.message : String(counterError),
      );
    }
  }

  try {
    const resume = fromStoredResume(record);
    const filename = `${toSafeFilename(resume.title || "resume")}.pdf`;
    const templateId = resume.templateId || "modern";

    // Determine watermark based on plan
    const exportKind = await getPdfExportKind(user.id);
    const watermarked = exportKind === "watermarked";
    const pdfOptions: PdfOptions = { watermarked };

    // ── Check cache ──
    const cacheKey = getCacheKey(resumeId, record.updatedAt, templateId, watermarked);
    const cached = pdfCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
      const cachedElapsed = Date.now() - startTotal;

      await prisma.exportJob.update({
        where: { id: exportJob.id },
        data: { status: "READY", fileUrl: `download:${filename}` },
      });
      await bumpLifetimeExportCount();

      console.log(`[pdf-export] CACHE HIT ${resumeId} (${cachedElapsed}ms)`);

      return new Response(cached.pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(cached.pdf.byteLength),
          "Cache-Control": "no-store",
          "X-Export-Timing": `cache-hit ${cachedElapsed}ms`,
        },
      });
    }

    // ── Build HTML ──
    const htmlStart = Date.now();
    const html = resumeToHtml(resume, pdfOptions);
    const htmlBuildTime = Date.now() - htmlStart;

    let pdf: ArrayBuffer;

    if (RENDERER_URL) {
      // Production: proxy to the external Docker PDF renderer service
      const requestId = getRequestId(request);
      const renderStart = Date.now();

      pdf = await renderHtmlToPdfViaRenderer({
        rendererUrl: RENDERER_URL,
        rendererToken: RENDERER_TOKEN,
        html,
        requestId,
        watermarked: pdfOptions.watermarked,
      });

      const renderTime = Date.now() - renderStart;
      console.log(`[pdf-export] RENDER ${resumeId} (html:${htmlBuildTime}ms, render:${renderTime}ms, total:${Date.now() - startTotal}ms)`);
    } else {
      // Local dev: use in-process Playwright renderer
      pdf = await renderResumePdf(resume, pdfOptions);
    }

    // ── Store in cache ──
    pdfCache.set(cacheKey, { pdf, cachedAt: Date.now() });

    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "READY",
        fileUrl: `download:${filename}`
      }
    });
    await bumpLifetimeExportCount();

    // ── Analytics ──
    captureServerEvent("pdf_exported", user.id, {
      resumeId,
      templateId,
      exportKind,
      fileSize: pdf.byteLength,
      title: resume.title,
      sectionCount: (resume.sectionOrder ?? []).length,
      experienceCount: (resume.experience ?? []).length,
      educationCount: (resume.education ?? []).length,
      skillsCount: (resume.skills ?? []).length,
    });

    const totalTime = Date.now() - startTotal;
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
        "X-Export-Timing": `miss ${totalTime}ms`,
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
    return pdfRendererErrorResponse(error);
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
