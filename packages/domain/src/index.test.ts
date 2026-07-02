import { describe, expect, it } from "vitest";
import { sampleResume, scoreResume } from "./index";

describe("scoreResume", () => {
  it("scores the sample resume as ready enough for the first demo", () => {
    const result = scoreResume(sampleResume);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.checks).toHaveLength(6);
  });
});

