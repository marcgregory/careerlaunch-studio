import { describe, it, expect } from "vitest";
import { sampleResume } from "@careerlaunch/domain";
import { normalizeResume } from "../../src/analysis/normalize.js";

describe("normalizeResume", () => {
  it("maps contact fields correctly", () => {
    const normalized = normalizeResume(sampleResume);
    expect(normalized.contact.fullName).toBe(sampleResume.contact.fullName);
    expect(normalized.contact.email).toBe(sampleResume.contact.email);
    expect(normalized.contact.phone).toBe(sampleResume.contact.phone);
  });

  it("maps experience sections", () => {
    const normalized = normalizeResume(sampleResume);
    const expSections = normalized.sections.filter((s) => s.type === "experience");
    expect(expSections).toHaveLength(sampleResume.experience.length);
    expect(expSections[0].role).toBe(sampleResume.experience[0].role);
    expect(expSections[0].bullets).toEqual(sampleResume.experience[0].bullets);
  });

  it("maps education sections", () => {
    const normalized = normalizeResume(sampleResume);
    const eduSections = normalized.sections.filter((s) => s.type === "education");
    expect(eduSections).toHaveLength(sampleResume.education.length);
    expect(eduSections[0].school).toBe(sampleResume.education[0].school);
  });

  it("maps skills, certifications, and projects", () => {
    const normalized = normalizeResume(sampleResume);
    expect(normalized.skills).toEqual(sampleResume.skills);
    expect(normalized.certifications).toEqual(sampleResume.certifications);
    expect(normalized.projects).toHaveLength(sampleResume.projects.length);
    expect(normalized.projects[0].name).toBe(sampleResume.projects[0].name);
  });

  it("maps experience date ranges", () => {
    const normalized = normalizeResume(sampleResume);
    const expSection = normalized.sections.find((s) => s.type === "experience")!;
    expect(expSection.dateRange?.start).toBe(sampleResume.experience[0].start);
    expect(expSection.dateRange?.end).toBe(sampleResume.experience[0].end);
  });
});
