/**
 * Regression Test Suite — v0.9.5-alpha
 *
 * Tests 7 known-problematic formats from previous releases.
 * Each test: register user → import resume → verify parsing → create draft → export PDF.
 *
 * Usage: npx tsx scripts/eval/dogfooding/regression-suite.ts
 */

const BASE_URL = process.env.DOGFOOD_BASE_URL || "http://localhost:3000";

const REGRESSION_TESTS = [
  {
    id: "R1",
    name: "3-Line Experience Format",
    resume: `Jordan Lee
jordan@example.com | 555-0101 | San Francisco

Professional Summary
Software developer with experience building web applications.

Skills
JavaScript, Python, React

Jun 2021 - Present | Senior Developer | Acme Corp
Jan 2019 - May 2021 | Developer | Beta Inc
Mar 2017 - Dec 2018 | Junior Developer | Gamma LLC`,
    expectedChecks: { experienceMin: 3 },
  },
  {
    id: "R2",
    name: "Bullet Certifications",
    resume: `Jordan Lee
jordan@example.com | 555-0101 | San Francisco

Professional Summary
Software developer with certifications in cloud and security.

Skills
JavaScript, AWS, Security

Education
Bachelor of Science in Computer Science — State University

• AWS Certified Solutions Architect
• CompTIA Security+`,
    expectedChecks: { experienceMin: 0, certificationsMin: 2 },
  },
  {
    id: "R3",
    name: "Skills Before Experience",
    resume: `Jordan Lee
jordan@example.com | 555-0101 | San Francisco

Professional Summary
Full-stack developer with 5 years of experience.

Skills
React, TypeScript, Node.js, PostgreSQL

Experience
Senior Developer — Acme Corp
Jan 2021 - Present
  • Built React-based dashboard serving 10K users
  • Designed RESTful APIs using Node.js and Express`,
    expectedChecks: { experienceMin: 1 },
  },
  {
    id: "R4",
    name: "References-Heavy Resume",
    resume: `Jordan Lee
jordan@example.com | 555-0101 | San Francisco

Professional Summary
Developer seeking new opportunities.

Education
Bachelor of Science — State University

References:
John Smith — Senior Developer, Acme Corp — john@acme.com
Jane Doe — Engineering Manager, Beta Inc — jane@beta.com
Available upon request.`,
    expectedChecks: { experienceMin: 0 },
  },
  {
    id: "R5",
    name: "LinkedIn Export Format",
    resume: `Jordan Lee
San Francisco Bay Area
jordan@example.com

React, TypeScript, Node.js — Frontend Developer
Spearheaded migration of legacy codebase to React 18
Reduced bundle size by 40% through code splitting

Skills: React, TypeScript, Node.js, GraphQL, PostgreSQL
Languages: English (Native), Spanish (Professional)

Experience
Frontend Developer — TechStart Inc
2021 - Present
  • Built customer-facing dashboard components`,
    expectedChecks: { experienceMin: 1 },
  },
  {
    id: "R6",
    name: "Minimal Resume",
    resume: `Jane Smith
jane@email.com

Professional Summary
Developer.

Experience
Developer at Some Company

Education
Some University`,
    expectedChecks: { experienceMin: 1 },
  },
  {
    id: "R7",
    name: "Resume with Tables",
    resume: `Jordan Lee
jordan@example.com | 555-0101 | San Francisco

Professional Summary
Full-stack developer with experience across the stack.

Technical Skills

Category,Skills
Frontend,React,TypeScript,Tailwind CSS
Backend,Node.js,Python,PostgreSQL
DevOps,Docker,AWS,CI/CD

Soft Skills

Communication,Team leadership,Client presentations
Management,Agile/Scrum,Project planning

Experience
Developer — Acme Corp
Jan 2021 - Present
  • Built full-stack applications`,
    expectedChecks: { experienceMin: 1, skillsMin: 5 },
  },
];

interface TestResult {
  id: string;
  name: string;
  steps: Record<string, { pass: boolean; detail?: string; durationMs?: number }>;
  issues: string[];
  pass: boolean;
}

type ApiResponse = { ok: boolean; status: number; json: Record<string, unknown>; text: string; durationMs: number };

async function apiGet(path: string, session: string): Promise<ApiResponse> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: session }, redirect: "manual" });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.status >= 200 && res.status < 400, status: res.status, json, text, durationMs: Date.now() - start };
}

async function apiPost(path: string, body: unknown, session: string): Promise<ApiResponse> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: session }, body: JSON.stringify(body), redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.status >= 200 && res.status < 400, status: res.status, json, text, durationMs: Date.now() - start };
}

async function registerUser(email: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    body: new URLSearchParams({ email, name: "Regression Tester", password: "testpassword123" }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/careerlaunch_session=([^;]+)/);
  return match ? `careerlaunch_session=${match[1]}` : null;
}

async function main() {
  const results: TestResult[] = [];

  for (const test of REGRESSION_TESTS) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  ${test.id}: ${test.name}`);
    console.log(`${"─".repeat(50)}`);

    const result: TestResult = {
      id: test.id,
      name: test.name,
      steps: {},
      issues: [],
      pass: true,
    };

    const slug = test.id.toLowerCase().replace(/\s+/g, "-");
    const email = `regression-${slug}@example.com`;

    // Register
    const session = await registerUser(email);
    if (!session) {
      console.log(`  ❌ FAILED: Registration`);
      result.pass = false;
      result.steps["Register"] = { pass: false, detail: "Could not register" };
      results.push(result);
      continue;
    }
    result.steps["Register"] = { pass: true };

    // Import
    console.log(`  Importing...`);
    const impRes = await apiPost("/api/import/text", { text: test.resume }, session);
    const quality = impRes.json?.importQuality as string ?? "unknown";
    const parsed = impRes.json?.parsed as Record<string, unknown> ?? {};
    const expCount = (parsed.experience as Array<unknown>)?.length ?? 0;
    const skillsCount = (parsed.skills as Array<unknown>)?.length ?? 0;
    const certCount = (parsed.certifications as Array<unknown>)?.length ?? 0;

    const importPass = impRes.ok && quality !== "failed";
    result.steps["Import"] = {
      pass: importPass,
      detail: `Quality: ${quality}, Experience: ${expCount}, Skills: ${skillsCount}, Certs: ${certCount}`,
      durationMs: impRes.durationMs,
    };
    console.log(`  ${importPass ? "✅" : "❌"} Import: quality=${quality}, exp=${expCount}, skills=${skillsCount}, certs=${certCount}`);

    if (!importPass) {
      result.issues.push(`Import failed: ${impRes.text.slice(0, 100)}`);
      result.pass = false;
      results.push(result);
      continue;
    }

    // Verify expected checks
    if (test.expectedChecks.experienceMin !== undefined && expCount < test.expectedChecks.experienceMin) {
      result.issues.push(`Expected >=${test.expectedChecks.experienceMin} experiences, got ${expCount}`);
    }
    if (test.expectedChecks.skillsMin !== undefined && skillsCount < test.expectedChecks.skillsMin) {
      result.issues.push(`Expected >=${test.expectedChecks.skillsMin} skills, got ${skillsCount}`);
    }
    if (test.expectedChecks.certificationsMin !== undefined && certCount < test.expectedChecks.certificationsMin) {
      result.issues.push(`Expected >=${test.expectedChecks.certificationsMin} certifications, got ${certCount}`);
    }

    // Create draft
    const resumeDoc = {
      title: `Regression ${test.id}`,
      summary: (parsed.summary as string) ?? "",
      contact: { fullName: "Regression Tester", email, phone: "555-0000", location: "Remote", website: "" },
      experience: (parsed.experience as Array<Record<string, unknown>>) ?? [],
      skills: (parsed.skills as Array<unknown>)?.map((s: string | { name: string }) => typeof s === "string" ? s : s.name) ?? [],
      templateId: "modern",
    };
    const createRes = await apiPost("/api/resumes", resumeDoc, session);
    const resumeId = (createRes.json as { resume?: { id?: string } })?.resume?.id;
    result.steps["Create Draft"] = {
      pass: !!resumeId,
      detail: resumeId ? `Resume: ${resumeId}` : `HTTP ${createRes.status}: ${createRes.text.slice(0, 100)}`,
    };
    console.log(`  ${resumeId ? "✅" : "❌"} Create draft`);

    if (!resumeId) {
      result.issues.push(`Resume creation failed: ${createRes.text.slice(0, 100)}`);
      result.pass = false;
      results.push(result);
      continue;
    }

    // Analyze
    const analyzeRes = await apiGet(`/api/resumes/${resumeId}/analyze`, session);
    result.steps["Analyze"] = {
      pass: analyzeRes.ok,
      detail: `HTTP ${analyzeRes.status} (${analyzeRes.durationMs}ms)`,
      durationMs: analyzeRes.durationMs,
    };
    console.log(`  ${analyzeRes.ok ? "✅" : "❌"} Analyze: HTTP ${analyzeRes.status} (${analyzeRes.durationMs}ms)`);

    if (!analyzeRes.ok) {
      result.issues.push(`Analysis failed: HTTP ${analyzeRes.status}`);
      result.pass = false;
    }

    // Export PDF
    const pdfRes = await apiPost("/api/export/pdf", { resumeId, template: "modern" }, session);
    result.steps["Export PDF"] = {
      pass: pdfRes.ok,
      detail: `HTTP ${pdfRes.status} (${pdfRes.durationMs}ms)`,
      durationMs: pdfRes.durationMs,
    };
    console.log(`  ${pdfRes.ok ? "✅" : "❌"} PDF export: HTTP ${pdfRes.status} (${pdfRes.durationMs}ms)`);

    if (!pdfRes.ok) {
      result.issues.push(`PDF export failed: HTTP ${pdfRes.status}`);
    }

    // Final verdict
    result.pass = result.issues.length === 0;
    results.push(result);
    console.log(`  → ${result.pass ? "✅ PASS" : "⚠️  ISSUES: " + result.issues.join("; ")}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(50)}`);
  console.log(`  REGRESSION TEST RESULTS`);
  console.log(`${"═".repeat(50)}\n`);

  const passed = results.filter((r) => r.pass).length;
  for (const r of results) {
    const stepsPass = Object.values(r.steps).filter((s) => s.pass).length;
    const stepsTotal = Object.values(r.steps).length;
    console.log(`  ${r.id}: ${r.pass ? "✅ PASS" : "❌ FAIL"} (${stepsPass}/${stepsTotal} steps)`);
    for (const issue of r.issues) {
      console.log(`       ⚠️  ${issue}`);
    }
  }

  console.log(`\n  Passed: ${passed}/${results.length}`);
  console.log(`  ${passed === results.length ? "✅ ALL PASS" : "❌ SOME FAILED"}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
