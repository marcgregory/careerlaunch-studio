/**
 * DIAGNOSTIC TEST: Parser Corruption Root-Cause Analysis
 *
 * This is NOT a regression test. It instruments every stage of the parsing
 * pipeline to identify the FIRST point where data gets corrupted.
 *
 * Known corruption patterns to trace:
 *   1. "timelines were met." → orphaned as standalone bullet
 *   2. "network security measures." → disappears after "through"
 *   3. "Custom Queries" → split into "Custom, Queries"
 *   4. Backend skills count: 38 → 24 (14 skills lost)
 *
 * Each test isolates ONE stage at a time and compares input vs output.
 */

import { describe, it, expect } from "vitest";

// We import the internal functions directly to instrument each stage
import { parseResumeText } from "../../src/import/text-parser";

/* ------------------------------------------------------------------ */
/*  Instrumentation helpers                                           */
/* ------------------------------------------------------------------ */

function log(prefix: string, obj: unknown): void {
  console.log(`\n=== ${prefix} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

/* ------------------------------------------------------------------ */
/*  Test input that reproduces all 4 known corruption patterns        */
/* ------------------------------------------------------------------ */

/**
 * This text is designed to trigger the exact bugs the user reported.
 * Pattern A: Continuation text ending with "timelines were met."
 * Pattern B: Wrapped bullet line: "Installed and maintained..." + "network security measures."
 * Pattern C: Skills with parenthesized groups: "Custom Queries" inside parentheses
 * Pattern D: Multi-category skills with enough items to show count dropping
 */
const CORRUPTION_TRIGGER_TEXT = `MARK TURNER
mark.turner@email.com
+63 912 345 6789
Makati, Philippines

Professional Summary
Experienced full-stack developer with 8+ years building web applications and managing IT infrastructure.

Skills
Frontend                    React, TypeScript, Next.js, Vue.js, Angular, HTML5, CSS3, SASS, Tailwind CSS, Bootstrap, Redux, GraphQL
Backend                     Node.js, Express, Python, Go, Java, PHP, C#, Ruby on Rails, NestJS, FastAPI, Django, Flask, Spring Boot, PostgreSQL, MySQL, MongoDB, Redis, Prisma ORM, TypeORM, Drizzle ORM, Sequelize, Knex.js
Cloud / Infra               AWS (EC2, S3, Lambda, RDS, CloudFront, Route53), Docker, Kubernetes, Terraform, CI/CD Pipelines, GitHub Actions
DevOps                      Jenkins, Ansible, Prometheus, Grafana, ELK Stack
Database                    PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Cassandra, SQLite, MariaDB
Testing                     Jest, Mocha, Cypress, Playwright, Vitest, Selenium
Tools                       Git, Webpack, Vite, Babel, ESLint, Prettier, Nginx
Languages                   PHP, JavaScript, TypeScript, Python, Go, Java, Rust, SQL, Bash, PowerShell
PHP WordPress (Theme Dev, ACF, Custom Queries, WP Rest API)

Experience
IT Specialist
DataFlow Systems Inc.
Jan 2018 – Present
- Installed and maintained computer systems and secured company data through
network security measures.
- Managed IT procurement and vendor relationships for 200+ employee company.
- Led a team of 5 junior IT staff members through structured training program
with documented learning paths and weekly check-ins. timelines were met.
- Deployed monitoring solutions reducing incident response time by 60%.
- Maintained 99.9% uptime across all critical systems.

Junior IT Support
TechStart Solutions
Jun 2015 – Dec 2017
- Provided tier 2 support for 100+ end users.
- Configured network equipment and firewall policies.
- Documented IT procedures and created knowledge base articles.

Education
Bachelor of Science in Information Technology
University of the Philippines, 2015

Certifications
CompTIA Network+
AWS Certified Solutions Architect
Cisco CCNA
`;

/* ------------------------------------------------------------------ */
/*  Stage 1: Raw text → Line splitting                                */
/* ------------------------------------------------------------------ */

describe("DIAGNOSTIC: Parser Pipeline Stage Analysis", () => {
  it("STAGE 1: Raw text → Lines → Section detection", () => {
    const text = CORRUPTION_TRIGGER_TEXT;

    // What the parser sees initially
    const rawLines = text.split("\n");
    log("STAGE 1a — Raw lines (indexed)", rawLines.map((l, i) => `${i}: ${JSON.stringify(l)}`));

    // Check how "network security measures." looks after splitting
    const networkLineIdx = rawLines.findIndex(l => l.includes("network security measures"));
    log("STAGE 1b — Line containing 'network security measures'", {
      index: networkLineIdx,
      content: networkLineIdx >= 0 ? rawLines[networkLineIdx] : "NOT FOUND",
      precedingLine: networkLineIdx > 0 ? rawLines[networkLineIdx - 1] : "N/A",
    });

    // Check how "timelines were met." looks after splitting
    const timelinesLineIdx = rawLines.findIndex(l => l.includes("timelines were met"));
    log("STAGE 1c — Line containing 'timelines were met'", {
      index: timelinesLineIdx,
      content: timelinesLineIdx >= 0 ? rawLines[timelinesLineIdx] : "NOT FOUND",
      precedingLine: timelinesLineIdx > 0 ? rawLines[timelinesLineIdx - 1] : "N/A",
    });

    // Check how the PHP WordPress skill line looks
    const phpLineIdx = rawLines.findIndex(l => l.includes("PHP WordPress"));
    log("STAGE 1d — PHP WordPress skill line", {
      index: phpLineIdx,
      content: phpLineIdx >= 0 ? rawLines[phpLineIdx] : "NOT FOUND",
    });

    // Count total skill lines in the skills section
    const skillsStart = rawLines.findIndex(l => l.trim() === "Skills");
    const experienceStart = rawLines.findIndex(l => l.trim() === "Experience");
    const skillLines = rawLines.slice(skillsStart + 1, experienceStart).filter(l => l.trim().length > 0);
    log("STAGE 1e — Raw skill section lines", skillLines);

    // Key assertions that should pass if the input is well-formed
    expect(networkLineIdx).toBeGreaterThanOrEqual(0);
    expect(timelinesLineIdx).toBeGreaterThanOrEqual(0);
    expect(phpLineIdx).toBeGreaterThanOrEqual(0);
  });

  it("STAGE 2: Full parse — check where corruption first appears", () => {
    const text = CORRUPTION_TRIGGER_TEXT;
    const result = parseResumeText(text);

    // === Check 1: "timelines were met." ===
    const exp1 = result.parsed.experience?.[0];
    log("STAGE 2a — First experience entry bullets", exp1?.bullets);

    const hasTimelinesOrphan = exp1?.bullets?.some(
      b => b.trim() === "timelines were met."
    );
    const hasTimelinesMerged = exp1?.bullets?.some(
      b => b.includes("timelines were met.") && b.includes("through structured training")
    );

    log("STAGE 2b — 'timelines were met.' diagnosis", {
      foundAsOrphanBullet: hasTimelinesOrphan,
      foundMergedIntoPrecedingBullet: hasTimelinesMerged,
      bullets: exp1?.bullets ?? [],
    });

    // Check if "timelines were met." appears as a standalone line in any section
    // If it's orphaned, it could be in experience, achievements, or elsewhere
    const allParsedText = JSON.stringify(result.parsed);
    const appearsSomewhere = allParsedText.includes("timelines were met.");
    log("STAGE 2c — 'timelines were met.' persists in output", appearsSomewhere);
    expect(appearsSomewhere).toBe(true); // It MUST be somewhere in the output

    // === Check 2: "network security measures." ===
    log("STAGE 2d — Checking 'network security measures.' presence");

    // Look in each experience entry
    const measuresFound: Array<{ entry: number; bullet: number; text: string }> = [];
    result.parsed.experience?.forEach((exp, ei) => {
      exp.bullets.forEach((b, bi) => {
        if (b.includes("network security") || b.includes("secured company data")) {
          measuresFound.push({ entry: ei, bullet: bi, text: b });
        }
      });
    });

    log("STAGE 2e — Bullets containing 'network security' or 'secured company data'", measuresFound);

    const measuresComplete = measuresFound.some(
      m => m.text.includes("network security measures")
    );
    expect(measuresComplete).toBe(true);

    // === Check 3: Skills count and "Custom Queries" ===
    log("STAGE 2f — All parsed skills", result.parsed.skills);

    // Check if "Custom Queries" appears correctly
    const customQueriesIntact = result.parsed.skills?.some(
      s => s.includes("Custom Queries")
    );
    const customSplit = result.parsed.skills?.some(
      s => s === "Custom" || s === "Queries"
    );

    log("STAGE 2g — 'Custom Queries' diagnosis", {
      customQueriesIntact,
      customSplit,
      phpSkills: result.parsed.skills?.filter(s => s.toLowerCase().includes("php") || s.toLowerCase().includes("wordpress")),
    });

    // === Check 4: Backend skills count ===
    const backendSkills = result.parsed.skills?.filter(
      s => s.startsWith("Backend:") || s.toLowerCase().includes("backend")
    );
    const backendItems = result.parsed.skills?.filter(s => s.startsWith("Backend:"));
    log("STAGE 2h — Backend skills", {
      totalCount: backendSkills?.length ?? 0,
      backendPrefixCount: backendItems?.length ?? 0,
      items: backendItems,
    });

    // Count ALL skills
    const allSkills = result.parsed.skills ?? [];
    log("STAGE 2i — Total skills breakdown", {
      total: allSkills.length,
      categorized: allSkills.filter(s => s.includes(":")).length,
      uncategorized: allSkills.filter(s => !s.includes(":")).length,
    });
  });

  it("STAGE 3: Simulate PDF extraction artifacts with orphan continuation", () => {
    // This simulates PDF extractors that split lines mid-sentence
    // Common PDF extraction bug: "through\nnetwork security measures."
    // Result: "network security measures." lands on its own line

    const textWithPdfArtifacts = `MARK TURNER
mark.turner@email.com

Experience
IT Specialist
DataFlow Systems Inc.
Jan 2018 – Present
- Installed and maintained computer systems and secured company data through
network security measures.
- Managed IT procurement.
- Led a team through structured training program
with documented learning paths and weekly check-ins.
timelines were met.

Education
Bachelor of Science in Information Technology
University, 2015
`;

    const result = parseResumeText(textWithPdfArtifacts);
    const exp = result.parsed.experience?.[0];

    log("STAGE 3a — PDF extraction artifacts: experience", exp);

    // Check the critical bullets
    const bullets = exp?.bullets ?? [];
    log("STAGE 3b — Bullets with PDF artifacts", bullets);

    // "network security measures" should be merged
    const hasNetworkSecurity = bullets.some(b => b.includes("network security measures"));
    // "timelines were met." should be merged
    const hasTimelinesMerged = bullets.some(b => b.includes("timelines were met."));

    log("STAGE 3c — PDF artifact corruption check", {
      hasNetworkSecurityMerged: hasNetworkSecurity,
      hasTimelinesMerged: hasTimelinesMerged,
      orphanBullets: bullets.filter(b =>
        b === "network security measures." ||
        b === "timelines were met." ||
        b === "timelines were met"
      ),
    });
  });

  it("STAGE 4: Skill tokenization analysis", () => {
    // Test the splitSkillItems behavior on parenthesized content
    const text = `Name
email@test.com

Skills
PHP WordPress (Theme Dev, ACF, Custom Queries, WP Rest API)
React, TypeScript, Node.js
Backend                     PHP, Python, Java, Go, Rust

Education
Test University, 2020
`;

    const result = parseResumeText(text);
    const skills = result.parsed.skills ?? [];

    log("STAGE 4a — Skills from parenthesized input", skills);

    // Check if "Custom Queries" is preserved or split
    const customQueriesItems = skills.filter(s =>
      s.includes("Custom") || s.includes("Queries")
    );
    log("STAGE 4b — 'Custom Queries' tokenization", {
      items: customQueriesItems,
      customQueriesIntact: skills.some(s => s.includes("Custom Queries")),
      customAsSeparate: skills.some(s => s.trim() === "Custom"),
      queriesAsSeparate: skills.some(s => s.trim() === "Queries"),
    });

    // Now test with the actual splitSkillItems-like logic
    // Simulate: the line could arrive as "PHP WordPress (Theme Dev, ACF, Custom, Queries, WP Rest API)"
    // if PDF extraction inserts commas at line breaks
    const textWithExtraComma = `Name
email@test.com

Skills
PHP WordPress (Theme Dev, ACF, Custom, Queries, WP Rest API)
React, TypeScript

Education
Test University, 2020
`;

    const result2 = parseResumeText(textWithExtraComma);
    const skills2 = result2.parsed.skills ?? [];

    log("STAGE 4c — Skills with extra comma (PDF artifact simulation)", skills2);
    log("STAGE 4d — 'Custom Queries' with extra comma", {
      hasCustomSeparate: skills2.some(s => s.trim() === "Custom"),
      hasQueriesSeparate: skills2.some(s => s.trim() === "Queries" || s.trim() === "Queries,"),
    });
  });

  it("STAGE 5: Skills deduplication analysis", () => {
    // Test what happens with skills that have repeated items across categories
    const text = `Name
email@test.com

Skills
Frontend                     React, TypeScript, JavaScript, HTML, CSS
Backend                      Node.js, TypeScript, Python, JavaScript, PostgreSQL, Go, Java, C#, Rust, PHP, Ruby, Swift, Kotlin, Scala, Dart
Cloud / Infra                AWS, Docker, TypeScript
Languages                    JavaScript, TypeScript, Python, Go, Java, Rust, PHP, Bash, SQL

Education
Test University, 2020
`;

    const result = parseResumeText(text);
    const skills = result.parsed.skills ?? [];

    log("STAGE 5a — Skills with cross-category dedup", skills);

    // Count skills that are categorized under Backend
    const backendSkills = skills.filter(s => s.startsWith("Backend:"));
    // Count all unique skills (just the items, no categories)
    const allItems = skills.map(s => {
      const colonIdx = s.indexOf(":");
      return colonIdx >= 0 ? s.slice(colonIdx + 1).trim() : s;
    });
    const uniqueItems = new Set(allItems.map(s => s.toLowerCase().trim()));

    log("STAGE 5b — Backend skills detail", {
      count: backendSkills.length,
      items: backendSkills,
      uniqueSkillCount: uniqueItems.size,
      duplicatesRemoved: allItems.length - uniqueItems.size,
    });

    // Now check if skills like TypeScript (Frontend) conflicts with TypeScript (Backend)
    const typeScriptCount = skills.filter(s => s.toLowerCase().includes("typescript")).length;
    log("STAGE 5c — TypeScript across categories", {
      instances: typeScriptCount,
      items: skills.filter(s => s.toLowerCase().includes("typescript")),
    });
  });

  it("STAGE 6: Full pipeline — comprehensive output validation", () => {
    const result = parseResumeText(CORRUPTION_TRIGGER_TEXT);
    const parsed = result.parsed;

    log("STAGE 6a — Full ParseResult metadata", {
      importQuality: result.importQuality,
      confidence: result.confidence,
      warnings: result.warnings,
      coverage: result.coverage.map(c => ({
        id: c.sectionId,
        ratio: c.ratio,
        status: c.status,
        original: c.originalWordCount,
        parsed: c.parsedWordCount,
      })),
      layouts: result.layouts,
      unparsedContent: Object.keys(result.unparsedContent),
    });

    log("STAGE 6b — Full parsed resume", parsed);

    // Validate no word-level corruption
    // The input contains specific words that must be preserved
    const expectedContent = [
      "network security measures",
      "secured company data",
      "timelines were met",
      "Custom Queries",
      "WP Rest API",
      "PHP WordPress",
    ];
    const fullOutput = JSON.stringify(parsed);

    for (const fragment of expectedContent) {
      const found = fullOutput.includes(fragment);
      log(`STAGE 6c — "${fragment}" preserved in output`, { preserved: found });
      expect(found).toBe(true);
    }

    // Count total skills — the input has substantial backend skills
    const skills = parsed.skills ?? [];
    log("STAGE 6d — Skill count summary", {
      total: skills.length,
      categories: [...new Set(skills.filter(s => s.includes(":")).map(s => s.split(":")[0]))],
    });
  });
});
