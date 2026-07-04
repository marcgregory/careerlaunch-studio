/**
 * Tests for the Job Analysis module.
 */
import { describe, it, expect } from "vitest";
import { deterministicAnalyzeJob } from "../../src/job-analysis/index";
import { emptyJobAnalysis } from "../../src/job-analysis/types";
import type { JobAnalysisInput } from "../../src/job-analysis/types";

describe("deterministicAnalyzeJob", () => {
  it("extracts required skills from a job description", () => {
    const input: JobAnalysisInput = {
      jobDescription: "We need a Senior React Developer with TypeScript, Node.js, and AWS experience.",
    };
    const result = deterministicAnalyzeJob(input);
    expect(result.requiredSkills.length).toBeGreaterThanOrEqual(1);
    expect(result.seniority).toBe("senior");
  });

  it("returns unknown seniority for ambiguous descriptions", () => {
    const input: JobAnalysisInput = {
      jobDescription: "Looking for a team player with good communication skills.",
    };
    const result = deterministicAnalyzeJob(input);
    expect(result.seniority).toBe("unknown");
  });

  it("returns empty arrays for empty input", () => {
    const input: JobAnalysisInput = { jobDescription: "" };
    const result = deterministicAnalyzeJob(input);
    expect(Array.isArray(result.requiredSkills)).toBe(true);
    expect(Array.isArray(result.preferredSkills)).toBe(true);
    expect(Array.isArray(result.atsKeywords)).toBe(true);
  });

  it("detects technology industry", () => {
    const input: JobAnalysisInput = {
      jobDescription: "Full Stack Developer, AWS, React, Node.js",
    };
    const result = deterministicAnalyzeJob(input);
    expect(result.industry).toBe("technology");
  });

  it("detects healthcare industry", () => {
    const input: JobAnalysisInput = {
      jobDescription: "Clinical Nurse Manager for hospital ward",
    };
    const result = deterministicAnalyzeJob(input);
    expect(result.industry).toBe("healthcare");
  });

  it("detects entry level seniority", () => {
    const input: JobAnalysisInput = {
      jobDescription: "Entry level JavaScript developer internship",
    };
    const result = deterministicAnalyzeJob(input);
    expect(result.seniority).toBe("entry");
  });

  it("uses empty analysis defaults when needed", () => {
    const empty = emptyJobAnalysis();
    expect(empty.requiredSkills).toEqual([]);
    expect(empty.seniority).toBe("unknown");
    expect(empty.industry).toBeNull();
  });
});
