import type { EvalResult } from "../run";

/**
 * JSON reporter — writes results as JSON for CI integration.
 */
export function reportJSON(results: EvalResult[]): void {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  const output = {
    summary: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      avgDurationMs:
        results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length)
          : 0,
    },
    results,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
}
