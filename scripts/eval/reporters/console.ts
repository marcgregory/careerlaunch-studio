import type { EvalResult } from "../run";

/**
 * Console reporter — prints a table of results to stdout.
 */
export function reportConsole(results: EvalResult[]): void {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CareerLaunch Studio — Evaluation Suite");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const result of results) {
    const status = result.passed ? "✓" : "✗";
    const errors = result.errors.length > 0
      ? ` — ${result.errors[0]}`
      : "";
    console.log(
      `  ${status} ${result.testCase.padEnd(30)} ${String(result.durationMs).padStart(6)}ms  ${result.mode.padEnd(8)}${errors}`,
    );
  }

  console.log("\n───────────────────────────────────────────");
  console.log(
    `  Total: ${results.length}  |  Passed: ${passed.length}  |  Failed: ${failed.length}`,
  );

  if (failed.length > 0) {
    console.log("\n  ❌ FAILURES:");
    for (const f of failed) {
      console.log(`     - ${f.testCase} (${f.mode}): ${f.errors.join("; ")}`);
    }
  }

  console.log("───────────────────────────────────────────\n");
}
