import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../lib/resume-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { resumeId } = await context.params;

  const original = await prisma.resumeDocument.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!original) {
    return Response.json({ error: "Resume not found" }, { status: 404 });
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  // The client sends a stable UUID (generated once per user click) as the
  // Idempotency-Key header. If a network interruption causes the client to
  // retry, we return the already-created copy instead of creating a second one.
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  if (idempotencyKey) {
    const existing = await prisma.resumeDocument.findFirst({
      where: { userId: user.id, idempotencyKey },
    });
    if (existing) {
      // Already created — return the existing copy with 200 (not 201).
      return Response.json(
        { resume: fromStoredResume(existing), idempotent: true },
        { status: 200 },
      );
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const originalResume = fromStoredResume(original);

  const duplicated = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      title: `Copy of ${original.title}`,
      targetRole: original.targetRole,
      body: toStoredResume(originalResume),
      idempotencyKey: idempotencyKey ?? null,
      versions: {
        create: {
          body: toStoredResume(originalResume),
          note: `Duplicated from ${resumeId}`,
        },
      },
    },
  });

  return Response.json(
    { resume: fromStoredResume(duplicated) },
    { status: 201 },
  );
}
