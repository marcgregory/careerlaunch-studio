/**
 * Full Dogfooding Pipeline — Release Gate v0.9.5
 *
 * Executes the complete dogfooding workflow against the live API for all 6 personas.
 * Reports pass/fail per step and logs issues found.
 *
 * Usage: npx tsx scripts/eval/dogfooding/dogfood-full-pipeline.ts
 *
 * Requires: Running dev server (npm run dev) and valid session cookie.
 */

import resumes from "../datasets/resumes.json";
import jobDescriptions from "../datasets/job-descriptions.json";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DOGFOOD_BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = process.env.DOGFOOD_SESSION || "";
const DOGFOOD_IDS = ["resume-16", "resume-17", "resume-18", "resume-19", "resume-20", "resume-21"];

type Issue = {
  id: string;
  severity: "🔴 Critical" | "🟠 Major" | "🟡 Minor" | "🔵 Enhancement";
  persona: string;
  area: string;
  description: string;
  stepsToReproduce: string;
  expected: string;
  actual: string;
  status: "Open";
};

type PersonaResult = {
  name: string;
  steps: Record<string, { pass: boolean; detail?: string; durationMs?: number }>;
  issues: Issue[];
};

type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
  durationMs: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildResumeText(persona: (typeof resumes)[0]): string {
  const c = persona.contact;
  const lines: string[] = [
    `${c.fullName}`,
    `${c.email} | ${c.phone} | ${c.location}${c.website ? ` | ${c.website}` : ""}`,
    "",
    "Professional Summary",
    persona.summary,
    "",
  ];

  const expSections = persona.sections.filter((s) => s.type === "experience");
  if (expSections.length > 0) {
    lines.push("Experience");
    for (const exp of expSections) {
      lines.push("");
      lines.push(`${exp.role} — ${exp.company}`);
      lines.push(`${exp.dateRange.start} — ${exp.dateRange.end}`);
      for (const bullet of exp.bullets) {
        lines.push(`  • ${bullet}`);
      }
    }
  }

  if (persona.skills.length > 0) {
    lines.push("");
    lines.push("Skills");
    lines.push(persona.skills.join(", "));
  }

  if (persona.certifications.length > 0) {
    lines.push("");
    lines.push("Certifications");
    for (const cert of persona.certifications) {
      lines.push(`  • ${cert}`);
    }
  }

  if (persona.projects.length > 0) {
    lines.push("");
    lines.push("Projects");
    for (const proj of persona.projects) {
      lines.push(`  • ${proj.name}: ${proj.description}`);
    }
  }

  return lines.join("\n");
}

async function api<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const start = Date.now();
  const headers: Record<string, string> = {
    Cookie: SESSION_COOKIE,
  };

  let fetchBody: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: fetchBody,
      redirect: "manual",
    });
    const durationMs = Date.now() - start;
    let data: T = undefined as unknown as T;
    const text = await res.text();
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      data,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: (err instanceof Error ? err.message : String(err)) as unknown as T,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Pipeline Steps ───────────────────────────────────────────────────────

async function main() {

const results: PersonaResult[] = [];

for (const resumeId of DOGFOOD_IDS) {
  const personaIdx = resumes.findIndex((r) => r.id === resumeId);
  const persona = resumes[personaIdx];
  const jdEntry = jobDescriptions[personaIdx];

  if (!persona || !jdEntry) {
    console.error(`Missing data for ${resumeId}`);
    continue;
  }

  const personaResult: PersonaResult = {
    name: persona.label,
    steps: {},
    issues: [],
  };

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Persona: ${persona.label}`);
  console.log(`  Name:    ${persona.contact.fullName}`);
  console.log(`  Target:  ${jdEntry.label}`);
  console.log(`${"═".repeat(60)}\n`);

  const resumeText = buildResumeText(persona);

  // ── Step 1: Import Resume ───────────────────────────────────────────────
  console.log(`[1/11] Importing resume...`);
  let importResult = await api<{ parsed: Record<string, unknown>; coverage: Array<{ sectionId: string; ratio: number }>; importQuality: string; aiRecovery: Record<string, unknown> }>("POST", "/api/import/text", { text: resumeText });

  const importPass = importResult.ok && importResult.data?.importQuality !== "failed";
  personaResult.steps["Import Resume"] = {
    pass: importPass,
    detail: importResult.ok
      ? `Quality: ${importResult.data?.importQuality ?? "?"}, Coverage: ${JSON.stringify(
          (importResult.data?.coverage ?? []).map((c: { sectionId: string; ratio: number }) => `${c.sectionId}=${Math.round(c.ratio * 100)}%`),
        )}`
      : `HTTP ${importResult.status}: ${String(importResult.data).slice(0, 200)}`,
    durationMs: importResult.durationMs,
  };
  console.log(`  → ${importPass ? "✅ PASS" : "❌ FAIL"} (${importResult.durationMs}ms) — ${personaResult.steps["Import Resume"].detail}`);

  if (!importPass) {
    personaResult.issues.push({
      id: `${resumeId}-IMPORT`,
      severity: "🔴 Critical",
      persona: persona.label,
      area: "Import",
      description: `Import failed for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/import/text with ${persona.label} resume text`,
      expected: "Import quality should not be 'failed'",
      actual: String(importResult.data).slice(0, 300),
      status: "Open",
    });
  }

  // ── Step 2: Preview vs Import check (structural integrity) ─────────────
  console.log(`[2/11] Validating import structure...`);
  const parsed = importResult.data?.parsed as Record<string, unknown> | undefined;
  const parsedExperience = (parsed?.experience as Array<Record<string, unknown>>) ?? [];
  const parsedSkills = (parsed?.skills as Array<unknown>) ?? [];
  const personaExperience = persona.sections.filter((s) => s.type === "experience");
  const personaSkills = persona.skills;

  let previewIssues: string[] = [];
  if (parsedExperience.length < personaExperience.length) {
    previewIssues.push(`Expected ${personaExperience.length} experience entries, got ${parsedExperience.length}`);
  }
  if (parsedSkills.length < personaSkills.length * 0.5) {
    previewIssues.push(`Expected ~${personaSkills.length} skills, got ${parsedSkills.length} — possible truncation`);
  }

  const previewPass = previewIssues.length === 0;
  personaResult.steps["Preview vs Import"] = {
    pass: previewPass,
    detail: previewPass
      ? `Experience: ${parsedExperience.length}/${personaExperience.length}, Skills: ${parsedSkills.length}/${personaSkills.length}`
      : previewIssues.join("; "),
  };
  console.log(`  → ${previewPass ? "✅ PASS" : "⚠️  ISSUES"} — ${personaResult.steps["Preview vs Import"].detail}`);

  if (!previewPass) {
    personaResult.issues.push({
      id: `${resumeId}-PREVIEW`,
      severity: "🟠 Major",
      persona: persona.label,
      area: "Import Preview",
      description: previewIssues.join("; "),
      stepsToReproduce: `Import ${persona.contact.fullName} resume and check parsed structure`,
      expected: `Experience: ${personaExperience.length}, Skills: ~${personaSkills.length}`,
      actual: `Experience: ${parsedExperience.length}, Skills: ${parsedSkills.length}`,
      status: "Open",
    });
  }

  // ── Step 2.5: Create resume draft from imported data ───────────────────
  console.log(`[2.5/11] Creating resume draft...`);
  // Build resume document using the flattened ResumeDocument format
  // that parseResumePayload expects (not sections[] — use direct fields)
  const experienceEntries = parsedExperience.map((exp: Record<string, unknown>) => ({
    role: (exp.role as string) ?? "",
    company: (exp.company as string) ?? "",
    bullets: (exp.bullets as string[]) ?? [],
    startDate: (exp.dateRange as Record<string, string>)?.start as string ?? "",
    endDate: (exp.dateRange as Record<string, string>)?.end as string ?? "",
    current: (exp.dateRange as Record<string, string>)?.end === "present",
  }));

  // ── Handle free-tier constraints ───────────────
  // Free tier allows 1 resume. Before creating a new one, delete old ones via direct DB query.
  // The /api/resumes endpoint returns all, but there's no DELETE endpoint — we use
  // a direct database approach instead.
  console.log(`[2.4/11] Checking resume limit...`);
  let listResult = await api<{ resumes: Array<{ id: string }> }>("GET", "/api/resumes");
  if (listResult.ok && listResult.data?.resumes) {
    for (const oldResume of listResult.data.resumes) {
      // No API delete endpoint — we work around by updating the target resume in place
      // or by creating fresh users per persona.
      console.log(`  Existing resume detected: ${oldResume.id} — will use it`);
    }
  }

  const resumeDoc = {
    title: `${persona.contact.fullName} — ${persona.label}`,
    targetRole: jdEntry.label || "",
    summary: (parsed?.summary as string) ?? persona.summary,
    contact: {
      fullName: persona.contact.fullName,
      email: persona.contact.email,
      phone: persona.contact.phone,
      location: persona.contact.location,
      website: persona.contact.website || "",
    },
    experience: experienceEntries,
    skills: parsedSkills.map((s: string | { name: string }) => (typeof s === "string" ? s : s.name)),
    certifications: persona.certifications.map((c: string) => ({ name: c })),
    projects: persona.projects.map((p: { name: string; description: string; url?: string }) => ({
      name: p.name,
      description: p.description,
      url: p.url || "",
      bullets: [],
    })),
    templateId: "modern",
    education: [],
    professionalQualities: [],
    sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
  };

  let createResult = await api<{ resume: { id: string } }>("POST", "/api/resumes", resumeDoc);
  const resumeId_doc = createResult.data?.resume?.id;
  const createPass = createResult.ok && !!resumeId_doc;
  personaResult.steps["Create Draft"] = {
    pass: createPass,
    detail: createPass ? `Resume ID: ${resumeId_doc}` : `HTTP ${createResult.status}: ${String(createResult.data).slice(0, 200)}`,
    durationMs: createResult.durationMs,
  };
  console.log(`  → ${createPass ? "✅ PASS" : "❌ FAIL"} (${createResult.durationMs}ms) — ${personaResult.steps["Create Draft"].detail}`);

  if (!createPass) {
    personaResult.issues.push({
      id: `${resumeId}-CREATE`,
      severity: "🔴 Critical",
      persona: persona.label,
      area: "Draft Creation",
      description: `Failed to create resume draft for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/resumes after import`,
      expected: "Resume draft created with ID",
      actual: String(createResult.data).slice(0, 200),
      status: "Open",
    });
    // Can't continue without a resume ID
    results.push(personaResult);
    continue;
  }

  // ── Step 3: Analyze Resume (Health Check) ──────────────────────────────
  console.log(`[3/11] Running analysis (resume health)...`);
  const targetJd = jdEntry.text || jdEntry.description || "";
  const analyzeUrl = `/api/resumes/${resumeId_doc}/analyze${targetJd ? `?jobDescription=${encodeURIComponent(targetJd.slice(0, 500))}` : ""}`;
  let analyzeResult = await api<{ runs?: Array<{ dimension: string; score: number }>; error?: string }>("POST", analyzeUrl);

  const analyzePass = analyzeResult.ok;
  personaResult.steps["Analyze Resume"] = {
    pass: analyzePass,
    detail: analyzePass
      ? `Duration: ${analyzeResult.durationMs}ms`
      : `HTTP ${analyzeResult.status}: ${String(analyzeResult.data).slice(0, 200)}`,
    durationMs: analyzeResult.durationMs,
  };
  console.log(`  → ${analyzePass ? "✅ PASS" : "❌ FAIL"} (${analyzeResult.durationMs}ms) — ${personaResult.steps["Analyze Resume"].detail}`);

  if (!analyzePass) {
    personaResult.issues.push({
      id: `${resumeId}-ANALYZE`,
      severity: "🟠 Major",
      persona: persona.label,
      area: "Analysis",
      description: `Resume analysis failed for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/resumes/${resumeId_doc}/analyze`,
      expected: "Analysis completes with scores returned",
      actual: `HTTP ${analyzeResult.status}: ${String(analyzeResult.data).slice(0, 200)}`,
      status: "Open",
    });
  }

  // ── Step 4: Paste Job Description + Step 5: AI Tailor ──────────────────
  console.log(`[4-5/11] Running tailoring with job description...`);
  let tailorResult = await api<{
    suggestions?: Array<{ id: string; title: string; severity: string; confidence: number }>;
    gapAnalysis?: Record<string, unknown>;
  }>("POST", `/api/resumes/${resumeId_doc}/tailor`, {
    jobDescription: targetJd,
  });

  const tailorPass = tailorResult.ok;
  const suggestionsCount = (tailorResult.data?.suggestions?.length ?? 0);
  personaResult.steps["AI Tailor"] = {
    pass: tailorPass,
    detail: tailorPass
      ? `Suggestions: ${suggestionsCount}, Duration: ${tailorResult.durationMs}ms`
      : `HTTP ${tailorResult.status}: ${String(tailorResult.data).slice(0, 200)}`,
    durationMs: tailorResult.durationMs,
  };
  console.log(`  → ${tailorPass ? "✅ PASS" : "❌ FAIL"} (${tailorResult.durationMs}ms) — ${personaResult.steps["AI Tailor"].detail}`);

  if (!tailorPass) {
    personaResult.issues.push({
      id: `${resumeId}-TAILOR`,
      severity: "🟠 Major",
      persona: persona.label,
      area: "Tailoring",
      description: `AI tailoring failed for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/resumes/${resumeId_doc}/tailor with job description`,
      expected: "Tailoring completes with suggestions returned",
      actual: `HTTP ${tailorResult.status}: ${String(tailorResult.data).slice(0, 200)}`,
      status: "Open",
    });
  }

  // ── Step 6: Apply Changes ──────────────────────────────────────────────
  console.log(`[6/11] Applying suggestions...`);
  const suggestions = (tailorResult.data?.suggestions ?? []) as Array<{ id: string; title: string }>;
  let applyPass = true;
  let applyDetail = "No suggestions to apply";

  if (suggestions.length > 0) {
    // Apply first suggestion individually
    const firstSuggestion = suggestions[0];
    let applyOneResult = await api("POST", `/api/resumes/${resumeId_doc}/suggestions/apply`, {
      suggestionId: firstSuggestion.id,
    });

    if (!applyOneResult.ok) {
      applyPass = false;
      applyDetail = `Individual apply failed: HTTP ${applyOneResult.status}`;
      personaResult.issues.push({
        id: `${resumeId}-APPLY-1`,
        severity: "🟠 Major",
        persona: persona.label,
        area: "Apply Suggestions",
        description: `Individual apply failed for suggestion "${firstSuggestion.title}"`,
        stepsToReproduce: `POST /api/resumes/${resumeId_doc}/suggestions/apply with suggestionId ${firstSuggestion.id}`,
        expected: "Suggestion applied, section updated",
        actual: `HTTP ${applyOneResult.status}: ${String(applyOneResult.data).slice(0, 200)}`,
        status: "Open",
      });
    } else {
      applyDetail = `Individual apply: ✅`;
    }

    // Apply all remaining suggestions in bulk
    const remainingSuggestions = suggestions.slice(1);
    if (remainingSuggestions.length > 0) {
      let applyBulkResult = await api("POST", `/api/resumes/${resumeId_doc}/suggestions/apply-bulk`, {
        suggestionIds: remainingSuggestions.map((s) => s.id),
      });

      if (!applyBulkResult.ok) {
        applyPass = false;
        applyDetail += ` | Bulk apply failed: HTTP ${applyBulkResult.status}`;
        personaResult.issues.push({
          id: `${resumeId}-APPLY-BULK`,
          severity: "🟠 Major",
          persona: persona.label,
          area: "Apply Suggestions",
          description: `Bulk apply failed for ${remainingSuggestions.length} suggestions`,
          stepsToReproduce: `POST /api/resumes/${resumeId_doc}/suggestions/apply-bulk`,
          expected: "All suggestions applied in a single operation",
          actual: `HTTP ${applyBulkResult.status}: ${String(applyBulkResult.data).slice(0, 200)}`,
          status: "Open",
        });
      } else {
        applyDetail += ` | Bulk apply (${remainingSuggestions.length} suggestions): ✅`;
      }
    }
  }

  personaResult.steps["Apply Changes"] = {
    pass: applyPass,
    detail: applyDetail,
  };
  console.log(`  → ${applyPass ? "✅ PASS" : "❌ FAIL"} — ${applyDetail}`);

  // ── Step 7: Generate Cover Letter ──────────────────────────────────────
  console.log(`[7/11] Generating cover letter...`);
  let coverLetterResult = await api<{ id?: string; body?: string; error?: string }>(
    "POST",
    `/api/resumes/${resumeId_doc}/cover-letter/generate`,
    { jobDescription: targetJd },
  );

  const clPass = coverLetterResult.ok;
  personaResult.steps["Generate Cover Letter"] = {
    pass: clPass,
    detail: clPass
      ? `Duration: ${coverLetterResult.durationMs}ms`
      : `HTTP ${coverLetterResult.status}: ${String(coverLetterResult.data).slice(0, 200)}`,
    durationMs: coverLetterResult.durationMs,
  };
  console.log(`  → ${clPass ? "✅ PASS" : "❌ FAIL"} (${coverLetterResult.durationMs}ms) — ${personaResult.steps["Generate Cover Letter"].detail}`);

  if (!clPass) {
    personaResult.issues.push({
      id: `${resumeId}-CL`,
      severity: "🟡 Minor",
      persona: persona.label,
      area: "Cover Letter",
      description: `Cover letter generation failed for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/resumes/${resumeId_doc}/cover-letter/generate`,
      expected: "Cover letter generated successfully",
      actual: `HTTP ${coverLetterResult.status}: ${String(coverLetterResult.data).slice(0, 200)}`,
      status: "Open",
    });
  }

  // ── Step 8: Manual Edit (via API — update resume) ──────────────────────
  console.log(`[8/11] Manual edit (updating resume summary)...`);
  let updateResult = await api("PATCH", `/api/resumes/${resumeId_doc}`, {
    summary: `${persona.summary} [EDITED: Added tailoring note for ${jdEntry.label}]`,
  });

  const editPass = updateResult.ok;
  personaResult.steps["Edit Manually"] = {
    pass: editPass,
    detail: editPass ? "Summary updated" : `HTTP ${updateResult.status}: ${String(updateResult.data).slice(0, 200)}`,
    durationMs: updateResult.durationMs,
  };
  console.log(`  → ${editPass ? "✅ PASS" : "❌ FAIL"} (${updateResult.durationMs}ms) — ${personaResult.steps["Edit Manually"].detail}`);

  // ── Step 9: Save & Reload ─────────────────────────────────────────────
  console.log(`[9/11] Save & reload (verifying persistence)...`);
  let getResult = await api<{ id: string; summary: string; sections: Array<Record<string, unknown>> }>(
    "GET",
    `/api/resumes/${resumeId_doc}`,
  );

  const reloadPass = getResult.ok && getResult.data?.id === resumeId_doc;
  personaResult.steps["Save & Reload"] = {
    pass: reloadPass,
    detail: reloadPass
      ? `Resume ${resumeId_doc} retrieved successfully`
      : `HTTP ${getResult.status}: Failed to reload resume`,
    durationMs: getResult.durationMs,
  };
  console.log(`  → ${reloadPass ? "✅ PASS" : "❌ FAIL"} (${getResult.durationMs}ms) — ${personaResult.steps["Save & Reload"].detail}`);

  if (!reloadPass) {
    personaResult.issues.push({
      id: `${resumeId}-RELOAD`,
      severity: "🔴 Critical",
      persona: persona.label,
      area: "Save & Reload",
      description: `Resume draft not persisted after save for ${persona.contact.fullName}`,
      stepsToReproduce: `Save draft, navigate away, GET /api/resumes/${resumeId_doc}`,
      expected: `Resume ${resumeId_doc} retrievable with all data intact`,
      actual: `HTTP ${getResult.status}${getResult.ok ? ": Data mismatch" : ""}`,
      status: "Open",
    });
  }

  // ── Step 10: Export PDF ────────────────────────────────────────────────
  console.log(`[10/11] Exporting PDF...`);
  let pdfResult = await api<{ url?: string; error?: string }>("POST", "/api/export/pdf", {
    resumeId: resumeId_doc,
    template: "modern",
  });

  const pdfPass = pdfResult.ok;
  personaResult.steps["Export PDF"] = {
    pass: pdfPass,
    detail: pdfPass
      ? `Duration: ${pdfResult.durationMs}ms${pdfResult.data?.url ? `, URL: ${(pdfResult.data.url as string).slice(0, 80)}` : ""}`
      : `HTTP ${pdfResult.status}: ${String(pdfResult.data).slice(0, 200)}`,
    durationMs: pdfResult.durationMs,
  };
  console.log(`  → ${pdfPass ? "✅ PASS" : "❌ FAIL"} (${pdfResult.durationMs}ms) — ${personaResult.steps["Export PDF"].detail}`);

  if (!pdfPass) {
    personaResult.issues.push({
      id: `${resumeId}-PDF`,
      severity: "🟠 Major",
      persona: persona.label,
      area: "Export PDF",
      description: `PDF export failed for ${persona.contact.fullName}`,
      stepsToReproduce: `POST /api/export/pdf with resumeId ${resumeId_doc}`,
      expected: "PDF export returns download URL or binary",
      actual: `HTTP ${pdfResult.status}: ${String(pdfResult.data).slice(0, 200)}`,
      status: "Open",
    });
  }

  // ── Step 11: Verify Billing ────────────────────────────────────────────
  console.log(`[11/11] Verifying billing state...`);
  let billingResult = await api<{ plan?: string; subscription?: Record<string, unknown>; resumes?: Array<unknown> }>(
    "GET",
    "/api/billing/subscription",
  );

  const billingPass = billingResult.ok;
  personaResult.steps["Verify Billing"] = {
    pass: billingPass,
    detail: billingPass
      ? `Plan: ${billingResult.data?.plan ?? "free/starter"} — Subscription accessible`
      : `HTTP ${billingResult.status}: ${String(billingResult.data).slice(0, 200)}`,
    durationMs: billingResult.durationMs,
  };
  console.log(`  → ${billingPass ? "✅ PASS" : "❌ FAIL"} (${billingResult.durationMs}ms) — ${personaResult.steps["Verify Billing"].detail}`);

  results.push(personaResult);
}

// ─── Summary Report ───────────────────────────────────────────────────────

console.log(`\n\n${"═".repeat(60)}`);
console.log(`  DOGFOODING PIPELINE — FINAL RESULTS`);
console.log(`${"═".repeat(60)}\n`);

const allIssues: Issue[] = [];
for (const r of results) {
  const passCount = Object.values(r.steps).filter((s) => s.pass).length;
  const totalCount = Object.values(r.steps).length;
  const status = passCount === totalCount ? "✅ PASS" : "⚠️  PARTIAL";
  console.log(`  ${r.name}`);
  console.log(`    Steps: ${passCount}/${totalCount} passing — ${status}`);
  for (const [step, result] of Object.entries(r.steps)) {
    console.log(`      ${result.pass ? "✅" : "❌"} ${step}: ${result.detail ?? ""}`);
  }
  allIssues.push(...r.issues);
  if (r.issues.length > 0) {
    console.log(`    Issues:`);
    for (const issue of r.issues) {
      console.log(`      ${issue.severity} ${issue.id}: ${issue.description}`);
    }
  }
  console.log();
}

// ── Issue Tracker ─────────────────────────────────────────────────────────
const critical = allIssues.filter((i) => i.severity === "🔴 Critical");
const major = allIssues.filter((i) => i.severity === "🟠 Major");
const minor = allIssues.filter((i) => i.severity === "🟡 Minor");
const enhancement = allIssues.filter((i) => i.severity === "🔵 Enhancement");

console.log(`${"─".repeat(60)}`);
console.log(`  Issue Summary`);
console.log(`${"─".repeat(60)}`);
console.log(`  🔴 Critical: ${critical.length}`);
console.log(`  🟠 Major:    ${major.length}`);
console.log(`  🟡 Minor:    ${minor.length}`);
console.log(`  🔵 Enhancement: ${enhancement.length}`);
console.log();

const allPass = critical.length === 0 && major.length === 0;
const passCount = results.filter((r) =>
  Object.values(r.steps).every((s) => s.pass),
).length;

console.log(`${"═".repeat(60)}`);
console.log(`  RELEASE GATE VERDICT`);
console.log(`${"═".repeat(60)}`);
console.log(`  Personas passing fully: ${passCount}/${results.length}`);
console.log(`  Critical: ${critical.length} / 0 required`);
console.log(`  Major:    ${major.length} / 0 required`);
console.log(`  ${allPass ? "✅ GATE PASSED — Recommend proceeding to regression tests" : "❌ GATE BLOCKED — Fix blocking issues first"}`);
console.log();

// Write detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    personasTotal: results.length,
    personasPassing: passCount,
    critical,
    major,
    minor,
    enhancement,
    gatePassed: allPass,
  },
  results: results.map((r) => ({
    name: r.name,
    steps: r.steps,
    issues: r.issues,
  })),
};

const reportDir = path.resolve(__dirname, "../../../docs/release");
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}
fs.writeFileSync(
  path.join(reportDir, "DOGFOODING_PIPELINE_RESULTS.json"),
  JSON.stringify(report, null, 2),
);
console.log(`Full report written to docs/release/DOGFOODING_PIPELINE_RESULTS.json`);

}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
