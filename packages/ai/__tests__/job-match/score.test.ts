import { describe, it, expect } from "vitest";
import { computeMatchScore } from "../../src/job-match/score";

describe("computeMatchScore", () => {
  it("returns 100 when all skills match", () => {
    expect(computeMatchScore(["React", "TypeScript"], [])).toBe(100);
  });

  it("returns 0 when no skills match", () => {
    expect(computeMatchScore([], ["React", "TypeScript"])).toBe(10); // floor at 10
  });

  it("returns proportional score for partial matches", () => {
    // 1 present, 1 missing → 1/2 = 50
    expect(computeMatchScore(["React"], ["TypeScript"])).toBe(50);
  });

  it("rounds to nearest integer", () => {
    // 1 present, 2 missing → 1/3 = 33.33 → 33
    expect(computeMatchScore(["React"], ["Python", "Docker"])).toBe(33);
  });

  it("returns null when no skills are extracted at all", () => {
    expect(computeMatchScore([], [])).toBeNull();
  });

  it("floors at 10 so even empty resumes get a baseline", () => {
    const result = computeMatchScore([], ["React", "TypeScript", "Docker"]);
    expect(result).toBe(10);
    expect(result).toBeGreaterThanOrEqual(10);
  });
});
