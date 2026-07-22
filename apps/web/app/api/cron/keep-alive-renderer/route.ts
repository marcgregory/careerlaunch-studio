import { NextResponse } from "next/server";

const RENDERER_BASE = process.env.PDF_RENDERER_URL?.replace(/\/render$/, "");
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;

/**
 * Cron job: ping the PDF renderer to prevent Railway idle timeout.
 * Called by GitHub Actions every 5 minutes.
 *
 * The route intentionally returns 200 in every case except a missing
 * configuration. Cold starts and transient upstream errors are reported
 * as `degraded` so the keep-alive workflow doesn't fail the run on the
 * very flakiness it is trying to prevent.
 *
 * GET /api/cron/keep-alive-renderer
 */
export async function GET() {
  if (!RENDERER_BASE) {
    return NextResponse.json(
      { status: "misconfigured", reason: "no renderer configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${RENDERER_BASE}/health`, {
      headers: RENDERER_TOKEN
        ? { Authorization: `Bearer ${RENDERER_TOKEN}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({
        status: "degraded",
        browserConnected: false,
        upstream: res.status,
      });
    }

    const body = (await res.json()) as { browserConnected?: boolean };
    return NextResponse.json({
      status: "ok",
      browserConnected: body.browserConnected ?? false,
    });
  } catch (err) {
    return NextResponse.json({
      status: "degraded",
      browserConnected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
