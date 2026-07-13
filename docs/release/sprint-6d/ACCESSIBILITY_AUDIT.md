# Accessibility Audit

- Date/time: 2026-07-13T09:52:00Z
- Environment: local dev server
- Commands run:
  - npx playwright test tests/mobile-qa.spec.ts --project=mobile
  - npm run lint

## Results

- Keyboard-only navigation: partially covered by Playwright role-based navigation; not fully signed off.
- Visible focus: not fully audited manually.
- Form labels: mobile auth forms and builder labels exercised; one E2E selector mismatch found for renamed "File name" label.
- Modal focus trapping: not fully audited in this run.
- Screen-reader names: Playwright role selectors passed for auth, billing, and mobile routes; not exhaustive.
- Contrast: not fully audited with tooling in this run.
- Reduced motion: not fully audited in this run.
- Error announcements: registration rate-limit alert observed and announced as alert in Playwright snapshot.

## Failures Found

- npm run lint failed on existing React hook lint errors in dashboard rename/list components.
- Mobile tap targets were initially below 44px for Dashboard, Privacy, and Terms.

## Fixes Applied

- Fixed home-page Dashboard, Privacy, and Terms tap targets.

## Remaining Known Issues

- Accessibility audit is not complete enough for signoff until lint errors are fixed and keyboard/modal/contrast/reduced-motion checks are completed.
