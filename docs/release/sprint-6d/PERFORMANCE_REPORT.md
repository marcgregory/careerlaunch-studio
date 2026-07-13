# Performance Report

- Date/time: 2026-07-13T10:37:42Z
- Environment: local dev server, real Groq AI provider
- Commands run:
  - `npm run eval:benchmark`
  - `npx playwright test tests/resume-flow.spec.ts --project=chromium --workers=1`

## AI Latency Results

- Benchmark provider/model: Groq / llama-3.1-8b-instant
- Total personas: 6
- Average provider latency: 9398ms
- P50 provider latency: 10858ms
- P95 provider latency: 13969ms
- JSON validity: 100%
- Schema pass rate: 100%
- Prompt failure rate: 0%
- Overall pass: true

## App Timing Observations

- Resume-flow serial suite: 6 passed in 51.0s.
- First PDF export path: passed.
- Cached/repeated PDF export path: passed.
- Per-template PDF export path: passed for modern, executive, minimal, and ATS templates.
- Template visual snapshots regenerated for the current renderer output and pass under Chromium.

## Remaining Known Issues

- No dedicated scroll-performance trace was captured in this run.