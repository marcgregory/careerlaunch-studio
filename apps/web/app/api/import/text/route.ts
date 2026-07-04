import { parseResumeText } from "@careerlaunch/ai/import";
import { requireApiUser } from "../../../../lib/auth";

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

  const result = parseResumeText(body.text);

  return Response.json(result, { status: 200 });
}
