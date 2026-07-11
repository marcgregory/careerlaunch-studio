import { describe, expect, it } from "vitest";
import {
  skillsMatch as matches,
  uniqueSkillsByNormalization,
} from "../../src/skills/normalization";

describe("skill normalization", () => {
  it("matches skills case-insensitively", () => {
    expect(matches("HTML", "html")).toBe(true);
    expect(matches("Html", "HTML")).toBe(true);
    expect(matches("JavaScript", "javascript")).toBe(true);
  });

  it("matches controlled aliases and harmless formatting differences", () => {
    expect(matches("React JS", "react.js")).toBe(true);
    expect(matches("Node.js", "nodejs")).toBe(true);
    expect(matches("PostgreSQL", "Postgres")).toBe(true);
    expect(matches("Tailwind CSS", "tailwindcss")).toBe(true);
    expect(matches("GitHub", "Github")).toBe(true);
  });

  it("does not merge unrelated skills", () => {
    expect(matches("Java", "JavaScript")).toBe(false);
    expect(matches("Go", "Google Cloud")).toBe(false);
    expect(matches("React", "React Native")).toBe(false);
  });

  it("deduplicates by normalized skill while preserving first display value", () => {
    expect(uniqueSkillsByNormalization(["HTML", "Html", "html"])).toEqual([
      "HTML",
    ]);
  });
});
