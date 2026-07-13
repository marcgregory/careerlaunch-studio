import {
  measuredProviderCall,
  normalizeFixtureResume,
  requireRealProvider,
  validateProviderJobMatch,
  writeGateReport,
  type ProviderCallMetadata,
} from "./release-gate";

export async function requireRealAIProvider(): Promise<ProviderCallMetadata> {
  const selection = await requireRealProvider();
  const resume = normalizeFixtureResume({
    contact: { fullName: "Release Gate", email: "qa@example.com", phone: "555-0100", location: "Remote" },
    summary: "Software engineer with experience building TypeScript applications and reliable user workflows.",
    sections: [
      {
        id: "experience",
        type: "experience",
        role: "Software Engineer",
        company: "Example Co",
        bullets: ["Built TypeScript services and React interfaces for customer-facing workflows."],
      },
    ],
    skills: ["TypeScript", "React", "Node.js"],
    certifications: [],
    projects: [],
  });

  const { result, metadata } = await measuredProviderCall(
    selection,
    "preflight.matchJob",
    async (provider) => {
      if (!provider.matchJob) {
        throw new Error(`${selection.name} does not expose matchJob`);
      }
      return provider.matchJob(resume, "We need a TypeScript engineer with React and Node.js experience.");
    },
  );

  const failures = validateProviderJobMatch(result);
  if (failures.length > 0) {
    throw new Error(`Preflight provider response failed validation: ${failures.join("; ")}`);
  }

  return metadata;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/eval/provider-preflight.ts")) {
  const calls: ProviderCallMetadata[] = [];
  const failures: string[] = [];

  requireRealAIProvider()
    .then((metadata) => {
      calls.push(metadata);
      writeGateReport({
        title: "AI Eval Preflight",
        fileName: "AI_EVAL_PREFLIGHT.md",
        commands: ["npm run eval:preflight"],
        providerCalls: calls,
        passCount: 1,
        failCount: 0,
        failures,
        fixesApplied: ["Preflight now performs a real provider matchJob call and validates metadata."],
        knownIssues: [],
        latencyResults: calls.map((c) => ({ label: c.operation, durationMs: c.durationMs })),
      });
      console.log(`Real AI provider verified: ${metadata.provider}/${metadata.model} (${metadata.durationMs}ms).`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      writeGateReport({
        title: "AI Eval Preflight",
        fileName: "AI_EVAL_PREFLIGHT.md",
        commands: ["npm run eval:preflight"],
        providerCalls: calls,
        passCount: 0,
        failCount: 1,
        failures,
        fixesApplied: ["Preflight now fails when no real Gemini/Groq call is proven."],
        knownIssues: [message],
        latencyResults: [],
      });
      console.error("Provider preflight failed:", message);
      process.exit(1);
    });
}

