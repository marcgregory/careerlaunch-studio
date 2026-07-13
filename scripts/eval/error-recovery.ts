/**
 * CareerLaunch Studio - Sprint 6D real-provider recovery gate.
 * Proves provider-to-provider recovery without counting static/mock fallback as success.
 */

import {
  measuredProviderCall,
  normalizeFixtureResume,
  requireProviderPair,
  validateProviderJobMatch,
  writeGateReport,
  type ProviderCallMetadata,
} from "./release-gate";

interface RecoveryScenario {
  name: string;
  failedPrimary: string;
  successfulFallback: string | null;
  usedStaticFallback: boolean;
  usedMock: boolean;
  passed: boolean;
  details: string;
  durationMs: number;
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  const { primary, secondary } = await requireProviderPair();
  const calls: ProviderCallMetadata[] = [];
  const resume = normalizeFixtureResume({
    contact: { fullName: "Release Recovery", email: "qa@example.com", phone: "555-0100", location: "Remote" },
    summary: "Backend engineer with experience in APIs, TypeScript, reliability, and cloud services.",
    sections: [
      {
        id: "experience",
        type: "experience",
        role: "Backend Engineer",
        company: "Example Co",
        bullets: ["Built API services and improved production reliability for customer workflows."],
      },
    ],
    skills: ["TypeScript", "Node.js", "APIs", "Cloud"],
    certifications: [],
    projects: [],
  });
  const jd = "Senior backend engineer role requiring TypeScript, Node.js, API design, reliability, and cloud deployment experience.";

  const scenarios: RecoveryScenario[] = [];

  const primaryFailure = new Error(`Deliberate ${primary.name} failure injected by recovery gate`);
  let fallbackErrors: string[] = [];
  let fallbackMetadata: ProviderCallMetadata | null = null;

  try {
    throw primaryFailure;
  } catch (error) {
    const failedMessage = error instanceof Error ? error.message : String(error);
    try {
      const fallback = await measuredProviderCall(
        secondary,
        "recovery.secondary.matchJob",
        async (provider) => {
          if (!provider.matchJob) throw new Error(`${secondary.name} does not expose matchJob`);
          return provider.matchJob(resume, jd);
        },
        `${primary.name}: deliberate failure -> ${secondary.name}`,
      );
      fallbackMetadata = fallback.metadata;
      calls.push(fallback.metadata);
      fallbackErrors = validateProviderJobMatch(fallback.result);
    } catch (fallbackError) {
      fallbackErrors = [fallbackError instanceof Error ? fallbackError.message : String(fallbackError)];
    }

    scenarios.push({
      name: "Primary provider failure recovers to secondary provider",
      failedPrimary: `${primary.name}/${primary.model}`,
      successfulFallback: fallbackErrors.length === 0 ? `${secondary.name}/${secondary.model}` : null,
      usedStaticFallback: false,
      usedMock: false,
      passed: fallbackErrors.length === 0 && fallbackMetadata !== null,
      details: fallbackErrors.length === 0
        ? `${failedMessage}; secondary provider returned a valid JobMatchResult.`
        : `${failedMessage}; fallback failed: ${fallbackErrors.join("; ")}`,
      durationMs: Date.now() - startedAt,
    });
  }

  const failures = scenarios.filter((s) => !s.passed).map((s) => `${s.name}: ${s.details}`);
  writeGateReport({
    title: "AI Recovery Report",
    fileName: "AI_RECOVERY_REPORT.md",
    commands: ["npm run eval:recovery"],
    providerCalls: calls,
    passCount: scenarios.filter((s) => s.passed).length,
    failCount: failures.length,
    failures,
    fixesApplied: ["Recovery gate now requires two real providers and rejects mock/static fallback as successful recovery."],
    knownIssues: failures,
    latencyResults: scenarios.map((s) => ({ label: s.name, durationMs: s.durationMs })),
  });

  const report = {
    timestamp: new Date().toISOString(),
    primary: { provider: primary.name, model: primary.model },
    secondary: { provider: secondary.name, model: secondary.model },
    scenarios,
    providerCalls: calls,
    overallPassed: failures.length === 0 && calls.length > 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.overallPassed) process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeGateReport({
    title: "AI Recovery Report",
    fileName: "AI_RECOVERY_REPORT.md",
    commands: ["npm run eval:recovery"],
    providerCalls: [],
    passCount: 0,
    failCount: 1,
    failures: [message],
    fixesApplied: ["Recovery gate now fails unless provider-to-provider fallback can be proven."],
    knownIssues: [message],
    latencyResults: [],
  });
  console.error("Error recovery suite failed:", message);
  process.exit(1);
});

