import { parseResumeText } from "@careerlaunch/ai/import";
import { requireApiUser } from "../../../../lib/auth";
import { reportError } from "../../../../lib/error-reporting";
import { getRequestId } from "../../../../lib/request-id";
import { checkRateLimit } from "../../../../lib/rate-limit";

const MAX_IMPORT_SIZE = 50 * 1024; // 50 KB

/**
 * POST /api/import/text
 *
 * Parse plain-text resume content into a structured Partial<ResumeDocument>.
 * Response includes the parsed data, a confidence score, and any warnings.
 *
 * Body: { text: string }
 * Response: { parsed: Partial<ResumeDocument>, confidence: number, warnings: string[] }
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  // Rate limit: 5 imports per hour per user
  const rl = checkRateLimit(`import:${user.id}`, 5, 60 * 60 * 1000);
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

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return Response.json(
      { error: "text field is required and must be a string" },
      { status: 400 },
    );
  }

  if (body.text.length > MAX_IMPORT_SIZE) {
    return Response.json(
      { error: "Text exceeds maximum size of 50 KB" },
      { status: 413 },
    );
  }

  if (body.text.trim().length === 0) {
    return Response.json(
      { error: "Text cannot be empty" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = parseResumeText(body.text);
  } catch (error) {
    reportError(error, getRequestId(request), { route: "import-text" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Import parsing failed" },
      { status: 500 },
    );
  }

  return Response.json(result, { status: 200 });
}
