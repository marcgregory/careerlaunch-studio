import { NextResponse } from "next/server";

const RENDERER_BASE = process.env.PDF_RENDERER_URL?.replace(/\/render$/, "");
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;

/**
 * Cron job: ping the PDF renderer every 3 minutes to prevent Railway
 * idle timeout. Called by Vercel Cron Jobs.
 *
 * GET /api/cron/keep-alive-renderer
 */
export async function GET() {
  if (!RENDERER_BASE) {
    return NextResponse.json({ status: "skipped", reason: "no renderer configured" });
  }

  try {
    const res = await fetch(`${RENDERER_BASE}/health`, {
      headers: RENDERER_TOKEN
        ? { Authorization: `Bearer ${RENDERER_TOKEN}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json({
      status: res.ok ? "ok" : "error",
      browserConnected: res.ok ? (await res.json()).browserConnected : false,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 503 },
    );
  }
}
