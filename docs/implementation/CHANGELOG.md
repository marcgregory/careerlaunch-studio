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
- Playwright e2e coverage for auth protection and a database-backed happy path gated by `DATABASE_URL`.
- Domain test coverage for resume scoring.

### Changed

- Root build script now skips workspaces without build scripts.
- Resume builder persistence now saves through API routes instead of browser `localStorage`.
- Dashboard now lists authenticated user's persisted resumes.

### Fixed

- Fixed workspace TypeScript resolution by pointing the rendering package entry to its `.tsx` source.
- Added a default Next document module required by the production build.

### Removed

- Removed localStorage-based resume autosave from the builder.
