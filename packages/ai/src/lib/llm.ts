/**
 * Shared LLM call helpers.
 *
 * Provides low-level functions for calling Gemini (via @google/genai SDK)
 * and OpenAI-compatible APIs (Groq, OpenRouter, future providers).
 *
 * Both functions handle:
 *   - Timeout via AbortSignal
 *   - One automatic retry on transient errors
 *   - JSON parsing from the response
 *   - Proper error wrapping
 */

// ─── Gemini ────────────────────────────────────────────────────────────

export interface CallGeminiConfig {
  /** System prompt / instruction text */
  system: string;
  /** User message / prompt text */
  prompt: string;
  /** Gemini API key */
  apiKey: string;
  /** Model name (default: "gemini-2.5-flash") */
  model?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Temperature (default: 0.3 for consistent structured output) */
  temperature?: number;
  /** AbortSignal for timeout / cancellation */
  signal?: AbortSignal;
}

/**
 * Call the Gemini API with a system prompt and user message.
 * Returns the parsed JSON response.
 *
 * Retries once on transient errors (network, 429, 500).
 * Throws on auth errors, invalid responses after retry, or abort.
 */
export async function callGemini(config: CallGeminiConfig): Promise<unknown> {
  const { system, prompt, apiKey, model = "gemini-2.5-flash", maxTokens = 2048, temperature = 0.3, signal } = config;

  if (!apiKey) {
    throw new LLMError("GEMINI_API_KEY is not configured", "auth");
  }

  // Dynamic import so the SDK is only loaded when Gemini is actually used
  const { GoogleGenAI } = await import("@google/genai");

  const client = new GoogleGenAI({ apiKey });

  const contents = [
    { role: "user", parts: [{ text: `${system}\n\n${prompt}` }] },
  ];

  let lastError: Error | undefined;
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: maxTokens,
          temperature,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) {
        throw new LLMError("Gemini returned empty response", "empty");
      }

      return JSON.parse(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry auth errors or aborts
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      if (lastError.message.includes("API_KEY") || lastError.message.includes("auth") || lastError.message.includes("403")) {
        throw new LLMError(`Gemini auth error: ${lastError.message}`, "auth");
      }

      // On last attempt, re-throw wrapped
      if (attempt === maxAttempts - 1) {
        throw new LLMError(
          `Gemini call failed after ${maxAttempts} attempts: ${lastError.message}`,
          "provider",
        );
      }

      // Wait before retry (exponential backoff)
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  throw new LLMError("Gemini call failed unexpectedly", "provider");
}

// ─── OpenAI-compatible (Groq, OpenRouter, etc.) ────────────────────────

export interface CallOpenAICompatibleConfig {
  /** Base URL for the API (e.g. "https://api.groq.com/openai/v1") */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /**
   * Model name or array of model names to try in order.
   * On a 404 with "model_not_found" / "does not exist", the next model is
   * tried automatically. All other errors (auth, 429, 5xx) bail immediately.
   */
  model: string | string[];
  /** System prompt / instruction text */
  system: string;
  /** User message / prompt text */
  prompt: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Temperature (default: 0.3) */
  temperature?: number;
  /** AbortSignal for timeout / cancellation */
  signal?: AbortSignal;
}

/**
 * Call an OpenAI-compatible API (Groq, OpenRouter, etc.).
 * Returns the parsed JSON response.
 *
 * Retries once on transient errors.
 * Throws on auth errors, invalid responses after retry, or abort.
 */
export async function callOpenAICompatible(config: CallOpenAICompatibleConfig): Promise<unknown> {
  const {
    baseUrl,
    apiKey,
    system,
    prompt,
    maxTokens = 2048,
    temperature = 0.3,
    signal,
  } = config;

  if (!apiKey) {
    throw new LLMError(`${baseUrl} API key is not configured`, "auth");
  }

  // Normalise model to an ordered list we iterate over
  const models: string[] = Array.isArray(config.model)
    ? config.model.filter(Boolean)
    : [config.model];

  if (models.length === 0) {
    throw new LLMError("No model specified for OpenAI-compatible call", "provider");
  }

  let lastError: Error | undefined;

  for (const model of models) {
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            max_tokens: maxTokens,
            temperature,
            response_format: { type: "json_object" },
          }),
          signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "unknown");

          // 401/403 — auth failure, never retry
          if (response.status === 401 || response.status === 403) {
            throw new LLMError(`Auth error (${response.status}): ${body}`, "auth");
          }

          // 429 — rate limited, retry after suggested delay
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
            await sleep(retryAfter * 1000);
            continue;
          }

          // 404 with model_not_found — try next model in the fallback list
          if (
            response.status === 404 &&
            (body.includes("model_not_found") || body.includes("does not exist") || body.includes("not found"))
          ) {
            lastError = new LLMError(
              `Model "${model}" not found (404): ${body}`,
              "provider",
            );
            break; // break out of retry loop, move to next model
          }

          throw new LLMError(`API error (${response.status}): ${body}`, "provider");
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new LLMError("API returned empty response", "empty");
        }

        return JSON.parse(content);
      } catch (error) {
        // LLMErrors with code "provider" that come from a 404 model-not-found
        // are already handled above (break); for safety, also catch non-LLMError
        // re-throws that shouldn't be retried.
        if (error instanceof LLMError) {
          if (error.code === "auth" || error.code === "empty") {
            throw error;
          }
          // provider errors from a 404 fallback — continue to next model
          if (error.code === "provider" && lastError?.message.includes("not found")) {
            throw error; // already handled above via break; this is a safety net
          }
          throw error;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts - 1) {
          // Exhausted retries for this model — try next model if available
          break;
        }

        await sleep(500 * Math.pow(2, attempt));
      }
    }
  }

  throw new LLMError(
    `API call failed after trying all models: ${lastError?.message ?? "unknown error"}`,
    "provider",
  );
}

// ─── Error type ────────────────────────────────────────────────────────

export class LLMError extends Error {
  public readonly code: string;

  constructor(message: string, code: "auth" | "provider" | "empty" | "timeout" | "parse") {
    super(message);
    this.name = "LLMError";
    this.code = code;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
