# API Coverage

Last updated: 2026-07-13

## Current API Surface

- Auth: register, login, logout, forgot-password, reset-password, verify-email, resend-verification.
- Billing: subscription, checkout, portal, preview-upgrade, schedule-downgrade, subscription-change, webhook.
- Resumes: list/create, read/update/delete/rename, duplicate, analyze, tailor, job-match, gap-analysis.
- Suggestions: apply, apply-bulk, lifecycle event, feedback.
- Documents: PDF export, cover-letter CRUD/generate/export, text import.
- Operations: health, renderer keep-alive, acceptance analytics.

## 2026-07-13 Audit Updates

- Fixed `POST /api/resumes/:resumeId/duplicate` entitlement coverage. Root cause: the duplicate route created a resume without reusing the create-route resume-limit gate. Type: backend/business logic. Fix: call `can(user.id, FeatureKeys.RESUME_LIMIT)` before lookup/create and return the same upgrade payload as create.
- Fixed duplicate persistence payload. Root cause: duplicated rows stored the original resume id inside `body` and `versions.body`. Type: backend/data consistency. Fix: build a duplicate resume payload with duplicate title/target role before persistence.
- Fixed register throttling coverage. Root cause: `POST /api/auth/register` rate-limited all signups to 3/hour per shared IP, which blocks legitimate shared-network and CI/browser sessions. Type: backend/business logic. Fix: use a larger shared-IP bucket plus a stricter per-email bucket.
- Fixed mobile dashboard action accessibility. Root cause: header action text is hidden below the `sm` breakpoint, leaving icon-only controls without stable accessible names. Type: frontend/accessibility. Fix: add `aria-label` to Sign out, Import, and New resume.

## Verification

- `npm run test`: passing.
- `npm run lint`: passing.
- `npm run build`: passing.
- `npm run test:e2e`: not yet passing; remaining failures are tracked in `FUNCTIONAL_READINESS_AUDIT.md`.
