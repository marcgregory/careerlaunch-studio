import { parseResumeText, deriveImportQuality, recoverSections, mergeRecovery, needsAICoverageRecovery } from "@careerlaunch/ai/import";
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

    // ── AI Recovery Pass ─────────────────────────────────────────────
    // If critical sections have low coverage, attempt AI reconstruction
    // using the original resume text. This runs automatically so users
    // rarely need to manually fix low-quality imports.
    const needsRecovery = needsAICoverageRecovery(result.coverage);
    console.log("[import] needsAICoverageRecovery:", needsRecovery, "coverage:", JSON.stringify(result.coverage.map(c => ({ id: c.sectionId, ratio: c.ratio }))));
    if (needsRecovery) {
      const providerName = pickImportRecoveryProvider();
      console.log("[import] pickImportRecoveryProvider:", providerName);
      console.log("[import] GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY, "GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);

      if (providerName) {
        const apiKey = providerName === "groq"
          ? process.env.GROQ_API_KEY
          : process.env.GEMINI_API_KEY;

        console.log("[import] apiKey resolved:", !!apiKey, "provider:", providerName);

        if (apiKey) {
          // Snapshot pre-recovery data so the UI can offer a comparison view
          const preRecoveryData = {
            summary: result.parsed.summary ?? "",
            experience: result.parsed.experience ?? [],
            education: result.parsed.education ?? [],
            skills: result.parsed.skills ?? [],
          };

          const recovery = await recoverSections({
            originalText: body.text,
            parserOutput: result,
            lowCoverageSections: result.coverage.filter((c) => c.ratio < 0.8),
            provider: { name: providerName, apiKey },
          });

          console.log("[import] recovery result keys:", Object.keys(recovery));
          console.log("[import] recovery experience:", recovery.experience?.length ?? 0, "entries, education:", recovery.education?.length ?? 0, "entries");

          // If recovery came back empty despite being called, it likely hit
          // an API quota/rate limit. The LLM logs the real reason via console.warn.
          if (recovery.experience?.length === 0 && recovery.education?.length === 0 && recovery.skills?.length === 0) {
            console.warn("[import] AI recovery returned empty — likely quota/rate limit on provider:", providerName);
          }

          const merged = mergeRecovery(result, recovery);

          console.log("[import] mergeRecovery completed — recoveredSections:", merged.recoveredSections, "aiRecovered:", merged.aiRecovered);
          console.log("[import] merged experience count:", merged.parsed.experience?.length ?? 0, "education count:", merged.parsed.education?.length ?? 0);

          // Update coverage for recovered sections — mark them as 100%
          // (the AI has reconstructed the content from the original text).
          const updatedCoverage = result.coverage.map((c) =>
            merged.recoveredSections.includes(c.sectionId)
              ? { ...c, ratio: 1, status: "good" as const, parsedWordCount: c.originalWordCount }
              : c,
          );

          const finalImportQuality = deriveImportQuality(updatedCoverage);
          console.log("[import] final importQuality:", finalImportQuality, "coverage:", JSON.stringify(updatedCoverage.map(c => ({ id: c.sectionId, ratio: c.ratio }))));

          result = {
            ...result,
            parsed: merged.parsed,
            coverage: updatedCoverage,
            importQuality: finalImportQuality,
            aiRecovered: merged.aiRecovered,
            aiRecoveredSections: merged.recoveredSections,
            aiRecoveryStatus: merged.aiRecovered ? "succeeded" : "attempted_no_recovery",
            /** Pre-recovery snapshot for the comparison UI toggle.
             *  Only populated when AI recovery was applied. */
            preRecoveryData,
          };
        } else {
          // apiKey was empty string or falsy despite provider being selected
          console.warn("[import] apiKey was falsy for provider:", providerName);
          result = { ...result, aiRecoveryStatus: "failed_no_api_key" };
        }
      } else {
        // No AI provider configured — not an error, just no recovery possible
        console.warn("[import] No AI provider available — AI recovery skipped. Set GEMINI_API_KEY or GROQ_API_KEY in .env");
        result = { ...result, aiRecoveryStatus: "skipped_no_provider" };
      }
    } else {
      // Coverage was already sufficient — no recovery needed
      result = { ...result, aiRecoveryStatus: "skipped_coverage_sufficient" };
    }
  } catch (error) {
    reportError(error, getRequestId(request), { route: "import-text" });
    return Response.json(
      { error: error instanceof Error ? error.message : "Import parsing failed" },
      { status: 500 },
    );
  }

  return Response.json(result, { status: 200 });
}

/**
 * Determine which AI provider to use for the recovery pass.
 * Returns the provider name, or null if no provider is configured.
 */
function pickImportRecoveryProvider(): "gemini" | "groq" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}
