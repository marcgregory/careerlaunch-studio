import { describe, it, expect } from "vitest";
import { PLANS, can, getFeatureValue, canUseTemplate, getResumeLimit } from "./plans";

describe("PLANS", () => {
  it("defines free plan with limited entitlements", () => {
    const free = PLANS.free;
    expect(free.label).toBe("Free");
    expect(free.entitlements.resume_limit).toBe(3);
    expect(free.entitlements.pdf_export).toBe("watermarked");
    expect(free.entitlements.premium_templates).toBe(false);
    expect(free.entitlements.job_match).toBe(false);
    expect(free.entitlements.monthly_exports).toBe(5);
  });

  it("defines professional plan with full entitlements", () => {
    const pro = PLANS.professional;
    expect(pro.label).toBe("Professional");
    expect(pro.entitlements.resume_limit).toBe(Infinity);
    expect(pro.entitlements.pdf_export).toBe("clean");
    expect(pro.entitlements.premium_templates).toBe(true);
    expect(pro.entitlements.job_match).toBe(true);
    expect(pro.entitlements.templates).toEqual({ kind: "all" });
  });

  it("defines enterprise plan with all entitlements", () => {
    const ent = PLANS.enterprise;
    expect(ent.entitlements.priority_support).toBe(true);
    expect(ent.entitlements.resume_limit).toBe(Infinity);
    expect(ent.entitlements.pdf_export).toBe("clean");
  });
});

describe("can()", () => {
  it("returns false for features not in a plan", () => {
    expect(can("free", "job_match")).toBe(false);
    expect(can("free", "premium_templates")).toBe(false);
    expect(can("free", "priority_support")).toBe(false);
  });

  it("returns true for features available in a plan", () => {
    expect(can("free", "ai_analysis")).toBe(true);
    expect(can("free", "cover_letter")).toBe(true);
    expect(can("professional", "job_match")).toBe(true);
    expect(can("professional", "premium_templates")).toBe(true);
    expect(can("enterprise", "priority_support")).toBe(true);
  });

  it("returns true for professional plan full features", () => {
    expect(can("professional", "ai_analysis")).toBe(true);
    expect(can("professional", "cover_letter")).toBe(true);
    expect(can("professional", "job_match")).toBe(true);
    expect(can("professional", "premium_templates")).toBe(true);
  });
});

describe("canUseTemplate()", () => {
  it("free plan only allows modern and minimal", () => {
    expect(canUseTemplate("free", "modern")).toBe(true);
    expect(canUseTemplate("free", "minimal")).toBe(true);
    expect(canUseTemplate("free", "executive")).toBe(false);
    expect(canUseTemplate("free", "ats")).toBe(false);
  });

  it("professional plan allows all templates", () => {
    expect(canUseTemplate("professional", "modern")).toBe(true);
    expect(canUseTemplate("professional", "executive")).toBe(true);
    expect(canUseTemplate("professional", "minimal")).toBe(true);
    expect(canUseTemplate("professional", "ats")).toBe(true);
  });

  it("enterprise plan allows all templates", () => {
    expect(canUseTemplate("enterprise", "modern")).toBe(true);
    expect(canUseTemplate("enterprise", "executive")).toBe(true);
  });
});

describe("getResumeLimit()", () => {
  it("free plan limits to 3 resumes", () => {
    expect(getResumeLimit("free")).toBe(3);
  });

  it("professional plan has unlimited resumes", () => {
    expect(getResumeLimit("professional")).toBe(Infinity);
  });
});

describe("getFeatureValue()", () => {
  it("returns exact feature values", () => {
    expect(getFeatureValue("free", "pdf_export")).toBe("watermarked");
    expect(getFeatureValue("professional", "pdf_export")).toBe("clean");
    expect(getFeatureValue("free", "monthly_exports")).toBe(5);
    expect(getFeatureValue("professional", "monthly_exports")).toBe(Infinity);
  });
});
