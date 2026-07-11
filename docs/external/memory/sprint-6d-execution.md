---
name: sprint-6d-execution
description: Sprint 6D execution state — all automated phases done, manual QA pending
metadata:
  type: project
---

# Sprint 6D Execution State

As of 2026-07-05, Sprint 6D automation infrastructure is complete. The user needs to continue with manual browser-based QA.

## Completed (Automated)

| Phase | Status |
|---|---|
| 1a — Dogfooding Pipeline | ✅ 6/6 personas pass automated analysis/gap/tailoring |
| 2 — AI Benchmark (deterministic) | ✅ All 7 metrics meet targets |
| 3 — Error Recovery | ✅ 8/8 scenarios pass gracefully |
| Eval Suite | ✅ 63/63 (fixed pre-existing bug in `scripts/eval/run.ts`) |
| Regression Tests | ✅ 223/223 |
| Build | ✅ 44s, 27 pages |

## Pending (Manual Browser QA)

| Phase | What to do | Success Criteria |
|---|---|---|
| 1b — Dogfooding UI | Walkthrough each persona: Import → Analyze → AI Tailor → Apply → Cover Letter → Export → Billing | Log all issues with severity labels (Critical/High/Medium/Low). Critical=0, High=0, Medium≤5. |
| 4 — Mobile QA | Open 375px viewport, check every screen | No horizontal scroll, 44px+ tap targets, forms usable, critical flows work |
| 5 — Accessibility | Keyboard Tab-through + screen reader (NVDA/VoiceOver) | Focus indicators, tab order, no keyboard traps, dialog focus trap |
| 6 — Performance | DevTools P50/P95/P99 for each page/endpoint | Builder TTI <2s, PDF export <10s, AI <5s, save <500ms |
| 7 — Closed Beta Checklist | Deployment, Stripe webhooks, Sentry, PostHog, docs, legal | All boxes checked before git tag |

## Fixed Bug

Pre-existing bug in `scripts/eval/run.ts`: `normalizeResume()` expects `ResumeDocument` shape (experience/education arrays) but eval fixtures are in `NormalizedResume` format (sections array). Fixed by constructing `NormalizedResume` directly. Previously all 15 original pairs silently errored.

## Key Artifacts

| Path | Purpose |
|---|---|
| `scripts/eval/dogfooding/dogfood-runner.ts` | Automated pipeline check for 6 personas |
| `scripts/eval/benchmark/benchmark-runner.ts` | 7 AI quality metrics |
| `scripts/eval/error-recovery.ts` | 8 failure scenarios |
| `scripts/eval/datasets/resumes.json` | 6 new fixtures (resume-16 to -21) |
| `scripts/eval/datasets/job-descriptions.json` | 6 matching JDs (jd-16 to -21) |
| `docs/release/DOGFOODING_REPORT.md` | Fill in browser findings |
| `docs/release/BENCHMARK_REPORT.json` | Generated benchmark data |
| `docs/release/MOBILE_QA_REPORT.md` | Fill in mobile findings |
| `docs/release/ACCESSIBILITY_AUDIT.md` | Fill in accessibility findings |
| `docs/release/PERFORMANCE_REPORT.md` | Fill in performance measurements |
| `docs/release/KNOWN_ISSUES.md` | Log all issues found |
| `docs/release/RELEASE_REPORT.md` | Summary + Go/No-Go |
| `docs/implementation/SPRINT_6D_BUILD_PLAN.md` | Updated with fixed personas, severity labels, release gate, report format |
| `docs/implementation/PROJECT_STATUS.md` | Updated with Sprint 6D progress |

## NPM Scripts

```
npm run eval             # Full eval suite (63 tests)
npm run eval:dogfooding  # Dogfooding pipeline (6 personas)
npm run eval:benchmark   # AI benchmark (6 personas × 7 metrics)
npm run eval:recovery    # Error recovery tests (8 scenarios)
npm run test             # Unit/integration tests (223)
npm run build            # Production build
```

## Release Gate Rules

- Critical bugs: 0
- High bugs: 0
- Medium bugs: ≤5
- Low bugs: unlimited

## When to Generate the Release

After all manual phases pass, update `docs/release/RELEASE_REPORT.md` and add the version tag `v0.9.5-alpha`.
