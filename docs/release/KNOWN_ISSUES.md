# Known Issues — v0.9.5-alpha

**Last updated:** 2026-07-06

---

## Release Gate

| Severity | Count | Limit | Status |
|---|---|---|---|
| 🔴 Critical | 1 | 0 | ❌ No real AI provider configured |
| 🟠 Major | 3 | 0 | ❌ Parser regressions on common formats |
| 🟡 Minor | 2 | ≤5 | ✅ |
| 🔵 Enhancement | 6 | Unlimited | ✅ |

---

## 🔴 Critical

| ID | Title | Area | Impact | Workaround |
|---|---|---|---|---|
| P0 | No real AI provider configured | AI | All AI features run against MockProvider — actual model quality, latency, and hallucination behavior unknown | Configure `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env` |

---

## 🟠 Major

| ID | Title | Area | Impact | Workaround |
|---|---|---|---|---|
| R1 | Pipe-separated experience not parsed | Import Parser | Resumes formatted as `Date \| Role \| Company` lose all experience entries on import | Paste experience in standard bullet-point format before importing |
| R3 | Skills-before-experience order breaks parser | Import Parser | When Skills section appears before Experience, zero experience entries are detected. Import quality reports "excellent" despite this — misleading. | Reorder resume to place Experience before Skills before importing |
| R7 | Table-formatted resumes lose experience | Import Parser | Microsoft Word exports with pipe/category tables lose all experience entries (skills are captured correctly) | Remove table formatting from the Word export before pasting |

---

## 🟡 Minor

| ID | Title | Area | Impact | Workaround |
|---|---|---|---|---|
| R2 | Bullet certifications under Education not classified | Import Parser | Certifications listed as bullet points under Education are not recognized as certifications (content preserved as skills) | List certifications in a separate section |
| R6 | Minimal resumes import as "failed" | Import Parser | Resumes shorter than ~4 lines with minimal structure fail to parse | Add more structure (dates, bullet points) before importing |

---

## 🔵 Enhancements

| ID | Title | Area | Notes |
|---|---|---|---|
| E1 | Tailoring gated behind Professional plan | Entitlements | By design — `run_job_match: false` for free tier |
| E2-E6 | Various parser improvements | Import Parser | All related to non-standard resume formats (see R1, R2, R3, R6, R7 above) |

---

## Pre-Beta Checklist

Before tagging v0.9.5-alpha:

- [ ] Configure a real AI provider (Gemini or Groq)
- [ ] Verify all 6 persona workflows pass with real AI (analysis, tailoring, cover letter)
- [ ] Assess parser regression frequency against real user data
- [ ] Decide: fix 🟠 Major parser issues vs. document as known limitations
- [ ] Re-run release gate: 🔴=0, 🟠=0
