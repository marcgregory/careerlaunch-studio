/**
 * Tests for the Safety Flag detection in the Tailoring post-process module.
 */
import { describe, it, expect } from "vitest";
import { detectSafetyFlags } from "../../src/tailoring/index";
import type { TailorSuggestion } from "../../src/tailoring/types";

describe("detectSafetyFlags", () => {
  it("detects fabricated metrics", () => {
    const suggestion: TailorSuggestion = {
      id: "exp:rewrite:exp-1",
      category: "experience",
      location: { sectionId: "exp-1", entryId: "exp-1", field: "bullets[0]" },
      before: "Built React components for the main product",
      after: "Built React components for the main product, improving performance by 40%",
      reason: "Add impact metric",
      confidence: 0.9,
      severity: "minor",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.some((f) => f.type === "fabricated_metric")).toBe(true);
  });

  it("does not flag metrics present in the original", () => {
    const suggestion: TailorSuggestion = {
      id: "exp:rewrite:exp-1",
      category: "experience",
      location: { sectionId: "exp-1", entryId: "exp-1", field: "bullets[0]" },
      before: "Improved performance by 40% through React optimization",
      after: "Improved performance by 40% through React component optimization",
      reason: "Clarify contribution",
      confidence: 0.9,
      severity: "minor",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.some((f) => f.type === "fabricated_metric")).toBe(false);
  });

  it("detects leadership inflation", () => {
    const suggestion: TailorSuggestion = {
      id: "exp:rewrite:exp-1",
      category: "experience",
      location: { sectionId: "exp-1", entryId: "exp-1", field: "bullets[0]" },
      before: "Assisted the team with React component development",
      after: "Led the team in React component development and architecture",
      reason: "Strengthen leadership language",
      confidence: 0.9,
      severity: "minor",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.some((f) => f.type === "leadership_inflation")).toBe(true);
  });

  it("does not flag when no weak-to-strong verb shift occurs", () => {
    const suggestion: TailorSuggestion = {
      id: "exp:rewrite:exp-1",
      category: "experience",
      location: { sectionId: "exp-1", entryId: "exp-1", field: "bullets[0]" },
      before: "Built React components for the product",
      after: "Built React components for the main product dashboard",
      reason: "Specify scope",
      confidence: 0.9,
      severity: "minor",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.some((f) => f.type === "leadership_inflation")).toBe(false);
  });

  it("detects responsibility expansion", () => {
    const suggestion: TailorSuggestion = {
      id: "exp:rewrite:exp-1",
      category: "experience",
      location: { sectionId: "exp-1", entryId: "exp-1", field: "bullets[0]" },
      before: "Built React components for the main product using TypeScript and Redux.",
      after: "Built React components for the main product using TypeScript and Redux. Managed a team of 5 developers and coordinated with cross-functional teams including marketing, sales, and operations to deliver the product roadmap.",
      reason: "Expand scope",
      confidence: 0.9,
      severity: "minor",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.some((f) => f.type === "responsibility_expansion")).toBe(true);
  });

  it("returns empty flags for safe suggestions", () => {
    const suggestion: TailorSuggestion = {
      id: "skills:add-0:skills",
      category: "skills",
      location: { sectionId: "skills" },
      before: "",
      after: "AWS",
      reason: "Add AWS to match job requirements.",
      confidence: 0.9,
      severity: "major",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags.length).toBe(0);
  });

  it("returns empty flags when before is empty", () => {
    const suggestion: TailorSuggestion = {
      id: "skills:add-0:skills",
      category: "skills",
      location: { sectionId: "skills" },
      before: "",
      after: "Machine Learning",
      reason: "Add ML skills",
      confidence: 0.9,
      severity: "major",
    };
    const flags = detectSafetyFlags(suggestion);
    expect(flags).toEqual([]);
  });
});
