import { describe, it, expect } from "vitest";
import { parseResumeText } from "../../src/import/text-parser";

/* ------------------------------------------------------------------ */
/*  Import parser regression test                                      */
/* ------------------------------------------------------------------ */

const SAMPLE_RESUME_TEXT = `Jordan Lee
jordan.lee@email.com
(555) 014-7291
Austin, TX
linkedin.com/in/jordanlee

Professional Summary
Customer-focused operations specialist with 6 years of experience improving service workflows, training frontline teams, and translating customer feedback into measurable retention gains.

Experience
Operations Lead | Northstar Market | 2021 - Present
• Improved weekly customer issue resolution time by 28% by redesigning escalation playbooks.
• Trained 18 team members on service recovery, CRM notes, and customer follow-up standards.
• Partnered with managers to analyze feedback trends and reduce repeat complaints by 19%.

Retail Supervisor | Harbor Outfitters | 2018 - 2021
• Managed daily service operations for a team of 12 across high-volume weekend shifts.
• Created onboarding checklists that reduced new-hire ramp time by two weeks.

Education
B.A. Communication Studies - Texas State University, 2018

Skills
Customer onboarding, CRM documentation, Process improvement, Team training, Retention analysis, Conflict resolution

Certifications
HubSpot Customer Success Certificate
Project Management Professional (PMP)

Professional Qualities
Detail-oriented
Team player
Strong communicator
Problem solver

Projects
Service Recovery Playbook

References
Available upon request.
Jane Doe, Manager at Northstar Market - (555) 123-4567
John Smith, Director at Harbor Outfitters - (555) 987-6543
`;

describe("parseResumeText", () => {
  it("should parse skills into structured array, not embed in summary", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    // Skills should be a flat array of individual skills
    expect(Array.isArray(result.parsed.skills)).toBe(true);
    expect(result.parsed.skills!.length).toBeGreaterThanOrEqual(5);

    // Skills like "Customer onboarding" should appear in the skills array
    expect(result.parsed.skills).toContain("Customer onboarding");
    expect(result.parsed.skills).toContain("CRM documentation");

    // Skills should NOT appear in the summary text
    const summary = result.parsed.summary || "";
    expect(summary).not.toContain("Customer onboarding");
    expect(summary).not.toContain("CRM documentation");
    expect(summary).not.toContain("Retention analysis");
  });

  it("should separate certifications from other sections", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    expect(Array.isArray(result.parsed.certifications)).toBe(true);
    expect(result.parsed.certifications!.length).toBeGreaterThanOrEqual(1);
    expect(result.parsed.certifications).toContain("HubSpot Customer Success Certificate");
  });

  it("should parse professional qualities separately", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    expect(Array.isArray(result.parsed.professionalQualities)).toBe(true);
    expect(result.parsed.professionalQualities!.length).toBeGreaterThanOrEqual(2);
    expect(result.parsed.professionalQualities).toContain("Detail-oriented");
    expect(result.parsed.professionalQualities).toContain("Team player");
  });

  it("should not include references content in any parsed field", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    // References section content should be excluded
    const allText = JSON.stringify(result.parsed).toLowerCase();
    expect(allText).not.toContain("jane doe");
    expect(allText).not.toContain("john smith");
    expect(allText).not.toContain("references available");

    // Summary should not have been corrupted by references
    const summary = result.parsed.summary || "";
    expect(summary).not.toContain("Available upon request");
  });

  it("should parse experience entries with correct role/company", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    const experience = result.parsed.experience || [];
    expect(experience.length).toBeGreaterThanOrEqual(2);

    // Check deduplication: role should not contain company name
    const operationsLead = experience.find((e) => e.role?.includes("Operations Lead"));
    expect(operationsLead).toBeDefined();
    expect(operationsLead!.company).toBe("Northstar Market");
    // The dedup logic should ensure role doesn't just repeat company
    expect(operationsLead!.role).not.toBe("Northstar Market");

    // Bullets should be populated
    const retailSup = experience.find((e) => e.role?.includes("Retail Supervisor"));
    expect(retailSup).toBeDefined();
    expect(retailSup!.bullets.length).toBeGreaterThanOrEqual(1);
  });

  it("should parse contact information correctly", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    expect(result.parsed.contact?.fullName).toBe("Jordan Lee");
    expect(result.parsed.contact?.email).toBe("jordan.lee@email.com");
    expect(result.parsed.contact?.phone).toBe("(555) 014-7291");
  });

  it("should produce a valid summary", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    const summary = result.parsed.summary || "";
    expect(summary.length).toBeGreaterThan(50);
    expect(summary).toContain("Customer-focused");
  });

  it("should return a confidence score", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    expect(result.confidence).toBeGreaterThanOrEqual(50);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

describe("parseResumeText edge cases", () => {
  it("should handle empty text", () => {
    const result = parseResumeText("");

    expect(result.confidence).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should handle text with 'References available upon request' boilerplate", () => {
    const text = `John Smith
john@example.com

Experience
Developer | Acme | 2020 - Present
• Built things.

References available upon request.`;

    const result = parseResumeText(text);
    // The references boilerplate should not contaminate any field
    const allText = JSON.stringify(result.parsed).toLowerCase();
    expect(allText).not.toContain("references available");
  });
});
