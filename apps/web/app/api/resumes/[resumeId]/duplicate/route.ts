import { prisma } from "../../../../../lib/prisma";
import { requireApiUser } from "../../../../../lib/auth";
import { fromStoredResume, toStoredResume } from "../../../../../lib/resume-store";
import { requireEntitlement, FeatureKeys } from "../../../../../lib/entitlements";

export async function POST(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  // ── Entitlement gate ────────────────────────────────────────────────────────
  // Duplicate creates a new ResumeDocument, so it counts against
  // RESUME_LIMIT just like POST /api/resumes. Without this check, a free
  // user at the cap could bypass the plan by clicking "Duplicate".
  //
  // NOTE: can(RESUME_LIMIT) does a non-transactional count — a user at
  // limit-1 firing two duplicate requests in parallel can briefly end up
  // at limit+1. The same race exists in POST /api/resumes and is tracked
  // separately; do not block this fix on it.
  //
  // Gate runs before findFirst (the count inside can() already issues a DB
  // read, so doing another findFirst first would be wasted work), before
  // the idempotency lookup (returning an already-created copy when the user
  // is at limit would be confusing UX), and before create.
  const entitlementGate = await requireEntitlement(user.id, FeatureKeys.RESUME_LIMIT);
  if (entitlementGate) return entitlementGate;

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
  // retry, we return the already-created copy instead of creating a second.
  //
  // This check is wrapped in a try/catch so the route continues to work even
  // if the idempotencyKey migration has not been applied yet (e.g. production
  // is running an older schema). Degrading gracefully means duplication still
  // works — it just loses idempotency protection until the migration is run.
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  if (idempotencyKey) {
    try {
      const existing = await (prisma.resumeDocument as any).findFirst({
        where: { userId: user.id, idempotencyKey },
      });
      if (existing) {
        // Already created — return the existing copy with 200 (not 201).
        return Response.json(
          { resume: fromStoredResume(existing), idempotent: true },
          { status: 200 },
        );
      }
    } catch (e) {
      // Column does not exist yet (migration pending) — skip the idempotency
      // check and proceed to create. Log so the ops team knows to migrate.
      console.warn("[duplicate] idempotency check skipped — run prisma migrate deploy:", e instanceof Error ? e.message : e);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const originalResume = fromStoredResume(original);

  // Build create data; only include idempotencyKey if we have one so we don't
  // write a field that doesn't exist yet on older schemas.
  const createData: Record<string, unknown> = {
    userId: user.id,
    title: `Copy of ${original.title}`,
    targetRole: original.targetRole,
    body: toStoredResume(originalResume),
    versions: {
      create: {
        body: toStoredResume(originalResume),
        note: `Duplicated from ${resumeId}`,
      },
    },
  };

  let duplicated;
  if (idempotencyKey) {
    try {
      duplicated = await (prisma.resumeDocument as any).create({
        data: { ...createData, idempotencyKey },
      });
    } catch (e) {
      // If setting the key fails (column not migrated yet), fall back to a
      // plain create without the key.
      console.warn("[duplicate] could not store idempotencyKey — run prisma migrate deploy:", e instanceof Error ? e.message : e);
      duplicated = await prisma.resumeDocument.create({ data: createData as any });
    }
  } else {
    duplicated = await prisma.resumeDocument.create({ data: createData as any });
  }

  return Response.json(
    { resume: fromStoredResume(duplicated) },
    { status: 201 },
  );
}
