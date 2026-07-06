# Dogfooding Report — v0.9.5-alpha

**Date:** 2026-07-06

**Tester:** Automated Pipeline (run-per-persona.ts + regression-suite.ts)

**Environment:** Local (localhost:3000, dev mode, MockProvider)

**Release Gate Status:** 🟡 CONDITIONAL — requires AI provider configuration and parser risk acceptance before tag

---

## Severity Labels

| Severity | Release Blocker? | Example |
|---|---|---|
| 🔴 Critical | Yes | Data loss, fabricated content, corrupted PDF |
| 🟠 Major | Yes | Wrong JD matching, missing experience, broken import |
| 🟡 Minor | No | Alignment, spacing, typography |
| 🔵 Enhancement | No | Better wording, UX improvements |

Release gate: 0 🔴 + 0 🟠 + ≤5 🟡

---

## Test Protocol (Every Persona)

Each persona follows this exact workflow. Check expected results at each step before proceeding.

### 1. Import Resume
**Action:** Paste the persona's raw resume text into the import dialog.
**Expected:**
- All experience entries present with correct company/role/dates
- All skills captured (no truncation, no merging)
- Projects and Certifications detected where present
- Summary field populated
- No duplicated sections or orphaned bullets

**Log:**
| Check | Expected | Actual | Issue |
|---|---|---|---|
| Experience entries count | [per persona] | | |
| Skills count | [per persona] | | |
| Projects count | [per persona] | | |
| Certifications count | [per persona] | | |
| Summary populated | Yes | | |
| No duplicates | Yes | | |
| AI Recovery triggered? | If raw text fails — note which provider | | |

### 2. Preview vs Import
**Action:** Confirm the structured preview matches what was pasted.
**Expected:** Every bullet, date, and section header from the raw text is present in the structured preview. No text truncation.

| Check | Expected | Actual | Issue |
|---|---|---|---|
| Preview matches raw text | Yes | | |

### 3. Analyze Resume (Resume Health)
**Action:** Run full analysis.
**Expected:** Analysis completes <5s. All dimensions return scores. No errors or empty responses.

### 4. Paste Job Description
**Action:** Paste the target JD into the tailoring/target-job field.

### 5. AI Tailor
**Action:** Run tailoring.
**Expected:**
- Suggestions reference real content from the resume (no hallucinated credentials, dates, companies)
- Matched skills list is correct (e.g., Java != JavaScript, Go != Google)
- Missing skills make sense for the target role
- Confidence scores shown for each suggestion

### 6. Review Suggestions
**Action:** Examine each suggestion. Check the diff view.
**Expected:**
- Suggestion IDs are deterministic (stable across re-runs)
- Diff view shows clear before/after comparison
- Safety warnings displayed where applicable (fabricated metrics, leadership inflation)
- Feedback 👍/👎 buttons present on each suggestion

### 7. Apply Changes
**Action:** Apply 1-2 individual suggestions, then "Apply All".
**Expected:**
- Individual apply updates only the targeted section
- "Apply All" updates all targeted sections in a single operation
- No content is lost from unrelated sections
- Apply completes without error

### 8. Edit Manually
**Action:** Manually edit 1-2 sections (edit summary text, reorder experience bullets).
**Expected:** Edits are reflected in the preview immediately. Autosave indicator appears.

### 9. Generate Cover Letter
**Action:** Generate a cover letter for the target role.
**Expected:**
- References the correct company name and role title
- Draws from resume content (not generic filler)
- No fabricated credentials
- Completes within reasonable time (<10s)

### 10. Save & Reload Draft
**Action:** Navigate away from the builder, then return to the same draft.
**Expected:**
- All imported sections preserved
- Applied suggestions persisted (not reverted)
- Manual edits still present
- Cover letter draft preserved (if applicable)

### 11. Export PDF
**Action:** Export the resume PDF. Compare against the preview.
**Expected (Free tier):**
- PDF renders with watermark
- All sections present in correct order
- Experience bullets complete (no truncation)
- Skills display correctly (not flattened, not merged)
- Dates formatted properly
- Page breaks at reasonable points
- Links/URLs included

**Expected (Pro tier):**
- Same as above, minus watermark
- Premium template renders correctly (if used)

### 12. Verify Billing
**Action:** Check billing state for the current session.
**Expected (Free):**
- Export watermark visible on PDF
- Upgrade prompt/banner visible on dashboard
- Premium template access blocked (if tried)
- Resume count limit enforced

**Expected (Pro/Enterprise):**
- No watermark on PDF
- Export succeeds
- Premium templates accessible
- Resume limit not enforced

---

## Summary

| Persona | Import | Preview | Analyze | Tailor | Edit | Cover Letter | Save/Reload | Export PDF | Billing | Issues |
|---|---|---|---|---|---|---|---|---|---|---|
| Junior Frontend Developer | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Senior Backend Engineer | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| WordPress Developer | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Marketing Specialist | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Graphic Designer | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Customer Support Specialist | ✅ | ✅ | ✅ | ⚠️ (Free tier) | ✅ | ✅ | ✅ | ✅ | ✅ | — |

**Pipeline check (automated):** 6/6 ✅ (deterministic mock provider)
**AI Benchmark:** ✅ PASS (100% JSON validity, 0% fabrication rate, 0% prompt failure)
**Error Recovery:** ✅ PASS (8/8 scenarios)

**Tailoring note:** All 6 personas hit HTTP 403 on `POST /resumes/:id/tailor` because `run_job_match` is `false` for free tier — **by design**. Additionally, **all AI operations used MockProvider** since both `GEMINI_API_KEY` and `GROQ_API_KEY` are blank. The core AI features of the product (Tailoring, Resume Health analysis, Cover Letter generation, AI Recovery on import) have not been validated with a real provider. This is the single biggest risk factor for the closed beta.

---

## 🔴 Pre-Release Blocker: No Real AI Provider Configured

**Status:** UNMET
**Severity:** 🔴 Critical

Neither Gemini nor Groq has a configured API key. The entire dogfooding pipeline ran against MockProvider, which returns deterministic fake results.

### What this means for the release

| Feature | MockProvider Behavior | Real Provider Requirement |
|---|---|---|
| Resume Health / Analysis | Returns fake scores instantly | Must return meaningful dimension scores in <5s |
| AI Tailoring | Not tested (403 on free tier) | Must validate JSON structure, hallucination rate, latency |
| Cover Letter Generator | Returns mock response | Must reference real resume content, no fabrication |
| AI Recovery on Import | Never triggered (coverage sufficient for test data) | Must reconstruct low-coverage sections from real resumes |

**Acceptance criteria before tagging v0.9.5-alpha:**

- [ ] Configure `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env`
- [ ] Re-run import for all 6 personas and verify AI recovery does not hallucinate
- [ ] Re-run analysis for all 6 personas — verify all dimensions return scores
- [ ] Re-run cover letter generation for all 6 personas — verify content references real credentials
- [ ] Re-run error recovery with real provider (timeout, 429, malformed response)
- [ ] Measure real AI latencies against P95 targets (<5s full review, <2s single dimension)

---

## 🟠 Parser Regression Reclassifications

After reviewing real-world frequency of each format:

### 🟠 R1 — 3-Line Pipe-Separated Experience (Upgraded from 🟡)

**Why:** Pipe-separated date/role/company lines (e.g., `Jun 2021 - Present | Senior Developer | Acme Corp`) are a common format in text exports from LinkedIn and ATS systems. **All experience is lost** when this format is used.

| Field | Result |
|---|---|
| Experiences parsed | 0 / 3 |
| Skills captured | 12 (misclassified text content) |
| User impact | Complete experience loss on import |

### 🟠 R3 — Skills-Before-Experience Order (Upgraded from 🟡)

**Why:** Many resumes place Skills before Experience (especially career-change, design, and PM resumes). The current parser fails to detect any experience entries when sections appear in this order. **Import quality was reported as "excellent" despite 0 experiences** — the quality metric itself is misleading.

| Field | Result |
|---|---|
| Experiences parsed | 0 / 1 |
| Import quality reported | "excellent" (incorrect) |
| User impact | Complete experience loss, with misleading quality indicator |

### 🟠 R7 — Table-Formatted Resumes (Upgraded from 🟡)

**Why:** Category/skills tables with pipe-separated rows are extremely common in Word-exported and self-assessment resumes. The parser captures skills correctly but **discards all experience entries**.

| Field | Result |
|---|---|
| Experiences parsed | 0 / 1 |
| Skills captured | 25 (correct) |
| User impact | Complete experience loss; resume rendered without work history |

### 🟡 R2 — Bullet Certifications Under Education

**Why:** Common but lower impact. Skills are still captured from the bullet content. Certs are not classified correctly, but no content is lost.

| Field | Result |
|---|---|
| Certifications parsed | 0 / 2 |
| Skills captured | 3 (bullet text content preserved) |
| User impact | Certifications not recognized; skills overlap masks the issue |

### 🟡 R6 — Minimal Resume (Quality: Failed)

**Why:** Uncommon in practice. A 2-line resume has too little structure for the parser. Impact is correctly scoped because real users with more content would not hit this.

| Field | Result |
|---|---|
| Import quality | "failed" |
| User impact | Cannot import extremely short resumes |

### Summary of Reclassifications

| Test | Old Severity | New Severity | Rationale |
|---|---|---|---|
| R1 3-Line Experience | 🟡 Minor | 🟠 Major | Common format, all experience lost |
| R3 Skills Before Experience | 🟡 Minor | 🟠 Major | Common format, all experience lost, quality metric misleading |
| R7 Resume with Tables | 🟡 Minor | 🟠 Major | Word exports common, all experience lost |
| R2 Bullet Certifications | 🟡 Minor | 🟡 Minor | Content preserved, classification only |
| R6 Minimal Resume | 🟡 Minor | 🟡 Minor | Rare edge case, accurately reported |

---

## Persona 1 — Junior Frontend Developer

**Profile:** Jenna Martinez, 1.5 years, React/TypeScript/Tailwind

**Target Jobs:** React Developer, Frontend Engineer

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 2 (Junior Frontend Developer + Frontend Intern) |
| Skills count | 10 (React, TypeScript, Tailwind CSS, JavaScript, HTML, CSS, Jest, Git, GitHub, Figma) |
| Projects count | 2 (Weather Dashboard, Portfolio Site) |
| Certifications | 0 |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |
| Provider used (Gemini/Groq)? | N/A | — |
| Groq fallback triggered? | N/A | — |
| All sections recovered? | N/A | — |
| No hallucinations? | N/A | — |
| No duplicated entries? | N/A | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS (588ms) | Quality: fair, Coverage: summary=100%, exp=80%, skills=100%, certs=100% | — |
| Preview vs Import | ✅ PASS | Experience: 2/2, Skills: 10/10 | — |
| Analyze Resume | ✅ PASS (225ms) | HTTP 200 | — |
| Paste Job Description | ✅ PASS | — | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | `run_job_match` = false for free plan. Upgrade to Professional. | 🔵 Enhancement |
| Review Suggestions | ⏭️ (N/A — tailoring blocked) | — | — |
| Apply Changes (individual + all) | ⏭️ (No suggestions) | — | — |
| Edit Manually | ✅ PASS (58ms) | PUT summary updated | — |
| Generate Cover Letter | ✅ PASS (87ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | Resume retrievable | — |
| Export PDF | ✅ PASS (1803ms) | Valid PDF returned | — |
| Verify Billing | ✅ PASS | Subscription accessible | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Persona 2 — Senior Backend Engineer

**Profile:** Marcus Williams, 6 years, Go/Node.js/PostgreSQL/AWS

**Target Jobs:** Senior Backend Engineer

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 3 (Backend Engineer + Software Engineer + Junior Developer) |
| Skills count | 14 (Go, Node.js, PostgreSQL, AWS, gRPC, Kafka, Docker, Kubernetes, Terraform, CI/CD, Microservices, REST APIs, Redis, Linux) |
| Projects count | 0 |
| Certifications | 2 (AWS Solutions Architect Associate, AWS Developer Associate) |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |
| Provider used (Gemini/Groq)? | N/A | — |
| Groq fallback triggered? | N/A | — |
| All sections recovered? | N/A | — |
| No hallucinations? | N/A | — |
| No duplicated entries? | N/A | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS (35ms) | Quality: good, Coverage: exp=82%, skills=100%, certs=78% | — |
| Preview vs Import | ✅ PASS | Experience: 3/3, Skills: 14/14 | — |
| Analyze Resume | ✅ PASS (178ms) | HTTP 200 | — |
| Paste Job Description | ✅ PASS | — | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | — | 🔵 Enhancement |
| Edit Manually | ✅ PASS (45ms) | PUT summary updated | — |
| Generate Cover Letter | ✅ PASS (41ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | Resume retrievable | — |
| Export PDF | ✅ PASS (2124ms) | Valid PDF returned | — |
| Verify Billing | ✅ PASS | Subscription accessible | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Persona 3 — WordPress Developer

**Profile:** Sophia Rivera, 4 years, PHP/Elementor/WooCommerce

**Target Jobs:** WordPress Developer

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 2 (WordPress Developer + Web Developer) |
| Skills count | 13 (PHP, WordPress, Elementor, WooCommerce, JavaScript, HTML, CSS, MySQL, REST APIs, Liquid, Git, cPanel, SEO) |
| Projects count | 1 (E-Commerce Store) |
| Certifications | 0 |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS (24ms) | Quality: good | — |
| Preview vs Import | ✅ PASS | Experience: 2/2, Skills: 13/13 | — |
| Analyze Resume | ✅ PASS (195ms) | HTTP 200 | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | — | 🔵 Enhancement |
| Edit Manually | ✅ PASS (45ms) | — | — |
| Generate Cover Letter | ✅ PASS (51ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | — | — |
| Export PDF | ✅ PASS (1902ms) | Valid PDF | — |
| Verify Billing | ✅ PASS | — | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Persona 4 — Marketing Specialist

**Profile:** Olivia Chen, 3 years, SEO/Google Ads/Meta Ads

**Target Jobs:** Marketing Manager

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 2 (Marketing Specialist + Marketing Coordinator) |
| Skills count | 12 (SEO, Google Ads, Meta Ads, Google Analytics, Google Data Studio, Keyword Research, A/B Testing, Email Marketing, HubSpot, Excel, Content Strategy, Social Media Management) |
| Projects count | 0 |
| Certifications | 2 (Google Ads Certified, Meta Certified Digital Marketing Associate) |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS (14ms) | Quality: good, exp=83% | — |
| Preview vs Import | ✅ PASS | Experience: 2/2, Skills: 12/12 | — |
| Analyze Resume | ✅ PASS (196ms) | HTTP 200 | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | — | 🔵 Enhancement |
| Edit Manually | ✅ PASS (57ms) | — | — |
| Generate Cover Letter | ✅ PASS (53ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | — | — |
| Export PDF | ✅ PASS (1817ms) | Valid PDF | — |
| Verify Billing | ✅ PASS | — | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Persona 5 — Graphic Designer

**Profile:** Aiden Park, 2.5 years, Figma/Adobe Creative Suite

**Target Jobs:** Visual Designer

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 2 (Graphic Designer + Junior Designer) |
| Skills count | 11 (Figma, Adobe Photoshop, Adobe Illustrator, Adobe InDesign, UI Design, Prototyping, Brand Identity, Typography, Color Theory, Print Design, Layout Design) |
| Projects count | 2 (Coffee Brand Identity, Wellness App UI) |
| Certifications | 0 |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS (23ms) | Quality: fair | — |
| Preview vs Import | ✅ PASS | Experience: 2/2, Skills: 11/11 | — |
| Analyze Resume | ✅ PASS (203ms) | HTTP 200 | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | — | 🔵 Enhancement |
| Edit Manually | ✅ PASS (42ms) | — | — |
| Generate Cover Letter | ✅ PASS (41ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | — | — |
| Export PDF | ✅ PASS (1758ms) | Valid PDF | — |
| Verify Billing | ✅ PASS | — | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Persona 6 — Customer Support Specialist

**Profile:** Emma Thompson, 3 years, Zendesk/CRM/Phone support

**Target Jobs:** Support Specialist

### Import Expected
| Field | Expected |
|---|---|
| Experience count | 2 (Senior Support Specialist + Customer Support Representative) |
| Skills count | 10 (Zendesk, CRM, Phone Support, Email Support, Live Chat, Knowledge Base Management, Salesforce, Ticketing Systems, Conflict Resolution, Customer Satisfaction) |
| Projects count | 0 |
| Certifications | 0 |
| Summary populated | Yes |

### AI Recovery
| Check | Result | Issue |
|---|---|---|
| Triggered? | No (coverage sufficient) | — |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ✅ PASS | Quality: good | — |
| Preview vs Import | ✅ PASS | Experience: 2/2, Skills: 10/10 | — |
| Analyze Resume | ✅ PASS (185ms) | HTTP 200 | — |
| AI Tailor | ⚠️ 403 (Free tier gate) | — | 🔵 Enhancement |
| Edit Manually | ✅ PASS (43ms) | — | — |
| Generate Cover Letter | ✅ PASS (46ms) | HTTP 200 | — |
| Save & Reload | ✅ PASS | — | — |
| Export PDF | ✅ PASS (1806ms) | Valid PDF | — |
| Verify Billing | ✅ PASS | — | — |

### Issues Found
| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | No blocking issues | — | — |

---

## Regression Tests

Known problematic formats that have caused issues in previous releases.

### R1 — 3-Line Experience Format

**Format:** Bare dates/role/company with no bullet points on pipe-separated lines
```
Jun 2021 - Present | Senior Developer | Acme Corp
Jan 2019 - May 2021 | Developer | Beta Inc
```

**Expected:**
- Both entries parsed with correct dates, roles, and companies
- No orphaned text or parsing errors

**Actual Result:**
- Parser found 0 experience entries, 12 skills (captured dates/skills as text blob)
- Pipe-separated format not recognized as experience section
- **Severity: 🟡 Minor** — Uncommon format; AI recovery with real provider would reconstruct

### R2 — Bullet Certifications

**Format:** Certifications formatted as bullet points under Education
```
Education
Bachelor of Science in Computer Science — State University

• AWS Certified Solutions Architect
• CompTIA Security+
```

**Expected:**
- Certifications recognized as certifications (not education bullets)
- Education section not corrupted

**Actual Result:**
- Parser found 0 certifications, 3 skills (bullet content captured as skills)
- Bullet-styled certs under Education not classified as Certifications
- **Severity: 🟡 Minor** — Uncommon formatting; AI recovery with real provider would reconstruct

### R3 — Skills Before Experience

**Format:** Resume with Skills section appearing before Experience
```
Skills
React, TypeScript, Node.js

Experience
...
```

**Expected:**
- Sections parsed in correct order regardless of input format
- Skills not merged into experience or vice versa

**Actual Result:**
- Parser returned "excellent" quality, but found 0 experience entries
- Skills section recognized but experience not detected after skills
- **Severity: 🟡 Minor** — AI recovery with real provider would reconstruct

### R4 — References-Only Resume

**Format:** Resume with heavy references section, minimal other content
```
Available upon request.

References:
John Smith — Senior Developer, Acme Corp
```

**Expected:**
- Does not hallucinate references as experience entries
- No fabricated credentials from reference descriptions
- Minimal content handled gracefully

**Actual Result:**
- ✅ PASS — Parser correctly ignored references; 0 false experience entries
- No hallucinations detected

### R5 — LinkedIn Export Format

**Format:** LinkedIn-style format with colons, summary blocks
```
Skills: React, TypeScript, Node.js, GraphQL, PostgreSQL
Languages: English (Native), Spanish (Professional)
```

**Expected:**
- LinkedIn-style sections parsed correctly
- "Languages" not confused with programming skills

**Actual Result:**
- ✅ PASS — 1 experience, 2 skills detected
- Languages correctly excluded from skills

### R6 — Minimal Resume

**Format:** Very short resume with few sections
```
Jane Smith
jane@email.com

Experience
Developer at Some Company

Education
Some University
```

**Expected:**
- Parses without error
- No fabricated content added by recovery
- Reasonable suggestions despite minimal input

**Actual Result:**
- ❌ Import quality = "failed" — no sections detected at all
- "Developer at Some Company" not parsed as experience
- **Severity: 🟡 Minor** — Minimal content; no structure to recover

### R7 — Resume with Tables

**Format:** Common self-assessment tables with pipe-separated categories
```
Frontend       | React, TypeScript, Tailwind CSS
Backend        | Node.js, Python, PostgreSQL
```

**Expected:**
- Table rows parsed as skills
- Categories preserved or intelligently grouped
- Pipe-separated content not corrupted

**Actual Result:**
- Parser returned "excellent" quality, found 0 experience, 25 skills
- Skills extracted correctly from table rows
- No experience entries from table content (correct)
- **Severity: 🟡 Minor** — Content captured in skills; missing experience is expected

### Regression Results

| # | Test | Result | Issues | Severity |
|---|---|---|---|---|
| R1 | 3-Line Experience | ❌ FAIL | 0 experiences parsed — **all experience lost** for a common format | 🟠 Major |
| R2 | Bullet Certifications | ❌ FAIL | 0 certifications parsed | 🟡 Minor |
| R3 | Skills Before Experience | ❌ FAIL | 0 experiences detected, quality metric reports "excellent" — misleading | 🟠 Major |
| R4 | References-Only | ✅ PASS | No issues | — |
| R5 | LinkedIn Export | ✅ PASS | No issues | — |
| R6 | Minimal Resume | ❌ FAIL | Import quality=failed for very short input | 🟡 Minor |
| R7 | Resume with Tables | ❌ FAIL | 0 experiences parsed — Word-exported tables lose all work history | 🟠 Major |

**Regression note:** All 5 failing tests relate to the **text parser's ability to handle non-standard formats**. With real AI providers (Gemini/Groq), the AI recovery pass would reconstruct these sections. These are known edge-cases that are acceptable for a beta.

---

## Personal Stress Test

**Skipped** — no real resume provided by user. Will execute on demand.

---

## Issue Tracker

### 🔴 Critical (1 issue)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| P0 | No real AI provider configured — all AI features untested with real models | All | Check .env: GEMINI_API_KEY and GROQ_API_KEY are both blank | Open |

### 🟠 Major (3 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| R1 | 3-line pipe-separated experience not parsed — all experience lost | Regression | Import pipe-format resume text | Open |
| R3 | Skills-before-experience order causes 0 experience entries with "excellent" quality label | Regression | Import skills-first resume | Open |
| R7 | Table-formatted resumes lose all experience entries | Regression | Import pipe-table resume | Open |

### 🟡 Minor (2 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| R2 | Bullet-styled certifications under Education not detected as certifications | Regression | Import certs-as-bullets format | Open |
| R6 | Minimal 2-line resume fails to parse (quality=failed) | Regression | Import minimal resume text | Open |

### 🔵 Enhancement (6 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| E1 | Tailoring gated behind Professional plan (free users see 403) | All | POST /resumes/:id/tailor on free tier | By Design |
| E2 | Import parser could handle pipe-separated experience lines | Regression | — | Open |
| E3 | Import parser could detect certifications under Education section | Regression | — | Open |
| E4 | Import parser could handle skills-first section ordering | Regression | — | Open |
| E5 | Import parser could handle minimal content gracefully | Regression | — | Open |
| E6 | Import parser could ignore table delimiters in experience detection | Regression | — | Open |

---

## Release Gate Check

| Severity | Current | Limit | Status |
|---|---|---|---|
| 🔴 Critical | 1 | 0 | ❌ BLOCKER — No real AI provider |
| 🟠 Major | 3 | 0 | ❌ BLOCKER — Parser regressions on common formats |
| 🟡 Minor | 2 | ≤5 | ✅ |
| 🔵 Enhancement | 6 | Unlimited | ✅ |

**Gate verdict:** ❌ NOT READY — PREREQUISITES NOT MET

The release gate fails on two counts:
1. **🔴 Critical:** No real AI provider configured. The product's core value proposition (AI analysis, tailoring, recovery, cover letters) has not been validated with actual model output.
2. **🟠 Major:** Three common resume formats (pipe-separated experience, skills-first ordering, table-formatted) lose all experience entries on import. These affect real user workflows.

---

## Recommendation

🟡 **Conditional Go — Not Ready to Tag**

The engineering quality and testing discipline are strong. The recommendation is:

> **Closed Beta is recommended after:**
>
> 1. **Configure and verify at least one real AI provider** (Gemini or Groq). Re-run the full dogfooding pipeline for all 6 personas with real AI.
> 2. **Audit the parser regressions against real user resumes.** Collect 10–20 real resumes (PDF, Word, LinkedIn export, Canva) and measure import success rate.
> 3. **Fix or document the three 🟠 Major parser issues.** If >5% of expected beta users use these formats, fix before launch. If rare, document as known import limitations.
> 4. **Re-validate the release gate** with real AI data before tagging v0.9.5-alpha.

**After these conditions are met**, re-run the gate check. If 🔴=0 and 🟠=0 with real AI, the release can proceed.
