import { describe, expect, it } from "vitest";
import {
  createSkillMap,
  expandSkillList,
  skillsMatch as matches,
  splitSkillItems,
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
  it("splits grouped skills without splitting parenthetical details", () => {
    expect(splitSkillItems("Frontend: HTML, CSS, JavaScript")).toEqual([
      "HTML",
      "CSS",
      "JavaScript",
    ]);
    expect(splitSkillItems("AWS (EC2, S3, Lambda)")).toEqual([
      "AWS (EC2, S3, Lambda)",
    ]);
  });


  it("expands grouped skills into deduplicated individual skills", () => {
    expect(expandSkillList([
      "Frontend: HTML, CSS, JavaScript, React JS, Next.js, and TypeScript",
      "Backend: Node.js, Prisma, PostgreSQL",
      "frontend: html",
    ])).toEqual({
      skills: ["HTML", "CSS", "JavaScript", "React JS", "Next.js", "TypeScript", "Node.js", "Prisma", "PostgreSQL"],
      count: 9,
      categoryCount: 2,
    });
  });
  it("indexes comma-packed and categorized skill strings", () => {
    const map = createSkillMap(["Frontend: HTML, CSS, JavaScript"]);
    expect(map.get("html")).toBe("HTML");
    expect(map.get("css")).toBe("CSS");
    expect(map.get("javascript")).toBe("JavaScript");
  });
});
