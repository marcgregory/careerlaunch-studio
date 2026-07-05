import { parseResumeText, deriveImportQuality, recoverSections, mergeRecovery, needsAICoverageRecovery } from "@careerlaunch/ai/import";
import { requireApiUser } from "../../../../lib/auth";
import { reportError } from "../../../../lib/error-reporting";
import { getRequestId } from "../../../../lib/request-id";
import { checkRateLimit } from "../../../../lib/rate-limit";

const MAX_IMPORT_SIZE = 50 * 1024; // 50 KB

type ProviderEntry = {
  name: "gemini" | "groq";
  apiKey: string;
};

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
    //
    // Multi-provider fallback: providers are tried in order (Gemini → Groq).
    // If the first provider fails (rate limit, outage, etc.), we fall
    // through to the next. This ensures AI recovery stays available even
    // when a single provider hits its limit.
    const needsRecovery = needsAICoverageRecovery(result.coverage);
    console.log("[import] needsAICoverageRecovery:", needsRecovery, "coverage:", JSON.stringify(result.coverage.map(c => ({ id: c.sectionId, ratio: c.ratio }))));

    let aiRecovery: {
      status: "skipped" | "attempted" | "succeeded" | "fallback" | "failed";
      primaryProvider: string | null;
      usedProvider: string | null;
      failedProviders: string[];
      reason?: string;
    } = {
      status: "skipped",
      primaryProvider: null,
      usedProvider: null,
      failedProviders: [],
    };

    if (needsRecovery) {
      const providers = listAvailableProviders();
      console.log("[import] available providers:", providers.map(p => p.name));
      console.log("[import] GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY, "GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);

      aiRecovery.primaryProvider = providers[0]?.name ?? null;

      if (providers.length === 0) {
        console.warn("[import] No AI provider available — AI recovery skipped. Set GEMINI_API_KEY or GROQ_API_KEY in .env");
        aiRecovery.status = "skipped";
        aiRecovery.reason = "No AI provider configured";
      } else {
        // Snapshot pre-recovery data so the UI can offer a comparison view
        const preRecoveryData = {
          summary: result.parsed.summary ?? "",
          experience: result.parsed.experience ?? [],
          education: result.parsed.education ?? [],
          skills: result.parsed.skills ?? [],
        };

        // Try each provider sequentially until one succeeds
        let recovery = null;
        let usedProvider: string | null = null;
        const failedProviders: string[] = [];

        for (const provider of providers) {
          console.log("[import] attempting recovery with provider:", provider.name);

          try {
            recovery = await recoverSections({
              originalText: body.text,
              parserOutput: result,
              lowCoverageSections: result.coverage.filter((c) => c.ratio < 0.8),
              provider: { name: provider.name, apiKey: provider.apiKey },
            });

            console.log("[import] recovery result keys:", Object.keys(recovery));
            console.log("[import] recovery experience:", recovery.experience?.length ?? 0, "entries, education:", recovery.education?.length ?? 0, "entries");

            // Check if the provider actually returned anything useful
            const hasContent = (recovery.experience?.length ?? 0) > 0
              || (recovery.education?.length ?? 0) > 0
              || (recovery.skills?.length ?? 0) > 0
              || (recovery.summary?.length ?? 0) > 0;

            if (hasContent) {
              usedProvider = provider.name;
              console.log("[import] recovery succeeded with provider:", provider.name);
              break; // Success — stop trying more providers
            } else {
              console.warn("[import] provider", provider.name, "returned empty recovery — trying next provider if available");
              failedProviders.push(provider.name);
              recovery = null;
            }
          } catch (err) {
            // recoverSections catches most errors internally and returns {},
            // but a hard crash (abort, unexpected) would reach here
            const failReason = err instanceof Error ? err.message : String(err);
            console.warn("[import] provider", provider.name, "failed:", failReason);
            failedProviders.push(provider.name);
            recovery = null;
          }
        }

        aiRecovery.failedProviders = failedProviders;

        if (recovery && usedProvider) {
          // ── Recovery succeeded ──
          aiRecovery.status = usedProvider === aiRecovery.primaryProvider ? "succeeded" : "fallback";
          aiRecovery.usedProvider = usedProvider;
          if (aiRecovery.status === "fallback") {
            aiRecovery.reason = `Primary provider (${aiRecovery.primaryProvider}) failed, used ${usedProvider} instead`;
          }

          console.log("[import] recovery succeeded with provider:", usedProvider);

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
            aiRecovery,
            /** Pre-recovery snapshot for the comparison UI toggle.
             *  Only populated when AI recovery was applied. */
            preRecoveryData,
          };
        } else {
          // ── All providers failed ──
          aiRecovery.status = "failed";
          aiRecovery.usedProvider = null;
          aiRecovery.reason = `All AI providers failed: ${failedProviders.join(", ")}`;

          console.warn("[import] all providers failed:", failedProviders);

          result = {
            ...result,
            aiRecovery,
            preRecoveryData,
          };
        }
      }
    } else {
      // Coverage was already sufficient — no recovery needed
      aiRecovery.status = "skipped";
      aiRecovery.reason = "Coverage sufficient in all critical sections";
      result = { ...result, aiRecovery };
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
 * List available AI providers in priority order (Gemini first, then Groq).
 * Returns an empty array if no provider is configured.
 *
 * This is the single source of truth for recovery provider selection.
 * Provider priority:
 *   1. Gemini (primary — fast, capable)
 *   2. Groq (fallback — different infra, lower chance of correlated outage)
 */
function listAvailableProviders(): ProviderEntry[] {
  const providers: ProviderEntry[] = [];
  if (process.env.GEMINI_API_KEY) {
    providers.push({ name: "gemini", apiKey: process.env.GEMINI_API_KEY });
  }
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "groq", apiKey: process.env.GROQ_API_KEY });
  }
  return providers;
}
