# CareerLaunch Studio Deployment

Last updated: 2026-07-04

## Architecture

```
                Vercel (Next.js)
        ┌─────────────────────────┐
        │ Resume Builder          │
        │ Job Match               │
        │ AI Analysis             │
        │ Cover Letter            │
        │ Authentication          │
        └──────────┬──────────────┘
                   │ HTTPS (POST /render, body: { html })
                   ▼
        ┌─────────────────────────┐
        │ PDF Renderer Service    │
        │ Railway / Docker        │
        │                         │
        │ Playwright + Chromium   │
        └─────────────────────────┘
```

PDF rendering is isolated into a standalone Docker service. The Vercel app generates HTML and sends it to the renderer via HTTP. This avoids bundling Chromium (~200 MB) into serverless deployments.

## Environments

- Local: developer machine with local Postgres or hosted development database.
- Preview: per-branch deploys for UI review.
- Staging: production-like environment for Stripe test mode, migrations, and release checks.
- Production: public app with live billing and monitored exports.

## Deployment Target

- **Vercel** for the Next.js app.
- **Neon** or **Supabase** for managed Postgres.
- **Railway** (or any Docker host) for the PDF renderer service.

This keeps operations light while supporting previews, rollbacks, managed TLS, and environment separation.

## CI/CD

Every pull request should run:

- TypeScript check.
- Lint.
- Unit tests.
- Integration tests where environment services are available.
- Playwright smoke tests for critical paths.
- Prisma migration validation.

## PDF Renderer Service

A standalone Node.js HTTP server at `services/pdf-renderer/`:

```
POST /render
Content-Type: application/json
Body: { "html": "<!doctype html>..." }
Response: application/pdf
```

### Building and running (Docker)

```bash
cd services/pdf-renderer

docker build -t careerlaunch-pdf-renderer .

docker run -d \
  -p 3001:3001 \
  --name pdf-renderer \
  careerlaunch-pdf-renderer
```

### Environment variables

| Variable                      | Default   | Description                                              |
|-------------------------------|-----------|----------------------------------------------------------|
| `PORT`                        | `3001`    | Port to listen on                                        |
| `CHROMIUM_PATH`               | —         | Path to system Chromium binary (optional)                |
| `PDF_RENDERER_TOKEN`          | —         | Shared secret for bearer-auth (omit to disable auth)     |
| `PDF_RENDERER_TIMEOUT_MS`     | `30000`   | Per-request render timeout in ms                         |
| `PDF_RENDERER_MAX_HTML_SIZE`  | `5242880` | Max accepted HTML payload in bytes (default 5 MB)        |

### Deploying to Railway

1. Create a new Railway project from the `services/pdf-renderer/` directory.
2. Railway auto-detects the Dockerfile.
3. Set `PORT=3001` and `PDF_RENDERER_TOKEN` in Railway environment.
4. Note the public URL (e.g. `https://pdf-renderer.up.railway.app`).

## Vercel Environment Variables

| Variable            | Required | Description                                              |
|---------------------|----------|----------------------------------------------------------|
| `DATABASE_URL`      | Yes      | PostgreSQL connection string                             |
| `AUTH_SECRET`       | Yes      | Secret for session signing                               |
| `PDF_RENDERER_URL`  | Yes*     | URL of the PDF renderer service (e.g. `https://pdf-renderer.up.railway.app/render`) |
| `PDF_RENDERER_TOKEN`| Yes*     | Shared secret matching the renderer's `PDF_RENDERER_TOKEN` |

Set both `PDF_RENDERER_URL` and `PDF_RENDERER_TOKEN` in Vercel production/preview environments.
When `PDF_RENDERER_URL` is unset (local dev), the app falls back to the in-process Playwright renderer.

## Local Development

```bash
# Install dependencies
npm install

# Install Playwright Chromium for local PDF rendering
npx playwright install chromium

# Start dev server
npm run dev
```

PDF export will use the in-process Playwright renderer when `PDF_RENDERER_URL` is not set.

## Release Process

1. Merge passing changes into main.
2. Deploy to staging.
3. Run release checklist from `docs/implementation/RELEASE_PLAN.md`.
4. Promote to production.
5. Monitor logs, error rates, export failures, and payment webhooks.
6. Update changelog and project status.

## Rollback

Use platform rollback for app deployments. Database migrations must be backwards-compatible where possible. High-risk migrations require a written rollback note in the release checklist.

## Operations

- Daily database backups through the managed provider.
- Error alerts for payment webhooks and export failures.
- Basic uptime monitoring.
- Secret rotation policy before public launch.
- Stripe webhook replay procedure documented before paid launch.
