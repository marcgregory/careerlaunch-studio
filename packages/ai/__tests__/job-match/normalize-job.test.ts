import { describe, it, expect } from "vitest";
import { normalizeJobDescription } from "../../src/job-match/normalize-job";

describe("normalizeJobDescription", () => {
  it("returns empty result for empty string", () => {
    const result = normalizeJobDescription("");
    expect(result.tokens).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.experience).toEqual([]);
  });

  it("returns empty result for whitespace-only string", () => {
    const result = normalizeJobDescription("   ");
    expect(result.tokens).toEqual([]);
    expect(result.skills).toEqual([]);
  });

  it("tokenizes text into lowercase tokens", () => {
    const result = normalizeJobDescription("We are looking for a Senior Engineer.");
    expect(result.tokens).toContain("we");
    expect(result.tokens).toContain("looking");
    expect(result.tokens).toContain("senior");
    expect(result.tokens).toContain("engineer");
  });

  it("strips punctuation from tokens", () => {
    const result = normalizeJobDescription("React, TypeScript, and Python.");
    expect(result.tokens).toContain("react");
    expect(result.tokens).toContain("typescript");
    expect(result.tokens).toContain("python");
  });

  it("extracts known skills from job description", () => {
    const result = normalizeJobDescription(
      "We need a developer with React, TypeScript, and AWS experience.",
    );
    expect(result.skills).toContain("react");
    expect(result.skills).toContain("typescript");
    expect(result.skills).toContain("aws");
  });

  it("ignores unknown tokens that aren't in the skill dictionary", () => {
    const result = normalizeJobDescription("Looking for a ninja rockstar coder.");
    expect(result.skills).toEqual([]);
  });

  it("extracts years of experience", () => {
    const result = normalizeJobDescription("5+ years of experience with React.");
    expect(result.experience).toContain("5+ years");
  });

  it("extracts seniority keywords", () => {
    const result = normalizeJobDescription("Senior Staff Engineer position.");
    expect(result.experience).toContain("senior");
    expect(result.experience).toContain("staff");
  });

  it("deduplicates experience indicators", () => {
    const result = normalizeJobDescription(
      "Senior role. Senior engineer. 3 years experience.",
    );
    expect(result.experience.filter((e) => e === "senior")).toHaveLength(1);
  });

  it("handles multi-word skills like 'machine learning'", () => {
    const result = normalizeJobDescription("Experience with machine learning and deep learning.");
    expect(result.skills).toContain("machine learning");
    expect(result.skills).toContain("deep learning");
  });

  it("extracts skills case-insensitively", () => {
    const result = normalizeJobDescription("REACT, TYPESCRIPT, PYTHON");
    expect(result.skills).toContain("react");
    expect(result.skills).toContain("typescript");
    expect(result.skills).toContain("python");
  });

  it("returns sorted skills", () => {
    const result = normalizeJobDescription("Python and React and AWS");
    expect(result.skills).toEqual(["aws", "python", "react"]);
  });
});
