/**
 * Centralized AI provider initialization.
 *
 * Called once at app startup. Registers all available providers and
 * sets the default based on environment configuration.
 *
 * Provider priority:
 *   1. AI_DEFAULT_PROVIDER env var (explicit choice)
 *   2. First available provider with valid API key
 *   3. MockProvider (always the fallback)
 */

import {
  registerProvider,
  setDefaultProvider,
  MockProvider,
  GeminiProvider,
  GroqProvider,
} from "@careerlaunch/ai";

let initialized = false;

/**
 * Initialize all AI providers. Safe to call multiple times — only runs once.
 *
 * Registration order:
 * - MockProvider is always registered as a fallback.
 * - If AI_DEFAULT_PROVIDER is set and the corresponding API key exists,
 *   that provider becomes the default.
 * - If AI_DEFAULT_PROVIDER is not set, the first available provider
 *   with a configured API key becomes the default.
 * - If no API keys are configured, MockProvider is the default.
 */
export function initializeAI(): void {
  if (initialized) return;
  initialized = true;

  // Always register MockProvider as a reliable fallback
  registerProvider("mock", new MockProvider());

  const defaultProvider = process.env.AI_DEFAULT_PROVIDER || "";

  // Register Gemini if API key is available
  if (process.env.GEMINI_API_KEY) {
    registerProvider("gemini", new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY }));
  }

  // Register Groq if API key is available
  if (process.env.GROQ_API_KEY) {
    registerProvider("groq", new GroqProvider({ apiKey: process.env.GROQ_API_KEY }));
  }

  // Set the default provider
  if (defaultProvider && ["gemini", "groq", "mock"].includes(defaultProvider)) {
    try {
      setDefaultProvider(defaultProvider);
      return;
    } catch {
      // Provider not registered (no API key) — fall through
    }
  }

  // Auto-detect: first available real provider
  if (process.env.GEMINI_API_KEY) {
    setDefaultProvider("gemini");
  } else if (process.env.GROQ_API_KEY) {
    setDefaultProvider("groq");
  } else {
    // No API keys configured — use mock
    setDefaultProvider("mock");
  }
}

/**
 * Check if real (non-mock) AI providers are configured.
 */
export function hasRealAIProvider(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

/**
 * Reset the initialization flag (useful in tests).
 */
export function resetAIInitialization(): void {
  initialized = false;
}
