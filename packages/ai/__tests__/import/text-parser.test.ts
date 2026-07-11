import { describe, it, expect } from "vitest";
import { parseResumeText, deriveImportQuality } from "../../src/import/text-parser";

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

  it("should not include references content in any other parsed field", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    // References should be parsed into the references array
    const references = result.parsed.references || [];
    expect(references.length).toBeGreaterThan(0);

    // References boilerplate should NOT appear in summary
    const summary = result.parsed.summary || "";
    expect(summary).not.toContain("Available upon request");
    expect(summary).not.toContain("references available");

    // Reference names should NOT appear in experience, skills, or education
    const experienceText = JSON.stringify(result.parsed.experience || []).toLowerCase();
    expect(experienceText).not.toContain("jane doe");
    expect(experienceText).not.toContain("john smith");

    const skillsText = JSON.stringify(result.parsed.skills || []).toLowerCase();
    expect(skillsText).not.toContain("jane doe");

    const educationText = JSON.stringify(result.parsed.education || []).toLowerCase();
    expect(educationText).not.toContain("jane doe");
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

describe("parseResumeText confidence scoring", () => {
  const fullResume = `Jordan Lee
jordan.lee@email.com
(555) 014-7291
Austin, TX

Professional Summary
Customer-focused operations specialist with 6 years of experience.

Experience
Operations Lead | Northstar Market | 2021 - Present
• Improved resolution time by 28%.

Retail Supervisor | Harbor Outfitters | 2018 - 2021
• Managed a team of 12.

Education
B.A. Communication Studies - Texas State University, 2018

Skills
Customer onboarding, CRM documentation, Process improvement, Team training

Certifications
HubSpot Customer Success Certificate
Project Management Professional (PMP)

Professional Qualities
Detail-oriented
Team player
Strong communicator
Problem solver`;

  it("should return confidenceBySection with all section keys", () => {
    const result = parseResumeText(fullResume);
    const sections = Object.keys(result.confidenceBySection);
    expect(sections).toContain("summary");
    expect(sections).toContain("experience");
    expect(sections).toContain("education");
    expect(sections).toContain("skills");
    expect(sections).toContain("certifications");
    expect(sections).toContain("professionalQualities");
  });

  it("should score high for sections with strong headers and clean content", () => {
    const result = parseResumeText(fullResume);
    expect(result.confidenceBySection.summary).toBe("high");
    expect(result.confidenceBySection.experience).toBe("high");
    expect(result.confidenceBySection.education).toBe("high");
  });

  it("should score low for sections not present in the text", () => {
    const result = parseResumeText(fullResume);
    // No projects section in text
    expect(result.confidenceBySection.projects).toBe("low");
  });

  it("should score medium when a section header exists but content is weak", () => {
    // Certifications header exists but only 1 entry
    const text = `Test User\ntest@email.com\n\nCertifications\nBasic Cert\n\nExperience\nDeveloper | Acme | 2020 - Present\n• Worked.`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.certifications).toBe("medium");
  });

  it("should score high for certifications with 2+ full-name entries", () => {
    const text = `Test User\ntest@email.com\n\nCertifications\nProject Management Professional (PMP)\nAWS Solutions Architect Professional`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.certifications).toBe("high");
  });

  it("should score high for skills with 5+ entries", () => {
    const text = `Test User\ntest@email.com\n\nSkills\nPython, TypeScript, React, Node.js, PostgreSQL, Docker`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.skills).toBe("high");
  });

  it("should score medium for skills with 1-4 entries", () => {
    const text = `Test User\ntest@email.com\n\nSkills\nPython, TypeScript`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.skills).toBe("medium");
  });

  it("should score low for missing sections with no header detected", () => {
    const result = parseResumeText("John Doe\njohn@example.com");
    expect(result.confidenceBySection.experience).toBe("low");
    expect(result.confidenceBySection.education).toBe("low");
  });

  it("should score high for professional qualities with 3+ entries", () => {
    const text = `Test User\ntest@email.com\n\nProfessional Qualities\nDetail-oriented\nTeam player\nStrong communicator`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.professionalQualities).toBe("high");
  });

  it("should score high for references with content when header detected", () => {
    const text = `Test User\ntest@email.com\n\nReferences\nJane Doe, Manager\nJohn Smith, Director`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.references).toBe("high");
  });

  it("should score medium for experience with entries but weak structure", () => {
    // Experience section with an entry that has "Unknown Role"
    const text = `Test User\ntest@email.com\n\nExperience\nSome random text without date pattern\nOther text`;
    const result = parseResumeText(text);
    // Should be medium since entries may have unknown role
    expect(["medium", "low"]).toContain(result.confidenceBySection.experience);
  });

  it("should score low for empty text", () => {
    const result = parseResumeText("");
    const allLow = Object.values(result.confidenceBySection).every(
      (v) => v === "low",
    );
    expect(allLow).toBe(true);
  });

  it("should score low when section header detected but no content parsed", () => {
    // A header line is detected but no actionable content follows
    const text = `Test User\ntest@email.com\n\nSkills\n\nExperience\nDeveloper | Acme | 2020 - Present\n• Worked.`;
    const result = parseResumeText(text);
    expect(result.confidenceBySection.skills).toBe("low");
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


describe("parseResumeText Bug Fix regression tests", () => {
  /* ------------------------------------------------------------------ */
  /*  Bug 1: Skills "Category Proficiency" table bleeds into Summary     */
  /* ------------------------------------------------------------------ */
  it("Bug 1: should NOT append skills category/proficiency table to summary", () => {
    const text = `Jane Smith
jane@example.com

Professional Summary
Experienced engineer with cloud infrastructure expertise.

Category                    Proficiency
Frontend                    Advanced
Backend                     Advanced

Skills
React, TypeScript, Node.js, PostgreSQL`;

    const result = parseResumeText(text);
    const summary = result.parsed.summary || "";
    // Summary should contain only the prose, not the table rows
    expect(summary).toContain("Experienced engineer");
    expect(summary).not.toContain("Category");
    expect(summary).not.toContain("Proficiency");
    expect(summary).not.toContain("Frontend");
    expect(summary).not.toContain("Advanced");
  });

  /* ------------------------------------------------------------------ */
  /*  Bug 2: Experience bullet continuation lines are preserved          */
  /* ------------------------------------------------------------------ */
  it("Bug 2: should preserve bullet continuation lines without dropping fragments", () => {
    const text = `Test User
test@email.com

Experience
Senior Developer
CompanyXYZ
Jan 2020 - Present
- Led team through major migration project
with multiple subsystems and cross-team coordination.
timelines were met.
- Built CI/CD pipeline reducing deploy time.
- Mentored 3 junior developers.`;

    const result = parseResumeText(text);
    const experience = result.parsed.experience || [];
    expect(experience.length).toBeGreaterThanOrEqual(1);

    const entry = experience[0];
    // The continuation lines should be merged into the preceding bullet
    const mergedBullet = entry.bullets.find((b) =>
      b.includes("major migration project")
    );
    expect(mergedBullet).toBeDefined();
    expect(mergedBullet).toContain("timelines were met");
    // All bullets should be present
    expect(entry.bullets.length).toBe(3);
  });

  /* ------------------------------------------------------------------ */
  /*  Bug 3: Education retains all fields (graduation year extracted)    */
  /* ------------------------------------------------------------------ */
  it("Bug 3: should extract graduation year from school line", () => {
    const text = `Test User
test@email.com

Education
Bachelor of Science in Computer Science
University of Washington, 2016

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const education = result.parsed.education || [];
    expect(education.length).toBe(1);

    const edu = education[0];
    expect(edu.school).toBe("University of Washington");
    expect(edu.graduation).toBe("2016");
    expect(edu.degree).toBe("Bachelor of Science in Computer Science");
  });

  it("Bug 3: should handle single-line education with year embedded in school", () => {
    const text = `Test User
test@email.com

Education
B.S. Computer Science - University of Washington, 2016

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const education = result.parsed.education || [];
    expect(education.length).toBe(1);
    const edu = education[0];
    expect(edu.school).toBe("University of Washington");
    expect(edu.graduation).toBe("2016");
    expect(edu.degree).toBe("B.S. Computer Science");
  });

  /* ------------------------------------------------------------------ */
  /*  Bug 4: Skills section coverage is accurate                        */
  /* ------------------------------------------------------------------ */
  it("Bug 4: Skills coverage should reflect parsed skill words", () => {
    const text = `Test User
test@email.com

Skills
Frontend                    HTML, CSS, TypeScript, React
Backend                     Node.js, Python, PostgreSQL
Cloud                       AWS, Docker, CI/CD

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const skillsCoverage = result.coverage.find((c) => c.sectionId === "skills");
    expect(skillsCoverage).toBeDefined();
    // Skills should have non-zero original word count
    expect(skillsCoverage!.originalWordCount).toBeGreaterThan(0);
    // Skills should have non-zero parsed word count (we parse the last column)
    expect(skillsCoverage!.parsedWordCount).toBeGreaterThan(0);
    // Skills array should have items
    expect(result.parsed.skills!.length).toBeGreaterThanOrEqual(3);
    // Should include actual skills not just proficiency levels
    expect(result.parsed.skills).toContain("Frontend: HTML");
    expect(result.parsed.skills).toContain("Frontend: React");
  });

  /* ------------------------------------------------------------------ */
  /*  Bug 5: Projects are detected and preserved                        */
  /* ------------------------------------------------------------------ */
  it("Bug 5: should detect projects section and preserve project entries with bullets", () => {
    const text = `Test User
test@email.com

Skills
React, TypeScript

Projects
Task Manager App
- Built a full-stack task management application.
- Implemented real-time collaboration features.
- Deployed on AWS with Docker.

Portfolio Website
- Designed and developed personal portfolio.
- Integrated with headless CMS.

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const projects = result.parsed.projects || [];
    expect(projects.length).toBe(2);

    const taskManager = projects.find((p) => p.name === "Task Manager App");
    expect(taskManager).toBeDefined();
    expect(taskManager!.bullets.length).toBe(3);
    expect(taskManager!.bullets[0]).toContain("full-stack task management");

    const portfolio = projects.find((p) => p.name === "Portfolio Website");
    expect(portfolio).toBeDefined();
    expect(portfolio!.bullets.length).toBe(2);
  });

  it("Bug 5: should detect projects when they appear before experience section and preserve bullet continuations", () => {
    const text = `Test User
test@email.com

Skills
React, TypeScript

Projects
Data Pipeline
- Built ETL pipeline processing 10M records/day.
- Used Apache Kafka and Spark for stream processing.

Analytics Dashboard
- Created real-time dashboard with React and D3.js.
- Implemented WebSocket-based live updates.

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const projects = result.parsed.projects || [];
    expect(projects.length).toBe(2);
    const pipeline = projects.find((p) => p.name === "Data Pipeline");
    expect(pipeline).toBeDefined();
    expect(pipeline!.bullets.length).toBe(2);

    const dashboard = projects.find((p) => p.name === "Analytics Dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard!.bullets.length).toBe(2);
  });
});

describe("parseResumeText date-only line format", () => {
  it("should handle date-only line format (role + company on separate lines)", () => {
    const text = `Maria Santos
maria@example.com

Experience
Software Developer
Volenday Philippines Inc.
Feb 2023 -- May 2025
  - Built and maintained React components for 4 client-facing applications.
  - Reduced API response time by 35% through query optimization.
  - Mentored 3 junior developers on React and TypeScript best practices.

IT Staff
Tech Solutions Co.
Jan 2020 -- Dec 2022
  - Supported 200+ end users across 3 departments.
  - Configured and maintained 80+ workstations.
  - Achieved 99% network uptime over 24-month period.`;

    const result = parseResumeText(text);
    const experience = result.parsed.experience || [];

    expect(experience.length).toBe(2);

    const dev = experience[0];
    expect(dev.role).toBe("Software Developer");
    expect(dev.company).toBe("Volenday Philippines Inc.");
    expect(dev.start).toMatch(/Feb/i);
    expect(dev.end).toMatch(/May 2025/i);
    expect(dev.bullets.length).toBe(3);

    const itStaff = experience[1];
    expect(itStaff.role).toBe("IT Staff");
    expect(itStaff.company).toBe("Tech Solutions Co.");
    expect(itStaff.start).toMatch(/Jan/i);
    expect(itStaff.end).toMatch(/Dec 2022/i);
    expect(itStaff.bullets.length).toBe(3);
  });

  it("should handle mixed formats (inline dates + date-only lines)", () => {
    const text = `Test User\ntest@email.com\n\nExperience\nDeveloper | Acme Inc | 2020 - 2023\n  - Worked on features.\n\nIT Staff\nTech Co.\nJan 2022 - Present\n  - Supported users.`;

    const result = parseResumeText(text);
    const experience = result.parsed.experience || [];

    expect(experience.length).toBe(2);

    const inlineEntry = experience[0];
    expect(inlineEntry.role).toBe("Developer");
    expect(inlineEntry.company).toBe("Acme Inc");

    const dateOnlyEntry = experience[1];
    expect(dateOnlyEntry.role).toBe("IT Staff");
    expect(dateOnlyEntry.company).toBe("Tech Co.");
  });
});

/* ------------------------------------------------------------------ */
/*  deriveImportQuality regression tests                               */
/* ------------------------------------------------------------------ */

describe("deriveImportQuality", () => {
  function makeCoverageItem(sectionId: string, ratio: number, status: string) {
    return {
      sectionId,
      originalWordCount: 100,
      parsedWordCount: Math.round(100 * ratio),
      ratio,
      status,
    };
  }

  it("should return excellent when all critical sections are >= 90%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.95, "good"),
      makeCoverageItem("education", 0.92, "good"),
      makeCoverageItem("skills", 0.91, "good"),
    ];
    expect(deriveImportQuality(coverage)).toBe("excellent");
  });

  it("should return good when all critical sections are >= 80%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.85, "good"),
      makeCoverageItem("education", 0.88, "good"),
      makeCoverageItem("skills", 0.81, "good"),
    ];
    expect(deriveImportQuality(coverage)).toBe("good");
  });

  it("should return fair when all critical sections are >= 50%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.65, "partial"),
      makeCoverageItem("education", 0.72, "partial"),
      makeCoverageItem("skills", 0.55, "partial"),
    ];
    expect(deriveImportQuality(coverage)).toBe("fair");
  });

  it("should return poor when any critical section is below 50%", () => {
    const coverage = [
      makeCoverageItem("experience", 0.21, "poor"),
      makeCoverageItem("education", 0.24, "poor"),
      makeCoverageItem("skills", 0.45, "partial"),
    ];
    expect(deriveImportQuality(coverage)).toBe("poor");
  });

  it("should return failed when any critical section ratio is 0", () => {
    const coverage = [
      makeCoverageItem("experience", 0.0, "missing"),
      makeCoverageItem("education", 0.0, "missing"),
      makeCoverageItem("skills", 0.0, "missing"),
    ];
    expect(deriveImportQuality(coverage)).toBe("failed");
  });

  it("should return failed when one critical section is preserved but another is 0", () => {
    const coverage = [
      makeCoverageItem("experience", 0.9, "good"),
      makeCoverageItem("education", 0.0, "missing"),
      makeCoverageItem("skills", 0.85, "good"),
    ];
    expect(deriveImportQuality(coverage)).toBe("failed");
  });

  it("should return fair when there are no critical sections in coverage", () => {
    const coverage = [
      makeCoverageItem("summary", 0.9, "good"),
      makeCoverageItem("references", 1.0, "good"),
    ];
    expect(deriveImportQuality(coverage)).toBe("fair");
  });
});

/* ------------------------------------------------------------------ */
/*  importQuality integration — must NOT contradict coverage           */
/* ------------------------------------------------------------------ */

describe("parseResumeText importQuality integration", () => {
  it("should not report high quality when critical coverage is below threshold", () => {
    // Regression: confidence heuristic used to report 90 when
    // experience/education coverage was 21%/24%.
    const text = `Jordan Lee
jordan.lee@email.com

Experience
Ops person
Some Company
2021 - Present
• Worked.

Education
B.A. Studies
State University, 2018

Skills
Stuff`;

    const result = parseResumeText(text);
    // importQuality must reflect actual coverage — not a crude heuristic
    const expCov = result.coverage.find((c) => c.sectionId === "experience");
    const eduCov = result.coverage.find((c) => c.sectionId === "education");
    if (expCov && eduCov) {
      const minRatio = Math.min(expCov.ratio, eduCov.ratio);
      if (minRatio < 0.8) {
        expect(result.importQuality).not.toBe("good");
        expect(result.importQuality).not.toBe("excellent");
      }
    }
  });

  it("should return importQuality consistent with coverage for a full resume", () => {
    const result = parseResumeText(SAMPLE_RESUME_TEXT);
    // The sample resume is clean and well-structured
    expect(["excellent", "good"]).toContain(result.importQuality);
    // Legacy confidence field should still exist
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });

  it("should return failed for empty text", () => {
    const result = parseResumeText("");
    expect(result.importQuality).toBe("failed");
    expect(result.confidence).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Parser bugfix regression tests (Sprint 6D)                         */
/* ------------------------------------------------------------------ */

describe("parser bugfix regression (Sprint 6D)", () => {
  /* Bug 6: LinkedIn URL truncated to "linkedin.com/in/" */
  it("should capture full LinkedIn profile URL", () => {
    const text = `Alex Rivera
alex.rivera@email.com
linkedin.com/in/alexrivera

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.contact?.linkedin).toContain("alexrivera");
    expect(result.parsed.contact?.linkedin).not.toMatch(/in\/?$/);
  });

  /* Bug 6: Portfolio / GitHub / location URLs routed to correct fields */
  it("should route URLs to correct contact fields", () => {
    const text = `Sam Lee
sam@example.com
github.com/samlee
samlee.dev
linkedin.com/in/samlee
San Francisco, CA

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.contact?.linkedin).toContain("samlee");
    expect(result.parsed.contact?.github).toContain("samlee");
    expect(result.parsed.contact?.website).toContain("samlee.dev");
  });

  /* Bug 6: Location with non-US format */
  it("should parse non-US location formats", () => {
    const text = `Maria Santos
maria@email.com
Manila, Philippines

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.contact?.location).toContain("Manila");
    expect(result.parsed.contact?.location).toContain("Philippines");
  });

  /* Bug 8: Education multi-line preserves school, degree, graduation year */
  it("should parse multi-line education with school on next line", () => {
    const text = `Test User
test@email.com

Education
Bachelor of Science in Computer Science
University of Washington, 2016

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const edu = result.parsed.education || [];
    expect(edu.length).toBe(1);
    expect(edu[0].school).toBe("University of Washington");
    expect(edu[0].degree).toBe("Bachelor of Science in Computer Science");
    expect(edu[0].graduation).toBe("2016");
  });

  /* Bug 8: Education single-line hyphen format */
  it("should parse single-line hyphen-format education", () => {
    const text = `Test User
test@email.com

Education
B.S. Computer Science - University of Washington, 2016

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const edu = result.parsed.education || [];
    expect(edu.length).toBe(1);
    expect(edu[0].school).toBe("University of Washington");
    expect(edu[0].degree).toBe("B.S. Computer Science");
    expect(edu[0].graduation).toBe("2016");
  });

  /* Bug 8: Education hyphen format with no year first */
  it("should parse hyphen-format education: B.A. - State University, 2018", () => {
    const text = `Test User
test@email.com

Education
B.A. Communication Studies - Texas State University, 2018

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const edu = result.parsed.education || [];
    expect(edu.length).toBe(1);
    expect(edu[0].school).toBe("Texas State University");
    expect(edu[0].degree).toBe("B.A. Communication Studies");
    expect(edu[0].graduation).toBe("2018");
  });

  /* Bug 9: Projects with descriptions */
  it("should parse project description from line between name and bullets", () => {
    const text = `Test User
test@email.com

Skills
React, TypeScript

Projects
CareerLaunch Studio
Full-stack SaaS platform for resume creation and AI-powered improvement.
- Built with Next.js, TypeScript, PostgreSQL, and Prisma ORM.
- Integrated AI analysis using Gemini and Groq APIs.

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const projects = result.parsed.projects || [];
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe("CareerLaunch Studio");
    expect(projects[0].description).toContain("Full-stack SaaS platform");
    expect(projects[0].bullets.length).toBe(2);
  });

  /* Bug 10: Achievements section parsed as achievements */
  it("should parse Achievements heading items as achievements", () => {
    const text = `Test User
test@email.com

Achievements
Employee of the Month
Top Performer Q4

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.achievements?.length).toBeGreaterThanOrEqual(2);
    expect(result.parsed.achievements).toContain("Employee of the Month");
    expect(result.parsed.achievements).toContain("Top Performer Q4");
  });

  /* Bug 10: Awards heading */
  it("should parse Awards heading as awards", () => {
    const text = `Test User
test@email.com

Awards
Best Innovation Award
Team Excellence

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.awards?.length).toBeGreaterThanOrEqual(1);
    expect(result.parsed.awards).toContain("Best Innovation Award");
  });

  /* Bug 10: Honors heading */
  it("should parse Honors heading as awards", () => {
    const text = `Test User
test@email.com

Honors
Dean's List
Summa Cum Laude

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.awards?.length).toBeGreaterThanOrEqual(2);
    expect(result.parsed.awards).toContain("Dean's List");
  });

  /* Bug 11: Volunteer experience parsed as experience entries */
  it("should parse Volunteer Experience with dates and bullets", () => {
    const text = `Test User
test@email.com

Volunteer Experience
Web Developer
Open Source Foundation
Jan 2023 - Present
- Built and maintained community website.
- Mentored new contributors.

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const volunteerEntries = result.parsed.volunteer || [];
    const volunteer = volunteerEntries.find((e) => e.role === "Web Developer");
    expect(volunteer).toBeDefined();
    expect(volunteer!.company).toBe("Open Source Foundation");
    expect(volunteer!.start).toMatch(/Jan/i);
    expect(volunteer!.end).toMatch(/Present/i);
    expect(volunteer!.bullets.length).toBe(2);
  });

  /* Bug 11: "Volunteering" section pattern */
  it("should parse 'Volunteering' header as experience", () => {
    const text = `Test User
test@email.com

Volunteering
Tutor
Community Center
2022 - 2023
- Tutored students in math and science.

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const volunteerEntries = result.parsed.volunteer || [];
    const tutor = volunteerEntries.find((e) => e.role === "Tutor");
    expect(tutor).toBeDefined();
  });

  /* Bug 11: "Community Service" section pattern */
  it("should parse Community Service section as experience", () => {
    const text = `Test User
test@email.com

Community Service
Volunteer Coordinator
Local Shelter
2021 - 2023
- Coordinated weekly volunteer shifts.

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    const volunteerEntries = result.parsed.volunteer || [];
    const coord = volunteerEntries.find((e) => e.role === "Volunteer Coordinator");
    expect(coord).toBeDefined();
  });

  /* Contact: multiple URLs on same line separated by spaces */
  it("should not lose location when preceded by URLs", () => {
    const text = `Alex Rivera
alex.rivera@email.com
(555) 000-1234
linkedin.com/in/alexrivera
github.com/alexrivera
Seattle, WA

Experience
Developer | Acme | 2020 - Present
- Worked.`;
    const result = parseResumeText(text);
    expect(result.parsed.contact?.linkedin).toContain("alexrivera");
    expect(result.parsed.contact?.github).toContain("alexrivera");
    expect(result.parsed.contact?.location).toBe("Seattle, WA");
  });
});

/* ------------------------------------------------------------------ */
/*  Sprint 6D — Comprehensive parser fixes (4 issues)                 */
/* ------------------------------------------------------------------ */

describe("Sprint 6D parser fixes", () => {
  /* Issue 1: Volunteer separated from Experience */
  it("should detect Volunteer Experience as its own section, not merge into Experience", () => {
    const text = `John Doe
john@email.com

Experience
Junior Business Analyst
Some Company
Jan 2020 - Present
- Analyzed data.
- Created reports.

Volunteer Experience
Data Mentor
Code for America
2021 - Present
- Mentored students in data analysis.
- Reviewed project submissions.`;

    const result = parseResumeText(text);
    const experience = result.parsed.experience || [];
    const volunteerEntries = result.parsed.volunteer || [];

    const volEntry = volunteerEntries.find((e) => e.company === "Code for America");
    expect(volEntry).toBeDefined();
    expect(volEntry!.role).toBe("Data Mentor");
    expect(experience).toHaveLength(1);

    // The first entry should be from Experience, not Volunteer
    expect(experience[0].company).toBe("Some Company");
  });

  /* Issue 2: Education deduplication */
  it("should NOT duplicate the same education degree — merge duplicate degree lines", () => {
    const text = `Jane Smith
jane@example.com

Education
Bachelor of Science in Information Systems
Bachelor of Science in Information Systems
University of Texas
2016

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const education = result.parsed.education || [];

    // Should only have 1 entry (deduplicated)
    expect(education.length).toBe(1);
    expect(education[0].degree).toContain("Bachelor of Science");
    // School and graduation year should be captured from subsequent lines
    expect(education[0].school && education[0].school.length > 0).toBe(true);
    expect(education[0].graduation).toBe("2016");
  });

  /* Issue 3: Em-dash separator should NOT merge separate achievements */
  it("should preserve Achievements as individual items (not merged on em-dash)", () => {
    const text = `John Q
john@example.com

Achievements
Employee of the Year (2023)
Analytics Excellence Award (2022)
Speaker at Data Summit Texas 2024

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const achievements = result.parsed.achievements || [];

    expect(achievements).toContain("Employee of the Year (2023)");
    expect(achievements).toContain("Analytics Excellence Award (2022)");
    expect(achievements).toContain("Speaker at Data Summit Texas 2024");
    expect(achievements.length).toBeGreaterThanOrEqual(3);
  });

  /* Issue 4: Project descriptions and bullets preserved */
  it("should preserve project bullets beyond just titles (no blank-line reset)", () => {
    const text = `Test User
test@email.com

Skills
React, TypeScript, Python

Projects
Sales Intelligence Dashboard
- Combined CRM and ERP data for unified sales analytics.
- Reduced executive reporting time by 95%.

Customer Churn Prediction
- Built machine learning model to predict customer churn.
- Achieved 91% accuracy with ensemble methods.

Cloud Data Warehouse Migration
- Migrated on-premise data warehouse to cloud infrastructure.
- Reduced query latency by 60%.

Experience
Developer | Acme | 2020 - Present
- Worked.`;

    const result = parseResumeText(text);
    const projects = result.parsed.projects || [];

    const dashboard = projects.find((p) => p.name === "Sales Intelligence Dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard!.bullets.length).toBeGreaterThanOrEqual(2);

    const churn = projects.find((p) => p.name === "Customer Churn Prediction");
    expect(churn).toBeDefined();
    expect(churn!.bullets.length).toBeGreaterThanOrEqual(1);

    const migration = projects.find((p) => p.name === "Cloud Data Warehouse Migration");
    expect(migration).toBeDefined();
    expect(migration!.bullets.length).toBeGreaterThanOrEqual(1);

    // Ensure total projects count
    expect(projects.length).toBe(3);
  });
});

describe("license parsing regression", () => {
  it("parses separator-based license records without substring corruption", () => {
    const text = `Emily Rodriguez
emily@example.com

Certifications
Registered Nurse (RN) – Texas Board of Nursing
License Number: RN12345678
Basic Life Support (BLS)
Advanced Cardiovascular Life Support (ACLS)
Pediatric Advanced Life Support (PALS)
NIH Stroke Scale Certification`;

    const result = parseResumeText(text);
    const license = result.parsed.licenses?.[0];
    const allText = JSON.stringify(result.parsed);

    expect(license).toBeDefined();
    expect(license?.name).toBe("Registered Nurse (RN)");
    expect(license?.issuingAuthority).toBe("Texas Board of Nursing");
    expect(license?.licenseNumber).toBe("RN12345678");
    expect(result.parsed.certifications).toEqual([
      "Basic Life Support (BLS)",
      "Advanced Cardiovascular Life Support (ACLS)",
      "Pediatric Advanced Life Support (PALS)",
      "NIH Stroke Scale Certification",
    ]);
    expect(allText).not.toContain("License Number: istered");
    expect(allText).not.toContain('"name":"Nurse (RN)"');
    expect(allText).not.toContain('"issuingAuthority":"of Nursing"');
  });

  it("supports pipe-separated and multi-line generic license formats", () => {
    const text = `Test User
test@example.com

Licenses
Professional Engineer | California Board for Professional Engineers | PE12345
CPA
California Board of Accountancy
License No. CPA987654
Licensed Attorney, New York
Bar Number: 1234567`;

    const result = parseResumeText(text);
    const licenses = result.parsed.licenses || [];

    expect(licenses).toEqual([
      expect.objectContaining({
        name: "Professional Engineer",
        issuingAuthority: "California Board for Professional Engineers",
        licenseNumber: "PE12345",
      }),
      expect.objectContaining({
        name: "CPA",
        issuingAuthority: "California Board of Accountancy",
        licenseNumber: "CPA987654",
      }),
      expect.objectContaining({
        name: "Licensed Attorney, New York",
        licenseNumber: "1234567",
      }),
    ]);
  });
});
describe("generic PDF extraction regressions", () => {
  it("parses combined Education & Certifications sections without losing either side", () => {
    const text = `Marc Example
marc@example.com

Education & Certifications
BS in Computer Engineering | Cagayan de Oro College – PHINMA (2015)
______________________________________________________________________
Certified Safety Officer 2
IT Internship
Arduino Programming
Webpage Database & Client-Server Software
Dataworld End User Tech Update`;

    const result = parseResumeText(text);

    expect(result.parsed.education).toHaveLength(1);
    expect(result.parsed.education?.[0]).toEqual(
      expect.objectContaining({
        degree: "BS in Computer Engineering",
        graduation: "2015",
      }),
    );
    expect(result.parsed.education?.[0].school).toContain("Cagayan de Oro College");
    expect(result.parsed.certifications).toEqual([
      "Certified Safety Officer 2",
      "IT Internship",
      "Arduino Programming",
      "Webpage Database & Client-Server Software",
      "Dataworld End User Tech Update",
    ]);
    expect(result.parsed.certifications).not.toContain("______________________________________________________________________");
  });

  it("preserves skill table categories using category-prefixed skill values", () => {
    const text = `Skill User
skill@example.com

Skills
Frontend                    HTML
CSS
JavaScript
React JS
Backend                     Node.js
Express
Cloud / Infra / Tools       Git
Docker
IT/Hardware                 Computer Troubleshooting`;

    const result = parseResumeText(text);

    expect(result.parsed.skills).toContain("Frontend: HTML");
    expect(result.parsed.skills).toContain("Frontend: CSS");
    expect(result.parsed.skills).toContain("Backend: Node.js");
    expect(result.parsed.skills).toContain("Cloud / Infra / Tools: Docker");
    expect(result.parsed.skills).toContain("IT/Hardware: Computer Troubleshooting");
    expect(result.parsed.skills).not.toContain("Frontend HTML");
  });

  it("splits inline PDF bullet runs into separate experience bullets", () => {
    const text = `Bullet User
bullet@example.com

Experience
Developer
Example Company
Feb 2023 - May 2025
● Developed features in Scrum. ● Built and debugged React applications. ● Collaborated with design teams.
continued delivery timelines.`;

    const result = parseResumeText(text);
    const bullets = result.parsed.experience?.[0]?.bullets || [];

    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe("Developed features in Scrum.");
    expect(bullets[1]).toBe("Built and debugged React applications.");
    expect(bullets[2]).toContain("Collaborated with design teams. continued delivery timelines.");
  });

  it("keeps Professional Qualities separate from Achievements", () => {
    const text = `Quality User
quality@example.com

Professional Qualities
• Hardworking and Trustworthy
• Strong team collaborator with a growth mindset`;

    const result = parseResumeText(text);

    expect(result.parsed.professionalQualities).toEqual([
      "Hardworking and Trustworthy",
      "Strong team collaborator with a growth mindset",
    ]);
    expect(result.parsed.achievements).toEqual([]);
  });

  it("extracts portfolio, GitHub, and LinkedIn links from the header", () => {
    const text = `Link User
link@example.com
09924133206
Misamis Oriental, Philippines
Portfolio
https://linkuser.dev
GitHub
https://github.com/linkuser
LinkedIn
https://linkedin.com/in/linkuser

Summary
Technical professional.`;

    const result = parseResumeText(text);

    expect(result.parsed.contact?.website).toBe("https://linkuser.dev");
    expect(result.parsed.contact?.github).toBe("https://github.com/linkuser");
    expect(result.parsed.contact?.linkedin).toBe("https://linkedin.com/in/linkuser");
  });
});