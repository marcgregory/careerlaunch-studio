# Performance Report

- Date/time: 2026-07-13T09:52:00Z
- Environment: local dev server, real Groq AI provider
- Commands run:
  - npm run eval:benchmark
  - npx playwright test tests/mobile-qa.spec.ts --project=mobile
  - npx playwright test tests/resume-flow.spec.ts --project=chromium --workers=1

## AI Latency Results

- Benchmark provider/model: Groq / llama-3.1-8b-instant
- Average provider latency: 9014ms
- P50 provider latency: 10846ms
- P95 provider latency: 13153ms
- Prompt failure rate: 0%

## App Timing Observations

- Mobile QA suite: 11 tests passed in 18.5s.
- Billing checkout-mock suite: 4 tests passed in 11.9s.
- Resume-flow serial suite: 3 passed, 3 failed in 1.0m.
- First PDF export path: passed in resume-flow.
- Cached/repeated PDF export path: passed in resume-flow.

## Remaining Known Issues

- Builder/template E2E signoff is blocked by stale selector/rate-limit failures in resume-flow.
- No dedicated scroll-performance trace was captured.
