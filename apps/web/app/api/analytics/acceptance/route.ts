import { prisma } from "../../../../lib/prisma";
import { requireApiUser } from "../../../../lib/auth";

/**
 * GET /api/analytics/acceptance
 *
 * Returns aggregated suggestion acceptance metrics for the current user.
 * This is a non-critical analytics endpoint — errors return empty data.
 */
export async function GET() {
  const { user, response } = await requireApiUser();
  if (response) return response;

  try {
    // Aggregate suggestion events by category
    const events = await prisma.suggestionEvent.findMany({
      where: { userId: user.id },
      select: { action: true, category: true },
    });

    // Aggregate feedback reasons
    const feedback = await prisma.suggestionFeedback.findMany({
      where: { userId: user.id, helpful: false, reason: { not: null } },
      select: { reason: true },
    });

    // Build overall stats
    const total = events.length;
    const viewed = events.filter((e) => e.action === "viewed").length;
    const accepted = events.filter((e) => e.action === "accepted").length;
    const applied = events.filter((e) => e.action === "applied").length;
    const rejected = events.filter((e) => e.action === "rejected" || e.action === "dismissed").length;

    // Per-category breakdown
    const categories = [...new Set(events.map((e) => e.category))];
    const byCategory: Record<string, { total: number; accepted: number; rejected: number; acceptanceRate: number }> = {};

    for (const cat of categories) {
      const catEvents = events.filter((e) => e.category === cat);
      const catAccepted = catEvents.filter((e) => e.action === "accepted").length;
      const catRejected = catEvents.filter((e) => e.action === "rejected" || e.action === "dismissed").length;
      byCategory[cat] = {
        total: catEvents.length,
        accepted: catAccepted,
        rejected: catRejected,
        acceptanceRate: catAccepted + catRejected > 0
          ? catAccepted / (catAccepted + catRejected)
          : 0,
      };
    }

    // Rejection reason distribution
    const rejectionReasons: Record<string, number> = {};
    for (const fb of feedback) {
      const reason = fb.reason ?? "unknown";
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    }

    return Response.json({
      overall: {
        total,
        viewed,
        accepted,
        applied,
        rejected,
        acceptanceRate: accepted + rejected > 0
          ? accepted / (accepted + rejected)
          : 0,
      },
      byCategory,
      rejectionReasons,
    });
  } catch {
    // Non-critical — return empty data
    return Response.json({
      overall: { total: 0, viewed: 0, accepted: 0, applied: 0, rejected: 0, acceptanceRate: 0 },
      byCategory: {},
      rejectionReasons: {},
    });
  }
}
