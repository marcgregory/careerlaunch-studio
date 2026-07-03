import { describe, expect, it } from "vitest";
import { defaultSectionOrder, sampleResume, scoreResume } from "./index";

describe("scoreResume", () => {
  it("scores the sample resume as ready enough for the first demo", () => {
    const result = scoreResume(sampleResume);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.checks).toHaveLength(6);
  });

  it("ships the starter resume with a valid template selection", () => {
    expect(sampleResume.templateId).toBe("modern");
    expect(sampleResume.sectionOrder).toEqual(defaultSectionOrder);
  });
});

