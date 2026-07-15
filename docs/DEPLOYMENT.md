# CareerLaunch Studio Deployment

Last updated: 2026-07-04

## Architecture

```
                    Vercel (Next.js)
 ┌──────────────────────────────────────────┐
 │ Resume Builder                           │
 │ AI Analysis / Suggestions / Diff / Apply │
 │ Job Match                                │
 │ Cover Letter Builder                     │
 │ Authentication (password sessions)       │
 │ PostgreSQL (Neon / Supabase)             │
 └───────────────┬──────────────────────────┘
                 │ POST /render
                 │ Authorization: Bearer ****
                 │ X-Request-ID: <uuid>
                 │ AbortSignal.timeout(55000)
                 ▼
        PDF_RENDERER_URL
                 │
                 ▼
        Docker PDF Renderer (Railway / etc.)
 ┌──────────────────────────────────────────┐
 │ Express HTTP server                      │
 │ Browser pool (reused across requests)    │
 │ Playwright + Chromium                    │
 │ PDF bytes out                            │
 └──────────────────────────────────────────┘
```

PDF rendering is isolated into a standalone Docker service. The Vercel app generates HTML (`resumeToHtml`, `coverLetterToHtml`) and sends it to the renderer via HTTP. This avoids bundling Chromium (~200 MB) into serverless deployments.

## The Two Services

### Service 1: Vercel (Next.js app)

Deployed from the monorepo root. Standard `vercel deploy`.

**Required env vars:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for session signing |
| `PDF_RENDERER_URL` | Full URL of renderer's `/render` endpoint (e.g. `https://pdf-renderer.up.railway.app/render`) |
| `PDF_RENDERER_TOKEN` | Shared secret — **must match** the renderer's `PDF_RENDERER_TOKEN` |
| `PDF_RENDERER_REQUEST_TIMEOUT_MS` | Optional Vercel-side timeout while waiting for the renderer (default `55000`) |

`PDF_RENDERER_URL` + `PDF_RENDERER_TOKEN` must both be set in production/preview.
When unset (local dev), the app falls back to the in-process Playwright renderer.

### Service 2: Docker PDF Renderer

A standalone Node.js HTTP server at `services/pdf-renderer/`.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/render` | Accepts `{ html: string }`, returns `application/pdf` |
| `GET` | `/health` | Returns `{ status: "ok", browserConnected: true/false }` |

**Renderer env vars:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP listen port |
| `PDF_RENDERER_TOKEN` | — | Shared secret for bearer auth (omit to disable auth — not recommended) |
| `PDF_RENDERER_TIMEOUT_MS` | `45000` | Per-request render timeout in ms |
| `PDF_RENDERER_MAX_HTML_SIZE` | `5242880` | Max accepted HTML payload in bytes (5 MB) |
| `CHROMIUM_PATH` | — | Path to system Chromium binary (optional; auto-detected on the Docker image) |

**Logs include `[<request-id>]` prefix** — correlate events across Vercel and the renderer via the `X-Request-ID` header.

### Building and running the renderer (Docker)

```bash
cd services/pdf-renderer

# Build
docker build -t careerlaunch-pdf-renderer .

# Run
docker run -d \
  -p 3001:3001 \
  -e PDF_RENDERER_TOKEN=491ef5f3... \
  --name pdf-renderer \
  careerlaunch-pdf-renderer
```

### Deploying to Railway

1. Create a new Railway project from the `services/pdf-renderer/` directory.
2. Railway auto-detects the Dockerfile.
3. Set env vars in Railway: `PORT=3001`, `PDF_RENDERER_TOKEN=...`.
4. Railway assigns a public URL (e.g. `https://pdf-renderer.up.railway.app`).
5. Set `PDF_RENDERER_URL=https://pdf-renderer.up.railway.app/render` and `PDF_RENDERER_TOKEN=...` in Vercel.

**The renderer must be deployed before PDF export works in production.**

## Local Development

```bash
# Install dependencies
npm install

# Install Playwright Chromium for local PDF rendering
npx playwright install chromium

# Start dev server
npm run dev
```

PDF export uses the in-process Playwright renderer when `PDF_RENDERER_URL` is not set.

## CI/CD

Every pull request should run:

- TypeScript check (`npm run typecheck`)
- Lint (`npm run lint`)
- Unit tests (`npm run test`)
- Integration tests where environment services are available
- Playwright smoke tests for critical paths (`npm run test:e2e`)
- Prisma migration validation

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
