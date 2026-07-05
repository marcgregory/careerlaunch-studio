# Sprint 6D — Beta Hardening & Release Candidate (v0.9.5)

**Goal:** Validate that CareerLaunch Studio is ready for a closed beta with real users.

**Version:** `v0.9.5-alpha`

**Duration:** 1 sprint

**Golden Rule:** No new features. Only bug fixes, UX improvements, performance, accessibility, reliability, and documentation.

---

## Phase 1 — Dogfooding Test Matrix

Run the full workflow for each persona. Identify UX friction, crashes, layout issues, and AI quality problems before real users see them.

**Important:** This is a repeatable QA process. Every release candidate passes through the exact same personas and workflow.

### Personas (Fixed)

All six personas are fixed. Every release candidate tests the same profiles.

| # | Persona | Skills | Experience | Target Jobs | Key Sections to Test |
|---|---|---|---|---|---|
| 1 | **Junior Frontend Developer** | React, TypeScript, Tailwind | 1–2 years | React Developer, Frontend Engineer | Summary, Skills, Education, Projects |
| 2 | **Senior Backend Engineer** | Go, Node.js, PostgreSQL, AWS | 5+ years | Senior Backend Engineer | Summary, Experience, Skills, Certifications |
| 3 | **WordPress Developer** | PHP, Elementor, WooCommerce | 3+ years | WordPress Developer | Summary, Experience, Skills, Portfolio links |
| 4 | **Marketing Specialist** | SEO, Google Ads, Meta Ads | 3+ years | Marketing Manager | Summary, Experience, Skills, Metrics |
| 5 | **Graphic Designer** | Figma, Adobe Creative Suite | 2+ years | Visual Designer | Summary, Experience, Skills, Portfolio |
| 6 | **Customer Support** | Zendesk, CRM, Phone support | 2+ years | Support Specialist | Summary, Experience, Skills, Education |

### Workflow (Rigid — No Shortcuts)

Every persona follows this exact sequence:

```
Import Resume
        ↓
Analyze Resume
        ↓
Paste Job Description
        ↓
AI Tailor
        ↓
Review Suggestions
        ↓
Apply Changes
        ↓
Generate Cover Letter
        ↓
Export PDF
        ↓
Verify Billing
```

### Logging Requirements

During every step, log the following:

| Category | What to Log |
|---|---|
| **AI latency** | Time from request submission to response received |
| **Visual bugs** | Layout shifts, overlapping elements, misaligned text, broken colors |
| **Validation failures** | Forms rejecting valid input, fields losing data, incorrect error messages |
| **Prompt failures** | AI returning empty response, refusal, irrelevant content, or broken JSON |
| **Wrong suggestions** | AI suggesting facts not in the original resume |
| **UI glitches** | Buttons not responding, panels not closing, scroll issues, flickering |
| **Export issues** | PDF rendering broken, missing content, formatting errors, watermark issues |

### Severity Labels

Every bug gets exactly one severity label. No "maybe."

| Label | Definition | Must Fix Before Release? |
|---|---|---|
| **Critical** | App crashes, data loss, core flow broken, AI hallucinates credentials | Yes |
| **High** | Feature unusable, wrong output, wrong PDF content | Yes |
| **Medium** | Feature works but has clear UX problems, misleading UI, incorrect formatting | ≤5 allowed |
| **Low** | Cosmetic issues, edge cases, minor copy, minor layout quirks | Unlimited |

### Release Gate

A release may not be tagged unless:

```
Critical bugs:  0
High bugs:     0
Medium bugs:   ≤5
Low bugs:      unlimited
```

### Deliverable

- `docs/release/DOGFOODING_REPORT.md` — one section per persona, noting all issues found with severity labels

---

## Phase 2 — AI Benchmark

Build a repeatable benchmark suite that measures AI quality objectively.

### Benchmark Dataset

| Data | Count | Source |
|---|---|---|
| Resumes | 50 | 10 per persona (synthetic, covering different experience levels) |
| Job descriptions | 50 | Real public JDs, anonymized |

### Metrics Collected

| Metric | Method |
|---|---|
| Match score consistency | Run analysis 3× on same resume+JD — measure stddev |
| JSON validity | % of AI responses that parse as valid structured output |
| Schema validation pass rate | % of parsed responses that pass `validate*.ts` checks |
| Prompt failure rate | % of calls that return empty/refusal/error |
| Average latency per dimension | Timed per ATS/Grammar/Impact/Keywords/Summary/Tone |
| Suggestion acceptance simulation | Heuristic: does the AI suggest changes that match known gaps? |
| Fabricated experience rate | % of suggestions introducing data not in the original resume |

### Acceptance Criteria

- [ ] ≥99% valid structured output across all runs
- [ ] ≥90% schema validation pass rate
- [ ] <1% fabricated experience rate (anything introducing new dates, companies, or credentials)
- [ ] Prompt failure rate ≤2%
- [ ] Stable results across repeated runs (match score stddev <5 points)
- [ ] Benchmark report generated automatically via `npm run eval:benchmark`

### Deliverable

- `scripts/eval/benchmark/` — runner scripts and fixture files
- Benchmark report output (JSON + summary table)

---

## Phase 3 — Error Recovery

Test every failure mode the AI providers can throw at the system.

### Failure Scenarios

| Scenario | How to Trigger | Expected Behavior |
|---|---|---|
| Gemini quota exceeded | Set low rate limit / use exhausted key | Friendly error message, no crash |
| Groq timeout | Set `GROQ_TIMEOUT_MS=1` | Graceful timeout handling, falls back |
| Invalid JSON from provider | Inject malformed response at provider boundary | Validation catches it, returns lowered confidence |
| Provider unavailable | Unset API key / wrong endpoint | Mock fallback (where appropriate), clear error |
| Slow response | Inject artificial delay (e.g., `delay: 30000`) | Client-side timeout, user sees "taking longer than expected" |
| Network disconnect | Kill network mid-request | No corrupted resume state, retry or graceful failure |
| Empty response from provider | Return empty string | Treated as failure, falls to deterministic fallback |
| Rate limit (429) | Hammer the endpoint | Retry with backoff, then graceful degradation |

### Acceptance Criteria

- [ ] Every failure mode produces a friendly user-visible error (no raw stack traces)
- [ ] Zero uncaught exceptions logged to Sentry for these scenarios
- [ ] Mock fallback activates where appropriate (analysis, cover letter, job match)
- [ ] No corrupted resume or draft state after any failure
- [ ] Error recovery tests are automated in `scripts/eval/error-recovery.ts`

### Deliverable

- `scripts/eval/error-recovery.ts` — automated error injection runner
- Error recovery test results

---

## Phase 4 — Mobile QA

Verify the application is usable on mobile viewports. Not mobile-optimized, but not broken.

### Screens to Verify

| Screen | Key Checks |
|---|---|
| Login / Register | Form fits viewport, no horizontal scroll |
| Dashboard | Resume cards stack, CTAs tap-able |
| Resume Builder | Sections collapse, inputs don't overflow, toolbar accessible |
| AI Tailoring Panel | Suggestion cards readable, buttons tappable, diff view usable |
| Cover Letter Builder | Editor fits, preview scrollable |
| Billing/Pricing | Plan comparison readable, CTA buttons tappable |
| Account/Billing | Subscription info readable |
| Export | Download button works |

### Acceptance Criteria

- [ ] No content overflow or horizontal scroll on 375px viewport
- [ ] All primary CTAs are tappable (min 44×44px tap target)
- [ ] Forms are fillable (inputs don't zoom unnecessarily)
- [ ] Critical flows remain functional (login → builder → AI → export)
- [ ] Navigation (sidebar/hamburger) operable

### Deliverable

- `docs/release/MOBILE_QA_REPORT.md` — screenshots and findings per screen

---

## Phase 5 — Accessibility Audit

Audit against WCAG 2.1 AA criteria using keyboard-only navigation.

### Areas to Audit

| Area | Key Checks |
|---|---|
| Navigation | Sidebar links, skip-to-content, breadcrumbs |
| Resume Builder | Add/remove/reorder sections, autosave indicators |
| AI Suggestions | Accept/dismiss buttons, feedback 👍/👎, confidence bar |
| Diff View | Before/after comparison keyboard operable |
| Billing | Plan selection, upgrade CTA, portal link |
| Export | Download button, format selection |
| Dialogs | Focus trap, close with Escape, return focus on close |
| Forms | Label associations, error announcements |

### Keyboard Testing Protocol

1. Start at page load
2. Tab through every interactive element
3. Verify focus indicator is always visible
4. Verify all actions are available without a mouse
5. Test with a screen reader (NVDA or VoiceOver) on key flows

### Acceptance Criteria

- [ ] Visible focus indicators on all interactive elements (minimum 2:1 contrast ratio against background)
- [ ] Logical tab order follows visual reading order
- [ ] All controls keyboard-operable (Enter/Space for buttons, Arrow keys for lists)
- [ ] No keyboard traps (focus never gets stuck in a widget)
- [ ] Screen reader identifies key actions: "Apply suggestion", "Dismiss", "Export PDF"
- [ ] All error messages are announced
- [ ] Dialogs trap focus and return it on close

### Deliverable

- `docs/release/ACCESSIBILITY_AUDIT.md` — findings, violations, and fixes applied

---

## Phase 6 — Performance

Measure before optimizing. Define pass/fail thresholds, then fix what's over budget.

### Metrics to Measure

| Metric | How to Measure | P95 Target |
|---|---|---|
| Builder initial load (TTI) | DevTools Performance panel, fresh load | <2s |
| AI analysis latency (full review) | `durationMs` from `AnalysisRun` table | <5s |
| AI analysis latency (single dimension) | `durationMs` from `AnalysisRun` table | <2s |
| Resume save (autosave) | Network tab, PUT completion | <500ms |
| PDF export (time to download) | `GET /api/export/pdf` response time | <10s |
| Cover letter PDF export | `GET /api/cover-letters/:id/pdf` response time | <10s |
| Billing page load | DevTools Performance panel | <1.5s |
| Dashboard load | DevTools Performance panel | <1.5s |

### Measurement Protocol

1. Record P50, P95, P99 across 10 measurements each
2. Measure on production-equivalent hardware (no throttling, no debug mode)
3. Document the measurement environment

### Acceptance Criteria

- [ ] All P95 targets met (if any are exceeded, fix before closing the sprint)
- [ ] No memory leaks detected during a 5-minute session of repeated editing
- [ ] Bundle size analyzed and documented (`next build` output)
- [ ] Unnecessary re-renders identified and fixed in builder components

### Deliverable

- [ ] `docs/release/PERFORMANCE_REPORT.md` — P50/P95/P99 table, bundle analysis, leak check results

---

## Phase 7 — Closed Beta Checklist

Before tagging `v0.9.5-alpha`, verify every operational requirement.

### Production Readiness

- [ ] Production deployment verified on target platform
- [ ] Stripe webhook endpoint configured and receiving events
- [ ] Stripe products/prices created and `STRIPE_PROFESSIONAL_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID` set
- [ ] `STRIPE_WEBHOOK_SECRET` configured
- [ ] Sentry error monitoring receiving events
- [ ] PostHog product analytics events verified
- [ ] `GET /api/health` returns green (app, renderer, database)
- [ ] Database backups configured and tested (restore verified)
- [ ] Rate limiting active on high-risk routes
- [ ] CORS and CSP headers reviewed

### Infrastructure

- [ ] Production PostgreSQL provisioned and `DATABASE_URL` configured
- [ ] Initial Prisma migration applied to staging and production
- [ ] PDF renderer service deployed and accessible
- [ ] Environment variables documented in deployment runbook
- [ ] `.env.example` is up-to-date

### Beta Logistics

- [ ] Beta user onboarding documented (invite flow, expected setup)
- [ ] Support channel defined (email, in-app, or Discord)
- [ ] Known issues list published for beta testers
- [ ] Feedback collection mechanism in place (in-app feedback + PostHog)
- [ ] Rollback plan documented

### Legal & Compliance

- [ ] Privacy policy reviewed
- [ ] Terms of service reviewed
- [ ] Cookie notice implemented (if analytics cookies are used)
- [ ] GDPR/CCPA compliance checked

### Documentation

- [ ] `CHANGELOG.md` finalized for v0.9.5
- [ ] `ROADMAP.md` updated
- [ ] `PROJECT_STATUS.md` updated
- [ ] Release notes drafted
- [ ] Deployment runbook up to date

### Acceptance Criteria

- [ ] All items checked before tagging `v0.9.5-alpha`

### Deliverable

- `v0.9.5-alpha` git tag
- Release notes
- Go/No-Go recommendation for closed beta

---

## Deliverables Summary

| Deliverable | Location | Format |
|---|---|---|
| QA Report | `docs/release/DOGFOODING_REPORT.md` | Markdown |
| AI Benchmark Report | `scripts/eval/benchmark/` + JSON output | Script + JSON |
| Error Recovery Tests | `scripts/eval/error-recovery.ts` | TypeScript |
| Mobile QA Report | `docs/release/MOBILE_QA_REPORT.md` | Markdown |
| Accessibility Audit | `docs/release/ACCESSIBILITY_AUDIT.md` | Markdown |
| Performance Report | `docs/release/PERFORMANCE_REPORT.md` | Markdown |
| Known Issues List | `docs/release/KNOWN_ISSUES.md` | Markdown |
| Git Tag | `v0.9.5-alpha` | Git |
| Go/No-Go Recommendation | Sprint close | Verbal or written |

---

---

## Release Report Format

After all phases complete, generate a single-page summary. This becomes a repeatable artifact for every future release (`v0.9.5`, `v1.0.0-beta`, `v1.0.0`, etc.).

```text
CareerLaunch Studio v0.9.5-alpha

AI benchmark:    PASS / FAIL / NOT RUN
Dogfooding:      6/6 personas (or X/6)
Accessibility:   PASS / FAIL / NOT RUN
Performance:     PASS / FAIL / NOT RUN
Regression:      X/Y tests passing
Known issues:    X Critical, Y High, Z Medium, W Low

Recommendation:

✅ Ready for Closed Beta
or
❌ Not ready — see blocking issues below
```

### Acceptance Criteria

- [ ] Release report generated and added to `docs/release/RELEASE_REPORT.md`
- [ ] Go/No-Go decision documented with rationale

---

## Definition of Done

- [ ] All 7 phases have acceptance criteria met or explicitly waived with rationale
- [ ] No new features were introduced during the sprint
- [ ] All acceptance criteria checkboxes are checked for Phase 7 (Closed Beta Checklist)
- [ ] Git tag `v0.9.5-alpha` created
- [ ] TypeScript, lint, unit tests, integration tests, and E2E tests pass
- [ ] `ROADMAP.md`, `CHANGELOG.md`, and `PROJECT_STATUS.md` are updated
