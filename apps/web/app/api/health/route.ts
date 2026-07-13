import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic"; // never cache

/**
 * GET /api/health
 *
 * Returns the health status of the application:
 * - App version
 * - Database connectivity
 * - PDF renderer connectivity (if configured)
 *
 * Returns 200 if all checks pass, 503 if any check fails.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "unconfigured"> = {};

  // App version
  checks.app = "ok";

  // Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // PDF renderer
  const rendererUrl = process.env.PDF_RENDERER_URL;
  if (rendererUrl) {
    try {
      const baseUrl = rendererUrl.replace(/\/render$/, "");
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(15000),
      });
      checks["pdf-renderer"] = res.ok ? "ok" : "error";
    } catch {
      checks["pdf-renderer"] = "error";
    }
  } else {
    checks["pdf-renderer"] = "unconfigured";
  }

  // Stripe billing
  const hasStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const hasStripePrices = !!(process.env.STRIPE_PROFESSIONAL_PRICE_ID);
  checks["billing"] = hasStripeKeys && hasStripePrices ? "ok" : "unconfigured";

  const allOk = Object.values(checks).every(
    (v) => v === "ok" || v === "unconfigured",
  );

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "0.1.0",
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
