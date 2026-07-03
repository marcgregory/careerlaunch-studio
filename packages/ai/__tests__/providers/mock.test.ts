import { describe, it, expect } from "vitest";
import { MockProvider } from "../../src/providers/mock.js";
import { normalizeResume } from "../../src/analysis/normalize.js";
import { sampleResume } from "@careerlaunch/domain";

describe("MockProvider", () => {
  const provider = new MockProvider();
  const normalized = normalizeResume(sampleResume);

  it("reports healthy", async () => {
    const health = await provider.healthCheck();
    expect(health.available).toBe(true);
  });

  it("returns ATS suggestions for a typical resume", async () => {
    const result = await provider.analyze("ats", { resume: normalized });
    expect(Array.isArray(result.suggestions)).toBe(true);
    // Our sample resume has email, phone, summary — should not be critical
    const critical = result.suggestions.filter((s) => s.severity === "critical");
    expect(critical).toHaveLength(0);
  });

  it("returns grammar suggestions", async () => {
    const result = await provider.analyze("grammar", { resume: normalized });
    expect(Array.isArray(result.suggestions)).toBe(true);
    for (const s of result.suggestions) {
      expect(s.category).toBe("grammar");
    }
  });

  it("returns impact suggestions", async () => {
    const result = await provider.analyze("impact", { resume: normalized });
    expect(Array.isArray(result.suggestions)).toBe(true);
    for (const s of result.suggestions) {
      expect(s.category).toBe("impact");
    }
  });

  it("returns keywords suggestion without a job description", async () => {
    const result = await provider.analyze("keywords", { resume: normalized });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].id).toBe("keywords:no-jd:skills");
  });

  it("returns summary suggestions", async () => {
    const result = await provider.analyze("summary", { resume: normalized });
    expect(Array.isArray(result.suggestions)).toBe(true);
    for (const s of result.suggestions) {
      expect(s.category).toBe("summary");
    }
  });

  it("returns tone suggestions", async () => {
    const result = await provider.analyze("tone", { resume: normalized });
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});
