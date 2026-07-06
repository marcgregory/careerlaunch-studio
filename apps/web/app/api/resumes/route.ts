import { prisma } from "../../../lib/prisma";
import { requireApiUser } from "../../../lib/auth";
import { fromStoredResume, parseResumePayload, toStoredResume } from "../../../lib/resume-store";
import { can, FeatureKeys } from "../../../lib/entitlements";
import { captureServerEvent } from "../../../lib/server-analytics";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const resumes = await prisma.resumeDocument.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, targetRole: true, updatedAt: true }
  });

  return Response.json({ resumes });
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
