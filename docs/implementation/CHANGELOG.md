# Changelog

All notable changes to CareerLaunch Studio will be documented here.

## 0.1.0 - 2026-07-03

### Added

- Initial project foundation.
- Product scope, PRD, architecture, tech stack, deployment, roadmap, build plan, release plan, status, technical debt, ADRs, and Founder OS.
- TypeScript monorepo scaffold with Next.js web app and shared `domain`, `rendering`, and `ui` packages.
- First resume-builder vertical slice with dashboard, editable builder, local autosave, resume scoring, live preview, and print-to-PDF export.
- Prisma schema for users, resume documents, versions, export jobs, and subscriptions.
- First-party email/password auth with signed HTTP-only session cookies.
- Protected dashboard and builder pages.
- Database-backed resume create/edit/save API routes with per-user ownership checks.
- Ownership-checked PDF export request route.
- Initial PostgreSQL Prisma migration.
- Complete builder editing coverage for contact, target, summary, experience, education, skills, certifications, projects, and section order.
- Builder validation, empty states, reset controls, autosave status, and export-disabled states for incomplete resumes.
- Real PDF generation with preview/PDF section-order parity and repeated-render stability coverage.
- Playwright e2e coverage for auth protection, database-backed signup/save/export, PDF regression, and builder section/item ordering persistence.
- Domain test coverage for resume scoring.

### Changed

- Root build script now skips workspaces without build scripts.
- Resume builder persistence now saves through API routes instead of browser `localStorage`.
- Dashboard now lists authenticated user's persisted resumes.
- Root layout now declares Next's smooth-scroll behavior attribute to keep route-transition diagnostics clean.
- Sprint 1 status and roadmap documentation now mark the resume-builder vertical slice as release-complete.

### Fixed

- Fixed workspace TypeScript resolution by pointing the rendering package entry to its `.tsx` source.
- Added a default Next document module required by the production build.
- Restored generated `next-env.d.ts` to the production routes import after dev server runs.

### Removed

- Removed localStorage-based resume autosave from the builder.