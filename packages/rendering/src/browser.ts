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
  } catch {
    // @sparticuz/chromium not available (local dev without Chromium installed).
    // Let playwright-core discover its own browser.
  }

  return playwrightChromium.launch({
    args: executablePath ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
