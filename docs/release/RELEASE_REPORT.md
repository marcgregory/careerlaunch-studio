# CareerLaunch Studio v0.9.5-alpha — Release Report

**Date:** 2026-07-06

**Status:** ❌ NOT READY — blocking conditions not met

---

## Summary

```
CareerLaunch Studio v0.9.5-alpha — Full Dogfooding Audit (2026-07-06)

AI benchmark:    ✅ PASS (deterministic — real AI untested)
Dogfooding:      6/6 personas ✅ (API pipeline)
Error Recovery:  ✅ PASS (8/8 scenarios)
Tests:           328/328 ✅ (all unit/integration)
Build:           ✅ passes
Accessibility:   ⬜ NOT RUN (requires browser)
Performance:     ⬜ NOT RUN (requires browser)
Mobile QA:       ⬜ NOT RUN (requires browser)

Known issues:
  🔴 Critical   1 — No real AI provider configured
  🟠 Major      3 — Parser regressions on common formats
  🟡 Minor      2 — Parser edge cases (low frequency)
  🔵 Enhancement 6 — Including free-tier tailoring gate (by design)

Release gate:    ❌ NOT MET — provider + parser regressions block
```

---

## Phase Status

| Phase | Status | Result |
|---|---|---|
| 1 — Dogfooding | 🟡 Partial (API ✅, AI provider missing) | 6/6 pipeline pass (MockProvider) |
| 2 — AI Benchmark | ✅ PASS (deterministic) | All targets met on mock data |
| 3 — Error Recovery | ✅ PASS | 8/8 scenarios pass |
| 4 — Mobile QA | ⬜ Not Run | Template created |
| 5 — Accessibility | ⬜ Not Run | Template created |
| 6 — Performance | ⬜ Not Run | Template created |
| 7 — Closed Beta Checklist | ⬜ Not Run | Requires deployment |

---

## Detailed Results

### Dogfooding — 6 Personas

All 6 personas ran the complete API pipeline (register → import → create → analyze → edit → cover letter → save/reload → export PDF → billing). Results:

| Persona | Import | Analyze | Edit | Cover Letter | Export PDF | Billing |
|---|---|---|---|---|---|---|
| Jenna Martinez (Frontend) | ✅ | ✅ 225ms | ✅ | ✅ 87ms | ✅ 1.8s | ✅ |
| Marcus Williams (Backend) | ✅ | ✅ 178ms | ✅ | ✅ 41ms | ✅ 2.1s | ✅ |
| Sophia Rivera (WordPress) | ✅ | ✅ 195ms | ✅ | ✅ 51ms | ✅ 1.9s | ✅ |
| Olivia Chen (Marketing) | ✅ | ✅ 196ms | ✅ | ✅ 53ms | ✅ 1.8s | ✅ |
| Aiden Park (Designer) | ✅ | ✅ 203ms | ✅ | ✅ 41ms | ✅ 1.8s | ✅ |
| Emma Thompson (Support) | ✅ | ✅ 185ms | ✅ | ✅ 46ms | ✅ 1.8s | ✅ |

**⚠️ All AI operations used MockProvider.** Tailoring returns 403 on free tier (by design).

### AI Benchmark (Deterministic)

| Metric | Result | Target | Status |
|---|---|---|---|
| JSON validity | 100.0% | ≥99% | ✅ |
| Schema validation pass rate | 100.0% | ≥90% | ✅ |
| Prompt failure rate | 0.0% | ≤2% | ✅ |
| Fabricated experience rate | 0.0% | <1% | ✅ |
| Score consistency (stddev) | σ=0.00 | <5 | ✅ |

**Note:** These results are from MockProvider. Real AI performance will show meaningful variance and requires separate benchmarking.

### Error Recovery

| Scenario | Result | Detail |
|---|---|---|
| Provider timeout | ✅ | CostLimitError with friendly "Timed out" message |
| Invalid JSON response | ✅ | Returns default values (graceful degradation) |
| Empty response | ✅ | Returns default values (graceful degradation) |
| Rate limit (429) | ✅ | 3 retry attempts, then graceful failure |
| Provider unavailable | ✅ | Clear "not registered" error message |
| Quota exceeded | ✅ | Budget check returns `allowed: false` correctly |
| Network disconnect | ✅ | Mock provider fallback activates |
| CostLimitError | ✅ | Properly instantiable, catchable, and identifiable |

### Regression Tests (7 Edge-Case Formats)

| Test | Result | Severity | Impact |
|---|---|---|---|
| R1: 3-Line Pipe Experience | ❌ FAIL | 🟠 Major | Common format — all experience lost |
| R2: Bullet Certifications | ❌ FAIL | 🟡 Minor | Content preserved, misclassified |
| R3: Skills Before Experience | ❌ FAIL | 🟠 Major | Common format — 0 experiences, quality metric misleading |
| R4: References-Only | ✅ PASS | — | Correctly handled |
| R5: LinkedIn Export | ✅ PASS | — | Correctly handled |
| R6: Minimal Resume | ❌ FAIL | 🟡 Minor | Rare edge case |
| R7: Table-Formatted Resume | ❌ FAIL | 🟠 Major | Word exports — all experience lost |

### Regression Tests

- AI: 274/274 ✅
- Web: 41/41 ✅
- Domain: 13/13 ✅
- **Total: 328/328 ✅**

---

## Release Gate Check

```
Severity        Current     Limit       Status
🔴 Critical     1           0           ❌ No real AI provider
🟠 Major        3           0           ❌ 3 parser regressions
🟡 Minor        2           ≤5          ✅
🔵 Enhancement  6           ∞           ✅
```

---

## Recommendation

🟡 **Conditional Go — Not Ready to Tag**

**Engineering quality is strong.** The codebase is well-tested (328 passing tests), error recovery handles all 8 failure modes gracefully, and the core persona workflows complete end-to-end.

**But the release gate is not met** for two reasons:

### 1. 🔴 No real AI provider configured (P0)

Both `GEMINI_API_KEY` and `GROQ_API_KEY` are blank. Every AI operation ran against MockProvider. The product's core value proposition — AI analysis, tailoring, recovery, and cover letter generation — has not been validated with actual model output. This is the highest-priority item before any beta launch.

### 2. 🟠 Three parser regressions on common formats (R1, R3, R7)

Pipe-separated experience, skills-before-experience ordering, and table-formatted resumes are all common formats that lose **all experience entries** on import. These block the release gate because they represent real user workflows that would fail.

### Pre-Beta Checklist

Before tagging v0.9.5-alpha:

- [ ] **Configure a real AI provider** — set `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env`
- [ ] **Re-validate with real AI** — re-run dogfooding pipeline for all 6 personas
- [ ] **Audit parser against real resumes** — collect 10–20 real-world resumes (not team-created), measure import success rate
- [ ] **Fix or explicitly document** the 3 🟠 Major parser issues based on real-world frequency
- [ ] **Re-run release gate** — verify 🔴=0, 🟠=0
- [ ] **Complete browser-based QA** — mobile, accessibility, performance (optional for alpha)
- [ ] **Complete closed beta checklist** — deployment, Stripe, documentation

---

## Artifacts

| Deliverable | Path | Status |
|---|---|---|
| Dogfooding Report | `docs/release/DOGFOODING_REPORT.md` | ✅ Full report |
| AI Benchmark Report | `docs/release/BENCHMARK_REPORT.json` | ✅ Generated |
| Error Recovery Tests | `scripts/eval/error-recovery.ts` | ✅ Created |
| Dogfooding Pipeline Script | `scripts/eval/dogfooding/run-per-persona.ts` | ✅ Created |
| Regression Suite | `scripts/eval/dogfooding/regression-suite.ts` | ✅ Created |
| Mobile QA Report | `docs/release/MOBILE_QA_REPORT.md` | 🟡 Template |
| Accessibility Audit | `docs/release/ACCESSIBILITY_AUDIT.md` | 🟡 Template |
| Performance Report | `docs/release/PERFORMANCE_REPORT.md` | 🟡 Template |
| Known Issues | `docs/release/KNOWN_ISSUES.md` | ✅ Updated |
| Release Report | `docs/release/RELEASE_REPORT.md` | ✅ This file |
