# Dogfooding Report — v0.9.5-alpha

**Date:** 2026-07-06

**Tester:** [Name]

**Environment:** [Local / Staging / Production]

**Release Gate Status:** ❌ NOT MET (until all 6 personas complete)

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
- Matched skills list is correct (e.g., Java ≠ JavaScript, Go ≠ Google)
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
**Action:** Apply 1–2 individual suggestions, then "Apply All".
**Expected:**
- Individual apply updates only the targeted section
- "Apply All" updates all targeted sections in a single operation
- No content is lost from unrelated sections
- Apply completes without error

### 8. Edit Manually
**Action:** Manually edit 1–2 sections (edit summary text, reorder experience bullets).
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

| Persona | Import | Preview | Analyze | Tailor | Apply | Edit | Cover Letter | Save/Reload | Export PDF | Billing | Issues |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Junior Frontend Developer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Senior Backend Engineer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| WordPress Developer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Marketing Specialist | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Graphic Designer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Customer Support Specialist | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

**Pipeline check (automated):** 6/6 ✅

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

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
| Triggered? | | |
| Provider used (Gemini/Groq)? | | |
| Groq fallback triggered? | | |
| All sections recovered? | | |
| No hallucinations? | | |
| No duplicated entries? | | |

### Log
| Step | Result | Issues | Severity |
|---|---|---|---|
| Import Resume | ⬜ | | |
| Preview vs Import | ⬜ | | |
| Analyze Resume | ⬜ | | |
| Paste Job Description | ⬜ | | |
| AI Tailor | ⬜ | | |
| Review Suggestions | ⬜ | | |
| Apply Changes (individual + all) | ⬜ | | |
| Edit Manually | ⬜ | | |
| Generate Cover Letter | ⬜ | | |
| Save & Reload | ⬜ | | |
| Export PDF | ⬜ | | |
| Verify Billing | ⬜ | | |

### Issues Found

| # | Description | Severity | Steps to Reproduce |
|---|---|---|---|
| — | | | |

---

## Regression Tests

Known problematic formats that have caused issues in previous releases.

### R1 — 3-Line Experience Format

**Format:** Bare dates/role/company with no bullet points
```
Jun 2021 - Present | Senior Developer | Acme Corp
Jan 2019 - May 2021 | Developer | Beta Inc
```

**Expected:**
- Both entries parsed with correct dates, roles, and companies
- No orphaned text or parsing errors

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

### R4 — References-Only Resume

**Format:** Resume with heavy references section, minimal other content
```
Available upon request.

References:
John Smith — Senior Developer, Acme Corp — john@acme.com
Jane Doe — Engineering Manager, Beta Inc — jane@beta.com
```

**Expected:**
- Does not hallucinate references as experience entries
- No fabricated credentials from reference descriptions
- Minimal content handled gracefully

### R5 — LinkedIn Export Format

**Format:** LinkedIn-style format with colons, summary blocks, and specific date formatting
```
React, TypeScript, Node.js — Frontend Developer
Spearheaded migration of legacy codebase to React 18

Skills: React, TypeScript, Node.js, GraphQL, PostgreSQL
Languages: English (Native), Spanish (Professional)
```

**Expected:**
- LinkedIn-style sections parsed correctly
- "Languages" not confused with programming skills
- Colon-separated formats handled

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

### R7 — Resume with Tables

**Format:** Common self-assessment tables
```
Technical Skills

Category       | Skills
Frontend       | React, TypeScript, Tailwind CSS
Backend        | Node.js, Python, PostgreSQL
DevOps         | Docker, AWS, CI/CD

Soft Skills

Communication  | Team leadership, Client presentations, Technical writing
Management     | Agile/Scrum, Project planning, Mentoring
```

**Expected:**
- Table rows parsed as skills (not treated as experience or random text)
- Categories preserved or intelligently grouped
- Pipe-separated content not corrupted
- Soft skills not discarded

### Regression Results

| # | Test | Result | Issues | Severity |
|---|---|---|---|---|
| R1 | 3-Line Experience | ⬜ | | |
| R2 | Bullet Certifications | ⬜ | | |
| R3 | Skills Before Experience | ⬜ | | |
| R4 | References-Only | ⬜ | | |
| R5 | LinkedIn Export | ⬜ | | |
| R6 | Minimal Resume | ⬜ | | |
| R7 | Resume with Tables | ⬜ | | |

---

## Personal Stress Test

After all personas pass, re-import my own resume (the one used in previous sprint testing). It's the most complex fixture and the strongest regression detector.

**Expected:**
- All sections survive import
- AI recovery does not introduce hallucinations
- Resume health scores are reasonable
- Tailoring suggestions reference real content
- Apply All preserves unrelated sections
- Cover letter references real credentials
- Save → Reload → Export produces identical output

---

## Issue Tracker

### 🔴 Critical (0 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| | | | | |

### 🟠 Major (0 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| | | | | |

### 🟡 Minor (0 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| | | | | |

### 🔵 Enhancement (0 issues)

| # | Description | Persona | Steps to Reproduce | Status |
|---|---|---|---|---|
| | | | | |

---

## Release Gate Check

| Severity | Current | Limit | Status |
|---|---|---|---|
| 🔴 Critical | 0 | 0 | ✅ |
| 🟠 Major | 0 | 0 | ✅ |
| 🟡 Minor | 0 | ≤5 | ✅ |
| 🔵 Enhancement | 0 | Unlimited | ✅ |

**Gate verdict:** ⬜ PENDING (complete all 6 persona walkthroughs first)
