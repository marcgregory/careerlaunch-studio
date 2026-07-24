import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/auth";
import { fromStoredResume, parseResumePayload, toStoredResume } from "../../../lib/resume-store";
import { can, FeatureKeys } from "../../../lib/entitlements";
import { captureServerEvent } from "../../../lib/server-analytics";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  const [resumes, total, allResumesForStats] = await Promise.all([
    prisma.resumeDocument.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, title: true, targetRole: true, updatedAt: true, _count: { select: { analysisRuns: true, exports: true } } },
    }),
    prisma.resumeDocument.count({ where: { userId: user.id } }),
    prisma.resumeDocument.findMany({
      where: { userId: user.id },
      select: {
        targetRole: true,
        _count: { select: { analysisRuns: true, exports: true } },
      },
    }),
  ]);

  const serialized = resumes.map((r) => ({
    id: r.id,
    title: r.title,
    targetRole: r.targetRole,
    updatedAt: r.updatedAt.toISOString(),
    analysisRunCount: r._count.analysisRuns,
    exportCount: r._count.exports,
  }));

  const stats = {
    totalResumes: total,
    targetedCount: allResumesForStats.filter((r) => !!r.targetRole).length,
    analyzedCount: allResumesForStats.filter((r) => r._count.analysisRuns > 0).length,
    exportCount: allResumesForStats.reduce((sum, r) => sum + r._count.exports, 0),
  };

  return Response.json({
    resumes: serialized,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + resumes.length < total,
    },
    stats,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const allowed = await can(user.id, FeatureKeys.RESUME_LIMIT);
  if (!allowed) {
    return Response.json(
      { error: "Resume limit reached.", feature: FeatureKeys.RESUME_LIMIT, upgradeUrl: "/billing" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resume = parseResumePayload(body);
  const stored = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      title: resume.title,
      targetRole: resume.targetRole,
      body: toStoredResume(resume),
      versions: {
        create: {
          body: toStoredResume(resume),
          note: "Initial draft"
        }
      }
    }
  });

  // ── Funnel: draft_created (from builder) ──
  captureServerEvent("draft_created", user.id, {
    source: "builder",
    resumeId: stored.id,
    title: resume.title,
    targetRole: resume.targetRole ?? "",
    templateId: resume.templateId,
    sectionCount: resume.sectionOrder?.length ?? 0,
  });

  return Response.json({ resume: fromStoredResume(stored) }, { status: 201 });
}
