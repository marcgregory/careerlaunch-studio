/**
 * Rough token estimation for LLM text.
 *
 * A reasonable approximation: ~4 characters per token for English text.
 * This is used for budgeting and truncation — not for billing.
 */

const CHARS_PER_TOKEN = 4;

/**
 * Estimate the number of tokens in a text string.
 * Undershoots slightly for code/numeric text; overshoots slightly for whitespace-heavy text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within a maximum token budget.
 * Preserves word boundaries where possible.
 * Returns the original text if it's already within budget.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return text;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) return text;

  // Truncate at word boundary within the character limit
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxChars * 0.8) {
    // If we can find a reasonable breakpoint, use it
    return truncated.slice(0, lastSpace) + "…";
  }

  return truncated + "…";
}

/**
 * Estimate token count for a structured object by JSON-stringifying it first.
 */
export function estimateObjectTokens(obj: Record<string, unknown>): number {
  return estimateTokens(JSON.stringify(obj));
}
