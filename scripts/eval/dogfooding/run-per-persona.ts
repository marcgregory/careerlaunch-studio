/**
 * Quick runner: register a fresh user per persona so we never hit free-tier limits.
 * Usage: npx tsx scripts/eval/dogfooding/run-per-persona.ts
 *
 * Run this and follow the prompts for each persona workflow step.
 */

import resumes from "../datasets/resumes.json";
import jobDescriptions from "../datasets/job-descriptions.json";

const BASE_URL = process.env.DOGFOOD_BASE_URL || "http://localhost:3000";
const DOGFOOD_IDS = ["resume-16", "resume-17", "resume-18", "resume-19", "resume-20", "resume-21"];

async function main() {
  // ── Clean up all test users ─────────────────────────────────────────────
  for (const resumeId of DOGFOOD_IDS) {
    const personaIdx = resumes.findIndex((r) => r.id === resumeId);
    const persona = resumes[personaIdx];
    if (!persona) continue;

    const slug = persona.contact.fullName.toLowerCase().replace(/\s+/g, "-");
    const email = `dogfood-${slug}@example.com`;
    const jdEntry = jobDescriptions[personaIdx];

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  Persona ${resumeId.slice(-2)}: ${persona.label}`);
    console.log(`  Name:    ${persona.contact.fullName}`);
    console.log(`  Email:   ${email}`);
    console.log(`  Target:  ${jdEntry?.label}`);
    console.log(`${"═".repeat(60)}\n`);

    // ── Step 0: Register ────────────────────────────────────────────────
    console.log(`[0] Registering user ${email}...`);
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      body: new URLSearchParams({
        email,
        name: persona.contact.fullName,
        password: "testpassword123",
      }),
      redirect: "manual",
    });

    // Extract session cookie from Set-Cookie header
    const setCookie = registerRes.headers.get("set-cookie") || "";
    const sessionMatch = setCookie.match(/careerlaunch_session=([^;]+)/);
    if (!sessionMatch) {
      console.error(`  ❌ FAILED: No session cookie for ${email}`);
      console.error(`     HTTP ${registerRes.status}`);
      continue;
    }
    const session = `careerlaunch_session=${sessionMatch[1]}`;
    console.log(`  ✅ Registered (session obtained)`);

    // ── Step 1: Import Resume ───────────────────────────────────────────
    const resumeText = buildResumeText(persona);
    console.log(`[1] Importing resume...`);
    const impRes = await apiPost("/api/import/text", { text: resumeText }, session);
    if (!impRes.ok) {
      console.error(`  ❌ FAILED: HTTP ${impRes.status}`);
      logIssue(resumeId, persona.label, "Import", `HTTP ${impRes.status}`, "Import succeeds", impRes.text.slice(0, 200));
      continue;
    }

    const importData = impRes.json as { parsed?: Record<string, unknown>; importQuality?: string; coverage?: Array<{ sectionId: string; ratio: number }> };
    const quality = importData?.importQuality ?? "unknown";
    const coverage = importData?.coverage ?? [];
    console.log(`  ✅ Import: quality=${quality}`);
    console.log(`     Coverage: ${coverage.map((c) => `${c.sectionId}=${Math.round(c.ratio * 100)}%`).join(", ")}`);

    if (quality === "failed") {
      console.error(`  ❌ Import quality=failed`);
      logIssue(resumeId, persona.label, "Import", "Import quality=failed", "Import succeeds", "quality=failed");
      continue;
    }

    // ── Step 2: Validate import structure ────────────────────────────────
    const parsed = importData?.parsed ?? {};
    const parsedExperience = (parsed.experience as Array<Record<string, unknown>>) ?? [];
    const parsedSkills = (parsed.skills as Array<unknown>) ?? [];
    const personaExperience = persona.sections.filter((s) => s.type === "experience");

    console.log(`  ✅ Structure: ${parsedExperience.length}/${personaExperience.length} experiences, ${parsedSkills.length}/${persona.skills.length} skills`);

    if (parsedExperience.length < personaExperience.length) {
      logIssue(resumeId, persona.label, "Import Structure",
        `Expected ${personaExperience.length} experiences, got ${parsedExperience.length}`,
        `${personaExperience.length} experiences`, `${parsedExperience.length} experiences`);
    }

    // ── Step 3: Create resume draft ─────────────────────────────────────
    console.log(`[2] Creating resume draft...`);
    const resumeDoc = {
      title: `${persona.contact.fullName} — ${persona.label}`,
      targetRole: jdEntry?.label || "",
      summary: (parsed?.summary as string) ?? persona.summary,
      contact: {
        fullName: persona.contact.fullName,
        email: persona.contact.email,
        phone: persona.contact.phone,
        location: persona.contact.location,
        website: persona.contact.website || "",
      },
      experience: parsedExperience.map((exp: Record<string, unknown>) => ({
        role: (exp.role as string) ?? "",
        company: (exp.company as string) ?? "",
        bullets: (exp.bullets as string[]) ?? [],
        startDate: (exp.dateRange as Record<string, string>)?.start as string ?? "",
        endDate: (exp.dateRange as Record<string, string>)?.end as string ?? "",
        current: (exp.dateRange as Record<string, string>)?.end === "present",
      })),
      skills: parsedSkills.map((s: string | { name: string }) => (typeof s === "string" ? s : s.name)),
      certifications: persona.certifications.map((c: string) => ({ name: c })),
      projects: persona.projects.map((p: { name: string; description: string; url?: string }) => ({
        name: p.name, description: p.description, url: p.url || "", bullets: [],
      })),
      education: [],
      professionalQualities: [],
      templateId: "modern",
      sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
    };

    const createRes = await apiPost("/api/resumes", resumeDoc, session);
    const resumeId_doc = (createRes.json as { resume?: { id?: string } })?.resume?.id;
    if (!createRes.ok || !resumeId_doc) {
      console.error(`  ❌ FAILED: HTTP ${createRes.status}`);
      logIssue(resumeId, persona.label, "Resume Creation", `HTTP ${createRes.status}: ${createRes.text.slice(0, 100)}`, "Resume created", createRes.text.slice(0, 200));
      continue;
    }
    console.log(`  ✅ Resume: ${resumeId_doc}`);

    // ── Step 4: Analyze resume ─────────────────────────────────────────
    console.log(`[3] Running analysis...`);
    const targetJd = jdEntry?.text || jdEntry?.description || "";
    const analyzeRes = await apiGet(`/api/resumes/${resumeId_doc}/analyze${targetJd ? `?jobDescription=${encodeURIComponent(targetJd.slice(0, 500))}` : ""}`, session);
    console.log(`  ${analyzeRes.ok ? "✅" : "❌"} Analysis: HTTP ${analyzeRes.status} (${analyzeRes.durationMs}ms)`);

    if (!analyzeRes.ok) {
      logIssue(resumeId, persona.label, "Analysis", `HTTP ${analyzeRes.status}`, "Analysis completes", analyzeRes.text.slice(0, 200));
    }

    // ── Step 5+6: Tailor + Apply ────────────────────────────────────────
    console.log(`[4] Running AI tailoring...`);
    const tailorRes = await apiPost(`/api/resumes/${resumeId_doc}/tailor`, { jobDescription: targetJd }, session);
    const suggestions = (tailorRes.json as { suggestions?: Array<{ id: string; title: string; severity: string }> })?.suggestions ?? [];
    console.log(`  ${tailorRes.ok ? "✅" : "❌"} Tailor: HTTP ${tailorRes.status} (${tailorRes.durationMs}ms), ${suggestions.length} suggestions`);

    if (!tailorRes.ok) {
      logIssue(resumeId, persona.label, "Tailoring", `HTTP ${tailorRes.status}`, "Tailoring succeeds", tailorRes.text.slice(0, 200));
    }

    // Apply suggestions
    console.log(`[5] Applying suggestions...`);
    if (suggestions.length > 0) {
      const firstId = suggestions[0].id;
      const appRes = await apiPost(`/api/resumes/${resumeId_doc}/suggestions/apply`, { suggestionId: firstId }, session);
      console.log(`  ${appRes.ok ? "✅" : "❌"} Apply individual: HTTP ${appRes.status}`);

      if (suggestions.length > 1) {
        const bulkIds = suggestions.slice(1).map((s) => s.id);
        const bulkRes = await apiPost(`/api/resumes/${resumeId_doc}/suggestions/apply-bulk`, { suggestionIds: bulkIds }, session);
        console.log(`  ${bulkRes.ok ? "✅" : "⚠️"} Apply bulk (${bulkIds.length}): HTTP ${bulkRes.status}`);
      }
    } else {
      console.log(`  ⏭️  No suggestions to apply`);
    }

    // ── Step 7: Cover Letter ────────────────────────────────────────────
    console.log(`[6] Generating cover letter...`);
    const clRes = await apiPost(`/api/resumes/${resumeId_doc}/cover-letter/generate`, { jobDescription: targetJd }, session);
    console.log(`  ${clRes.ok ? "✅" : "❌"} Cover letter: HTTP ${clRes.status} (${clRes.durationMs}ms)`);

    if (!clRes.ok) {
      logIssue(resumeId, persona.label, "Cover Letter", `HTTP ${clRes.status}`, "Cover letter generated", clRes.text.slice(0, 200));
    }

    // ── Step 8: Manual edit ─────────────────────────────────────────────
    console.log(`[7] Manual edit...`);
    const editRes = await apiPut(`/api/resumes/${resumeId_doc}`, {
      title: `${persona.contact.fullName} — ${persona.label}`,
      summary: `${persona.summary} [EDITED for ${jdEntry?.label}]`,
      contact: {
        fullName: persona.contact.fullName,
        email: persona.contact.email,
        phone: persona.contact.phone,
        location: persona.contact.location,
        website: persona.contact.website || "",
      },
      experience: parsedExperience.map((exp: Record<string, unknown>) => ({
        role: (exp.role as string) ?? "",
        company: (exp.company as string) ?? "",
        bullets: (exp.bullets as string[]) ?? [],
        startDate: (exp.dateRange as Record<string, string>)?.start as string ?? "",
        endDate: (exp.dateRange as Record<string, string>)?.end as string ?? "",
        current: (exp.dateRange as Record<string, string>)?.end === "present",
      })),
      skills: parsedSkills.map((s: string | { name: string }) => (typeof s === "string" ? s : s.name)),
      templateId: "modern",
    }, session);
    console.log(`  ${editRes.ok ? "✅" : "❌"} Edit: HTTP ${editRes.status} (${editRes.durationMs}ms)`);

    // ── Step 9: Save & Reload ───────────────────────────────────────────
    console.log(`[8] Save & reload...`);
    const getRes = await apiGet(`/api/resumes/${resumeId_doc}`, session);
    const reloaded = getRes.ok;
    console.log(`  ${reloaded ? "✅" : "❌"} Reload: HTTP ${getRes.status}`);

    if (!reloaded) {
      logIssue(resumeId, persona.label, "Save & Reload", `HTTP ${getRes.status}`, "Resume retrievable after save", getRes.text.slice(0, 100));
    }

    // ── Step 10: Export PDF ─────────────────────────────────────────────
    console.log(`[9] Exporting PDF...`);
    const pdfRes = await apiPost("/api/export/pdf", { resumeId: resumeId_doc, template: "modern" }, session);
    console.log(`  ${pdfRes.ok ? "✅" : "❌"} PDF export: HTTP ${pdfRes.status} (${pdfRes.durationMs}ms)`);

    if (!pdfRes.ok) {
      logIssue(resumeId, persona.label, "PDF Export", `HTTP ${pdfRes.status}`, "PDF exports", pdfRes.text.slice(0, 200));
    }

    // ── Step 11: Billing ────────────────────────────────────────────────
    console.log(`[10] Verifying billing...`);
    const billRes = await apiGet("/api/billing/subscription", session);
    console.log(`  ${billRes.ok ? "✅" : "❌"} Billing: HTTP ${billRes.status}`);

    console.log(`\n  🎯 ${persona.label}: ${allStepsPassed([impRes.ok, !!resumeId_doc, tailorRes.ok, getRes.ok, pdfRes.ok]) ? "✅ PASS" : "⚠️  PARTIAL"}`);
  }
}

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

type ApiResponse = { ok: boolean; status: number; json: Record<string, unknown>; text: string; durationMs: number };

async function apiGet(path: string, session: string): Promise<ApiResponse> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: session }, redirect: "manual" });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.status >= 200 && res.status < 400, status: res.status, json, text, durationMs: Date.now() - start };
}

async function apiPut(path: string, body: unknown, session: string): Promise<ApiResponse> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: session },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.status >= 200 && res.status < 400, status: res.status, json, text, durationMs: Date.now() - start };
}

async function apiPost(path: string, body: unknown, session: string): Promise<ApiResponse> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: session },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: res.status >= 200 && res.status < 400, status: res.status, json, text, durationMs: Date.now() - start };
}

const issueLog: Array<{
  id: string; severity: string; persona: string; area: string;
  description: string; expected: string; actual: string;
}> = [];

function logIssue(resumeId: string, persona: string, area: string, description: string, expected: string, actual: string) {
  issueLog.push({
    id: `${resumeId}-${area.toUpperCase().replace(/\s+/g, "-")}`,
    severity: description.startsWith("HTTP 5") || description.startsWith("HTTP 4") && !description.startsWith("HTTP 40") ? "🔴 Critical" : "🟠 Major",
    persona, area, description, expected, actual,
  });
  console.error(`  ⚠️  ISSUE: [${issueLog[issueLog.length - 1].severity}] ${description}`);
}

function allStepsPassed(results: boolean[]): boolean {
  return results.every(Boolean);
}

main()
  .then(() => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ISSUES FOUND: ${issueLog.length}`);
    const critical = issueLog.filter((i) => i.severity === "🔴 Critical");
    const major = issueLog.filter((i) => i.severity === "🟠 Major");
    console.log(`  🔴 Critical: ${critical.length}`);
    console.log(`  🟠 Major:    ${major.length}`);
    console.log(`${"═".repeat(60)}`);
    process.exit(issueLog.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
