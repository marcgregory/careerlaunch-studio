# Accessibility Audit

- Date/time: 2026-07-13T10:37:42Z
- Environment: local dev server
- Commands run:
  - `npm run lint`
  - `npx playwright test tests/resume-flow.spec.ts --project=chromium --workers=1`
  - Prior Sprint 6D mobile run: `npx playwright test tests/mobile-qa.spec.ts --project=mobile`

## Results

- Lint accessibility/hook gate: passed with zero warnings.
- Form labels: builder E2E now uses the current accessible `File name` label; auth and builder form labels are exercised through Playwright label selectors.
- Screen-reader names: resume-flow uses role/link/button selectors for protected redirects, dashboard navigation, template controls, and export actions.
- Error announcements: registration throttling is no longer hidden by retries; the E2E helper explicitly fails on unexpected 429 responses.
- Mobile QA: prior Sprint 6D mobile report remains 11/11 passing.

## Fixes Applied

- Removed synchronous setState-in-effect hook violations in dashboard components.
- Fixed missing hook dependencies for analytics callbacks/effects.
- Replaced stale `Resume title` E2E selectors with the current `File name` label.
- Preserved deterministic rate-limit behavior in E2E setup with isolated registration keys.

## Remaining Manual Audit Scope

- Full keyboard-only traversal, modal focus trapping, contrast tooling, and reduced-motion checks are not exhaustively documented here and should be completed before public launch.