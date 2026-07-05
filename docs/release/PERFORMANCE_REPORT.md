# Performance Report — v0.9.5-alpha

**Date:** 2026-07-05

**Measurement Environment:** Local (Windows 10 Pro, Node.js 22, Next.js build)
**Hardware:** [Machine specs]

**Bundle Size (from `next build`):** 27 pages, 44s build time. No middleware detected. All routes either static (`○`) or dynamic server-rendered (`ƒ`).

**Bundle size per route:** Requires detailed next build analysis.

---

## AI Analysis Latency

| Dimension | P50 | P95 | P99 | Target (P95) | Status |
|---|---|---|---|---|---|
| Full review (all dims) | — | — | — | <5s | ⬜ |
| Single dimension | — | — | — | <2s | ⬜ |
| Cover letter generate | — | — | — | <5s | ⬜ |
| Job match | — | — | — | <3s | ⬜ |

*Note: Deterministic pipeline (no real AI provider) is sub-ms per call. AI-backed latencies require a configured provider to measure accurately.*

---

## Page Load (DevTools Performance Panel)

| Page | P50 | P95 | Target | Status |
|---|---|---|---|---|
| Builder initial load (TTI) | — | — | <2s | ⬜ |
| Dashboard | — | — | <1.5s | ⬜ |
| Billing page | — | — | <1.5s | ⬜ |
| Login | — | — | <2s | ⬜ |

---

## API Response Times

| Endpoint | P50 | P95 | Target | Status |
|---|---|---|---|---|
| Resume save (autosave) | — | — | <500ms | ⬜ |
| PDF export (resume) | — | — | <10s | ⬜ |
| PDF export (cover letter) | — | — | <10s | ⬜ |
| AI analysis | — | — | <5s | ⬜ |

---

## Memory & Bundle

### Leak Check
- [ ] No memory growth during 5-minute editing session
- [ ] No detached DOM nodes accumulating

### Bundle Size

| Chunk | Size | Notes |
|---|---|---|
| Main JS bundle | — | To be measured from `npm run build` output |
| CSS bundle | — | |
| Route: /builder | — | |
| Route: /dashboard | — | |
| Route: /billing | — | |

---

## Measurement Protocol

1. Record P50, P95, P99 across 10 measurements each
2. Measure on production-equivalent hardware (no throttling, no debug mode)
3. Use DevTools Performance panel for page loads
4. Use server logs / `durationMs` from `AnalysisRun` table for API latencies
5. Document measurement environment

---

## Issues Found

| # | Metric | Value | Target | Severity | Fix |
|---|---|---|---|---|---|
| — | | | | | |

---

## Acceptance Criteria

- [ ] All P95 targets met (if any are exceeded, fix before closing the sprint)
- [ ] No memory leaks detected during a 5-minute session of repeated editing
- [ ] Bundle size analyzed and documented (`next build` output)
- [ ] Unnecessary re-renders identified and fixed in builder components
