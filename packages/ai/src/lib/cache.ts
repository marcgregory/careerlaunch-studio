/**
 * In-memory result cache for AI provider responses.
 *
 * Reduces duplicate LLM calls when the same resume is analyzed
 * multiple times within the cache TTL.
 *
 * Cache key format: {provider}:{dimension}:{resumeHash}[:{jdHash}]
 *
 * This is a simple in-memory Map. In production, it could be replaced
 * with Redis or another distributed cache without changing the API.
 */

// ─── Types ─────────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// ─── Cache TTLs (milliseconds) ─────────────────────────────────────────

export const CACHE_TTL: Record<string, number> = {
  ats: 60 * 60 * 1000,       // 1 hour
  grammar: 60 * 60 * 1000,   // 1 hour
  impact: 24 * 60 * 60 * 1000,  // 24 hours
  keywords: 60 * 60 * 1000,  // 1 hour
  summary: 60 * 60 * 1000,   // 1 hour
  tone: 24 * 60 * 60 * 1000, // 24 hours
  "cover-letter": 60 * 60 * 1000, // 1 hour
  "job-match": 30 * 60 * 1000,    // 30 minutes
};

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

// ─── API ───────────────────────────────────────────────────────────────

/**
 * Build a cache key from provider, dimension, and resume/JD hashes.
 *
 * @param provider — provider name (e.g. "gemini", "groq")
 * @param dimension — analysis dimension (e.g. "ats", "grammar")
 * @param resumeHash — hash of the normalized resume content
 * @param jdHash — optional hash of the job description
 */
export function buildCacheKey(
  provider: string,
  dimension: string,
  resumeHash: string,
  jdHash?: string,
): string {
  return jdHash
    ? `${provider}:${dimension}:${resumeHash}:${jdHash}`
    : `${provider}:${dimension}:${resumeHash}`;
}

/**
 * Compute a simple hash from a JSON-stringifiable value.
 * Not cryptographic — just for cache key collisions.
 */
export function hashValue(value: unknown): string {
  const str = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get a cached result.
 * Returns the cached value if found and not expired, or null.
 */
export function getCachedResult(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a cached result with the given TTL.
 * @param key — cache key
 * @param value — value to cache
 * @param ttlMs — TTL in milliseconds (defaults to dimension-based TTL)
 */
export function setCachedResult(key: string, value: unknown, ttlMs?: number): void {
  const ttl = ttlMs ?? DEFAULT_TTL;
  store.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
}

/**
 * Get the TTL for a specific dimension.
 */
export function getDimensionTTL(dimension: string): number {
  return CACHE_TTL[dimension] ?? DEFAULT_TTL;
}

/**
 * Invalidate all cache entries matching a provider or dimension pattern.
 *
 * @param pattern — substring to match against cache keys (e.g. "gemini:ats")
 */
export function invalidateCache(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  store.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  // Clean expired entries first
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }

  return {
    size: store.size,
    keys: Array.from(store.keys()),
  };
}
