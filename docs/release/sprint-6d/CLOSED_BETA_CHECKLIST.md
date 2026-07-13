# Closed Beta Checklist

- Date/time: 2026-07-13T10:37:42Z
- Environment: local evaluation with Vercel-linked env, localhost database-backed Playwright, real Groq AI provider

## Passed

- Lint: `npm run lint` passed with zero errors and zero warnings.
- Unit/static analysis: `npm test` passed across web, AI, and domain workspaces.
- Typecheck: `npm run typecheck` passed across all workspaces.
- Resume-flow E2E: `npx playwright test tests/resume-flow.spec.ts --project=chromium --workers=1` passed 6/6.
- Production deploy sanity: `npx vercel deploy --prod --force --scope marcgregorys-projects` deployed with cache skipped and aliased to `https://careerlaunch-studio.vercel.app`.
- Production health: `GET /api/health` returned 200 with app, database, PDF renderer, and billing checks all `ok`.
- Production smoke: signup, dashboard, resume create/open/autosave, real AI analysis, cover-letter generation, PDF export, Stripe Checkout URL creation, logout all passed.
- Production paid smoke: temporary generated smoke user was granted PROFESSIONAL, tailoring returned suggestions, and the smoke user was deleted afterward.
- AI preflight: pass with Groq / llama-3.1-8b-instant.
- AI dogfooding: pass, 6/6 personas, real Groq calls, no mock/static fallback.
- AI benchmark: pass, 6/6 personas, real Groq calls, prompt failure 0%, overallPass true.
- AI recovery: pass, deliberate Gemini primary failure recovered to Groq secondary; no static/mock fallback.
- Mobile QA: pass, 11/11 mobile tests from prior Sprint 6D report.
- Billing/test checkout: pass, 4/4 mocked Stripe checkout/billing tests from prior Sprint 6D report.

## Fixed Blockers

- React hook lint blockers fixed without eslint-disable suppressions.
- Web rendering source guard fixed by aligning React reference contact separator with PDF and repairing mojibake in rendering source.
- AI static-analysis regressions fixed while preserving static release-gate guarantees and true-metrics coaching.
- Resume-flow stale builder selector updated from `Resume title` to accessible `File name`.
- Resume-flow registration rate-limit contamination removed by isolated API registration with per-user `x-forwarded-for` and explicit 429 handling.
- Premium-template E2E setup now grants deterministic PROFESSIONAL entitlement for tests that intentionally exercise premium templates.
- Current visual snapshots regenerated for the template renderer after verifying the current output.
- Vercel config moved into the configured app root at `apps/web/vercel.json`; the root-level config copy was removed.
- Production health check now allows 15 seconds for the external PDF renderer health request, avoiding false degraded status during renderer cold start.

## Known Issues

- Gemini free-tier quota was exhausted in earlier evaluation attempts; final successful gates used Groq for primary evaluation and Gemini only as the deliberately failed recovery primary.
- Full manual accessibility audit remains broader than this gate run; keyboard/modal/contrast/reduced-motion coverage should still be expanded before public launch.
- Vercel project settings still show custom Build Command `cd ../.. && npm run deploy`; requested target is default or `npm run build`. The CLI can inspect this setting but does not expose a project-setting update command.

## Verdict

Sprint 6D is closed-beta ready on the requested gate set. No hook lint, parser regression, resume-flow, production health, PDF export, AI analysis, cover-letter, tailoring, or checkout smoke blockers remain.