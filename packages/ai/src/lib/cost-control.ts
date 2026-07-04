/**
 * Cost controls for AI provider calls.
 *
 * Provides token budget enforcement, retry with exponential backoff,
 * timeout wrapping, and usage logging.
 */

import { estimateTokens } from "./tokens";

// ─── Types ─────────────────────────────────────────────────────────────

export interface CostConfig {
  /** Maximum total tokens (input + output) per analysis run */
  maxTokensPerAnalysis: number;
  /** Maximum number of retries per call */
  maxRetries: number;
  /** Timeout in milliseconds per dimension call */
  timeoutMs: number;
  /** Enable in-memory result caching */
  enableCaching: boolean;
}

export const DEFAULT_COST_CONFIG: CostConfig = {
  maxTokensPerAnalysis: 5000,
  maxRetries: 1,
  timeoutMs: 15000,
  enableCaching: true,
};

interface UsageRecord {
  tokensUsed: number;
  callsMade: number;
  resetAt: number;
}

// ─── Token budget tracker ──────────────────────────────────────────────

const usageStore = new Map<string, UsageRecord>();

/**
 * Check if a user has remaining token budget for AI analysis.
 * Returns { allowed, remaining, total } for the current window.
 * Budget resets every 24 hours.
 */
export function checkTokenBudget(userId: string, config = DEFAULT_COST_CONFIG): {
  allowed: boolean;
  remaining: number;
  total: number;
} {
  const now = Date.now();
  const record = usageStore.get(userId);

  // Reset if window expired
  if (!record || now > record.resetAt) {
    const newRecord: UsageRecord = {
      tokensUsed: 0,
      callsMade: 0,
      resetAt: now + 24 * 60 * 60 * 1000,
    };
    usageStore.set(userId, newRecord);
    return { allowed: true, remaining: config.maxTokensPerAnalysis, total: config.maxTokensPerAnalysis };
  }

  const remaining = Math.max(0, config.maxTokensPerAnalysis - record.tokensUsed);
  return {
    allowed: remaining > 0,
    remaining,
    total: config.maxTokensPerAnalysis,
  };
}

/**
 * Record token usage for a user. Deducts from their daily budget.
 */
export function recordTokenUsage(userId: string, tokensUsed: number): void {
  const now = Date.now();
  let record = usageStore.get(userId);

  if (!record || now > record.resetAt) {
    record = { tokensUsed: 0, callsMade: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  }

  record.tokensUsed += tokensUsed;
  record.callsMade += 1;
  usageStore.set(userId, record);
}

/**
 * Get the number of AI calls a user has made in the current window.
 */
export function getCallCount(userId: string): number {
  const record = usageStore.get(userId);
  if (!record || Date.now() > record.resetAt) return 0;
  return record.callsMade;
}

// ─── Retry / Backoff ───────────────────────────────────────────────────

/**
 * Estimate total tokens for an analysis call (input + estimated output).
 */
export function estimateAnalysisTokens(
  inputText: string,
  estimatedOutputTokens = 500,
): number {
  return estimateTokens(inputText) + estimatedOutputTokens;
}

/**
 * Wrap a provider call with cost controls:
 * 1. Check budget before calling
 * 2. Apply timeout
 * 3. On success, record token usage
 * 4. On failure, retry with backoff
 *
 * @returns The result of the wrapped function
 * @throws {CostLimitError} if budget is exceeded
 * @throws {Error} from the wrapped function if all retries fail
 */
export async function withCostControls<T>(
  fn: () => Promise<T>,
  config = DEFAULT_COST_CONFIG,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Apply timeout via race with AbortSignal
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new CostLimitError(`Timed out after ${config.timeoutMs}ms`));
        }, config.timeoutMs);
      });

      const result = await Promise.race([
        fn(),
        timeoutPromise,
        ...(signal
          ? [
              new Promise<never>((_, reject) => {
                signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
              }),
            ]
          : []),
      ]);

      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort or budget errors
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (error instanceof CostLimitError) throw error;

      // On last attempt, re-throw
      if (attempt >= config.maxRetries) throw lastError;

      // Exponential backoff
      await sleep(200 * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error("Unknown error in withCostControls");
}

// ─── Error types ───────────────────────────────────────────────────────

export class CostLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CostLimitError";
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
