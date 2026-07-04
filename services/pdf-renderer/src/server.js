/* ------------------------------------------------------------------ */
/*  PDF Renderer Service                                               */
/*                                                                     */
/*  Standalone Docker-backed service that renders HTML to PDF via      */
/*  Playwright + Chromium.  Called by the Vercel API route when         */
/*  PDF_RENDERER_URL is set.                                           */
/*                                                                     */
/*  POST /render  —  HTML → PDF (requires PDF_RENDERER_TOKEN)         */
/*  GET  /health  —  health check                                     */
/* ------------------------------------------------------------------ */

import http from "node:http";
import { chromium } from "playwright";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const PORT = parseInt(process.env.PORT || "3001", 10);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH;
const RENDERER_TOKEN = process.env.PDF_RENDERER_TOKEN;
/* Max acceptable HTML payload in bytes (default 5 MB). */
const MAX_HTML_SIZE = parseInt(process.env.PDF_RENDERER_MAX_HTML_SIZE || (5 * 1024 * 1024).toString(), 10);
/* Per-request render timeout in ms (default 30 s). */
const RENDER_TIMEOUT_MS = parseInt(process.env.PDF_RENDERER_TIMEOUT_MS || "30000", 10);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > MAX_HTML_SIZE) {
        req.destroy(new Error("Payload too large"));
        return reject(new Error("Payload too large"));
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : null);
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/*  Browser lifecycle — keep one browser alive across requests         */
/* ------------------------------------------------------------------ */

let _browser;
let _browserRefCount = 0;

async function getBrowser() {
  if (_browser && _browser.isConnected()) {
    _browserRefCount++;
    return _browser;
  }
  // Launch on first request or reconnect after disconnect
  _browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: CHROMIUM_PATH || undefined,
    headless: true,
  });
  _browserRefCount = 1;

  // If the browser disconnects unexpectedly, clear the reference
  _browser.on("disconnected", () => {
    _browser = null;
    _browserRefCount = 0;
  });

  return _browser;
}

function releaseBrowser() {
  _browserRefCount = Math.max(0, _browserRefCount - 1);
}

async function shutdownBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch { /* ignore */ }
    _browser = null;
    _browserRefCount = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Core render function                                               */
/* ------------------------------------------------------------------ */

async function renderPdf(html, signal) {
  const browser = await getBrowser();
  let page;

  try {
    page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
    });

    // Apply a per-request timeout for setContent + pdf
    await page.setContent(html, { waitUntil: "networkidle", timeout: RENDER_TIMEOUT_MS });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.35in",
        right: "0.35in",
        bottom: "0.35in",
        left: "0.35in",
      },
      timeout: RENDER_TIMEOUT_MS,
    });

    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
  } finally {
    if (page) await page.close().catch(() => {});
    releaseBrowser();
  }
}

/* ------------------------------------------------------------------ */
/*  Request handler                                                    */
/* ------------------------------------------------------------------ */

function handleRequest(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Health check --------------------------------------------------
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, {
      status: "ok",
      browserConnected: _browser ? _browser.isConnected() : false,
    });
    return;
  }

  // --- Render --------------------------------------------------------
  if (req.method === "POST" && req.url === "/render") {
    handleRender(req, res);
    return;
  }

  json(res, 404, { error: "Not found. Use POST /render or GET /health" });
}

async function handleRender(req, res) {
  // 1. Authenticate
  if (RENDERER_TOKEN) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${RENDERER_TOKEN}`) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }
  }

  // 2. Extract correlation ID for logging
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const start = Date.now();

  // 3. Parse & validate body
  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    const status = err.message === "Payload too large" ? 413 : 400;
    json(res, status, { error: err.message || "Bad request" });
    return;
  }

  if (!body || typeof body.html !== "string" || body.html.length === 0) {
    json(res, 400, { error: 'html field is required and must be a non-empty string' });
    return;
  }

  console.log(`[${requestId}] render start (${body.html.length} bytes)`);

  // 4. Render with timeout
  try {
    const timeoutSignal = AbortSignal.timeout(RENDER_TIMEOUT_MS);
    const pdf = await renderPdf(body.html, timeoutSignal);

    const elapsed = Date.now() - start;
    console.log(`[${requestId}] render complete (${pdf.byteLength} bytes, ${elapsed}ms)`);

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    });
    res.end(Buffer.from(pdf));
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[${requestId}] render error after ${elapsed}ms:`, err.message);

    // Check for timeout errors from Playwright
    const isTimeout = err.message?.includes("Timeout") || err.name === "TimeoutError";
    json(res, isTimeout ? 504 : 500, { error: isTimeout ? "Render timed out" : "PDF render failed" });
  }
}

/* ------------------------------------------------------------------ */
/*  Server startup & graceful shutdown                                  */
/* ------------------------------------------------------------------ */

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`PDF renderer listening on port ${PORT}`);
  console.log(`  max HTML size:  ${(MAX_HTML_SIZE / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  render timeout: ${RENDER_TIMEOUT_MS} ms`);
  console.log(`  auth enabled:   ${!!RENDERER_TOKEN}`);
});

async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await shutdownBrowser();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
