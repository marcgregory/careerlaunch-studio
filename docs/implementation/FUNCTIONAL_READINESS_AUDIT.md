# Functional Readiness Audit

Last updated: 2026-07-13

Status: Not Product Complete. The repository is CareerLaunch Studio, not the fleet/estates/devices application described in the incoming checklist. This audit covers the actual app surface present in this workspace.

## Audited Surface

- Public pages: home, login, register, forgot/reset password, verify email, privacy, terms, billing.
- Dashboard: summary stats, resume list, search/sort/filter, rename, duplicate, export, delete, empty states, mobile header actions.
- Builder: autosave, validation, reset, section ordering, item add/edit/delete/reorder, templates, preview, PDF export.
- AI workflows: health analysis, suggestions, diff review/apply, tailoring, job match, gap analysis, feedback/event logging.
- Cover letters: load, generate, edit/save, export.
- Billing/account: plan cards, checkout preview, subscription status, customer portal, scheduled downgrade.
- Backend/database: auth, resume CRUD, export jobs, subscription gates, suggestion events/feedback, cover letters.

## Issues Fixed This Pass

1. Duplicate bypassed resume limits.
   - Root cause: duplicate route did not check `FeatureKeys.RESUME_LIMIT`.
   - Type: Backend / business logic.
   - Fix: duplicate route now enforces the same entitlement as create.
   - Verification: new route tests cover limit rejection, ownership 404, and successful duplicate persistence.

2. Duplicate stored source resume body metadata.
   - Root cause: `toStoredResume(originalResume)` was reused directly for the new row and version.
   - Type: Backend / database consistency.
   - Fix: duplicate route now stores a duplicate payload with duplicate title and placeholder body id; response id is still resolved from the created DB row.
   - Verification: route test asserts stored duplicate body/version data.

3. Registration blocked legitimate repeated/shared-IP signups.
   - Root cause: 3/hour IP-only registration bucket was too strict for shared networks and parallel browser verification.
   - Type: Backend / business logic.
   - Fix: shared-IP bucket raised and per-email throttling retained for targeted abuse control.
   - Verification: E2E registration cascade improved from 22 failures to 18 before remaining unrelated/mobile issues.

4. Mobile dashboard actions lacked accessible names.
   - Root cause: labels were hidden at mobile breakpoints without `aria-label` fallbacks.
   - Type: Frontend / accessibility.
   - Fix: added labels to Sign out, Import, and New resume.
   - Verification: lint/build pending after final edit; Playwright mobile resume flows should be rerun.

## Remaining Failures

- Full Playwright E2E is still failing. Current failures include mobile registration cascades from repeated local rate-limit state, mobile dashboard action discovery before the aria-label fix is rerun, billing tests waiting for `networkidle` in dev mode, one intermittent `ECONNRESET` during parallel PDF flow, and suggestion-review tests that sometimes produce no pending automatic suggestions.
- The product should not be marked complete until those E2E failures are either fixed in implementation or corrected where the test is asserting the wrong behavior.

## Verification Log

- `npm run test`: passed, 426 total tests after duplicate route coverage.
- `npm run lint`: passed.
- `npm run build`: passed with non-blocking Sentry configuration warnings.
- `npm run test:e2e`: failed, 38 passed / 18 failed on the latest full run before final accessibility rerun.
