import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/auth";
import {
  createStarterResume,
  fromStoredResume,
  parseResumePayload,
  toStoredResume,
} from "../../../lib/resume-store";
import { FeatureKeys, requireEntitlement } from "../../../lib/entitlements";
import { captureServerEvent } from "../../../lib/server-analytics";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  const [resumes, total, allResumesForStats, userLifetimeExports] = await Promise.all([
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
    prisma.user.findUnique({
      where: { id: user.id },
      select: { lifetimeExportCount: true },
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
    // Use the lifetime counter on the User row so the workspace "Exports"
    // tile keeps its number even when the exported resumes are deleted.
    exportCount: userLifetimeExports?.lifetimeExportCount ?? 0,
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

  // ── Entitlement gate ────────────────────────────────────────────────────────
  // Both starter and custom creation count against RESUME_LIMIT. Mirror the
  // duplicate route's gate pattern so we get the same { feature, upgradeUrl }
  // 403 shape the client already branches on.
  const entitlementGate = await requireEntitlement(user.id, FeatureKeys.RESUME_LIMIT);
  if (entitlementGate) return entitlementGate;

  let body: { kind?: "starter" | "custom"; resume?: unknown } = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = (raw && typeof raw === "object" ? raw : {}) as typeof body;
  } catch {
    // Empty body is allowed for the default (starter) flow.
  }

  const kind: "starter" | "custom" = body.kind === "custom" ? "custom" : "starter";

  // ── Idempotency ────────────────────────────────────────────────────────────
  // If the client sends an Idempotency-Key, return the existing record on
  // replay. The duplicate route at app/api/resumes/[resumeId]/duplicate/route.ts
  // does the same dance and degrades gracefully if the column is missing.
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
  if (idempotencyKey) {
    try {
      const existing = await (prisma.resumeDocument as any).findFirst({
        where: { userId: user.id, idempotencyKey },
      });
      if (existing) {
        return Response.json(
          { resume: fromStoredResume(existing), idempotent: true },
          { status: 200 }
        );
      }
    } catch (e) {
      console.warn(
        "[api/resumes] idempotency check skipped — run prisma migrate deploy:",
        e instanceof Error ? e.message : e
      );
    }
  }

  // ── Build resume payload ───────────────────────────────────────────────────
  let resume;
  let note: string;
  let source: "dashboard_new_resume" | "builder";
  if (kind === "starter") {
    resume = createStarterResume();
    note = "Initial draft";
    source = "dashboard_new_resume";
  } else {
    try {
      resume = parseResumePayload(body.resume);
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Invalid resume payload" },
        { status: 400 }
      );
    }
    note = "Initial draft";
    source = "builder";
  }

  const storedBody = toStoredResume(resume);
  const createData: Record<string, unknown> = {
    userId: user.id,
    title: resume.title,
    targetRole: resume.targetRole,
    body: storedBody,
    versions: {
      create: {
        body: storedBody,
        note,
      },
    },
  };

  let stored;
  if (idempotencyKey) {
    try {
      stored = await (prisma.resumeDocument as any).create({
        data: { ...createData, idempotencyKey },
      });
    } catch (e) {
      console.warn(
        "[api/resumes] could not store idempotencyKey — run prisma migrate deploy:",
        e instanceof Error ? e.message : e
      );
      stored = await prisma.resumeDocument.create({ data: createData as any });
    }
  } else {
    stored = await prisma.resumeDocument.create({ data: createData as any });
  }

  // ── Funnel: draft_created ──────────────────────────────────────────────────
  captureServerEvent("draft_created", user.id, {
    source,
    resumeId: stored.id,
    title: resume.title,
    targetRole: resume.targetRole ?? "",
    templateId: resume.templateId,
    sectionCount: resume.sectionOrder?.length ?? 0,
  });

  return Response.json({ resume: fromStoredResume(stored) }, { status: 201 });
}
