---
name: pdf-architecture-separation
description: PDF rendering was separated into a standalone Docker service to avoid Vercel Chromium workarounds.
metadata:
  type: project
---

On 2026-07-04, the PDF rendering architecture was changed from an in-process Vercel Playwright setup (using `@sparticuz/chromium-min` + `playwright-core`) to a separated architecture:

**Vercel (Next.js)** — handles all app logic including HTML generation (`resumeToHtml`, `coverLetterToHtml`)
**Docker service (`services/pdf-renderer/`)** — lightweight Express server, accepts `POST /render` with `{ html }`, returns `application/pdf`

**Why:** After multiple rounds of workarounds (`@sparticuz/chromium` → `@sparticuz/chromium-min`, output tracing, binary resolution, launch flags, env vars), the in-process approach was still unstable on Vercel serverless. Isolating the browser dependency into a Docker service removes an entire class of deployment issues.

**Key files:**
- `services/pdf-renderer/src/server.js` — the standalone renderer
- `services/pdf-renderer/Dockerfile` — Node 20 slim + system Chromium
- `packages/rendering/src/render.ts` — shared `renderHtmlToPdf` for local dev
- `packages/rendering/src/pdf.tsx` — exports `resumeToHtml()` + `renderResumePdf()`
- `packages/rendering/src/cover-letter-pdf.tsx` — exports `coverLetterToHtml()` + `renderCoverLetterPdf()`
- `apps/web/app/api/export/pdf/route.ts` — uses `PDF_RENDERER_URL` env var gate
- `apps/web/app/api/export/cover-letter-pdf/route.ts` — same gate

**Contract:** `POST /render` with `Authorization: Bearer <token>` header, JSON body `{ html: string }` → `application/pdf`. `GET /health` → `{ status: "ok" }`.

**Production hardening:**
- Bearer-auth with `PDF_RENDERER_TOKEN` shared secret
- `AbortSignal.timeout(35000)` on Vercel side, `RENDER_TIMEOUT_MS` (default 30s) on renderer
- 5 MB max HTML payload enforcement
- Request validation (non-empty html string, proper JSON)
- Correlation ID via `X-Request-ID` header forwarded through both services
- Browser reuse across requests (launch once, keep alive, close pages per request)
- Graceful shutdown on SIGINT/SIGTERM

**Env vars:** `PDF_RENDERER_URL`, `PDF_RENDERER_TOKEN`, `PDF_RENDERER_TIMEOUT_MS`, `PDF_RENDERER_MAX_HTML_SIZE`, `CHROMIUM_PATH`

**Removed:** `@sparticuz/chromium-min`, `@sparticuz/chromium`, `CHROMIUM_PACK_URL`, Vercel-specific launch flags, browser.ts sparticuz logic, postinstall playwright hacks

Related: [[vercel-chromium-workarounds]]
