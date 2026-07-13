import { loadEnvConfig } from "@next/env";

let envLoaded = false;

export function requireRealAIProvider(): void {
  if (!envLoaded) {
    loadEnvConfig(process.cwd());
    envLoaded = true;
  }

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY?.trim());

  if (!hasGeminiKey && !hasGroqKey) {
    throw new Error(
      "Real AI provider required: configure GEMINI_API_KEY or GROQ_API_KEY.",
    );
  }
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/eval/provider-preflight.ts")) {
  requireRealAIProvider();
  console.log("Real AI provider configured.");
}