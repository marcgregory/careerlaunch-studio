# CareerLaunch Studio Release Plan

Last updated: 2026-07-03

## Release Target

MVP Preview Release after Sprint 1.

## Release Criteria

- Core resume builder flow works end to end.
- Auth and ownership checks protect user documents.
- One original template renders reliably.
- PDF export works for normal resumes.
- Resume checker returns useful feedback.
- No known critical security or data-loss bugs.

## Quality Gates

- TypeScript passes.
- Lint passes.
- Unit tests pass.
- Integration tests pass for document access and export authorization.
- Playwright smoke test passes for signup to export.
- Accessibility checks pass for dashboard and builder critical paths.
- Manual PDF visual review completed.

## Demo Checklist

- Create account.
- Create resume.
- Edit sections.
- Preview resume.
- Run resume check.
- Export PDF.
- Return to dashboard and reopen saved resume.

## Performance Goals

- Builder route loads in under 3 seconds on a normal broadband connection.
- Autosave completes within 1 second for typical section edits.
- PDF export completes in under 10 seconds.
- No visible input lag during editing.

## Ready or Blocked Decision

Blocked. Implementation has not started. The release can become Ready only after Sprint 1 is built, tested, reviewed, and documented.

