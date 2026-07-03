import { dirname } from "node:path";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "playwright-core";

/* ------------------------------------------------------------------ */
/*  Production browser launcher via @sparticuz/chromium (Vercel-ready)  */
/* ------------------------------------------------------------------ */

/**
 * Launch a headless Chromium instance using the `@sparticuz/chromium`
 * serverless-optimized binary, falling back to a local Playwright Core
 * install when the serverless binary is unavailable (e.g. local dev).
 *
 * This is the **only** browser launch entry point for PDF generation.
 * Both `pdf.tsx` and `cover-letter-pdf.tsx` must call this function.
 */
export async function launchBrowser(): Promise<Browser> {
  let executablePath: string | undefined;

  try {
    executablePath = await chromium.executablePath();

    // Disable GPU/rendering features — not needed for PDF generation and
    // reduces the shared-library surface area on serverless runtimes.
    chromium.setGraphicsMode = false;
  } catch {
    // @sparticuz/chromium not available (local dev without Chromium installed).
    // Let playwright-core discover its own browser.
  }

  // Ensure Chromium's bundled shared libraries are on the library path.
  // On Vercel, @sparticuz/chromium extracts to /tmp and its .so files
  // must be discoverable by the dynamic linker (fixes "libnss3.so not found").
  process.env.LD_LIBRARY_PATH = [
    executablePath ? dirname(executablePath) : undefined,
    "/tmp",
    process.env.LD_LIBRARY_PATH,
  ]
    .filter(Boolean)
    .join(":");

  return playwrightChromium.launch({
    args: executablePath ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
