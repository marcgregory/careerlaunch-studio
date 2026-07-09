import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "playwright-core";

/* ------------------------------------------------------------------ */
/*  Local-development browser launcher                                 */
/*                                                                     */
/*  Used only when PDF_RENDERER_URL is NOT set (local dev / CI).       */
/*  On Vercel, set PDF_RENDERER_URL to the external Docker service.    */
/*                                                                     */
/*  Requires Playwright Chromium to be installed locally:              */
/*    npx playwright install chromium                                  */
/* ------------------------------------------------------------------ */

/**
 * Launch a headless Chromium instance for PDF generation.
 *
 * Uses the Playwright-managed Chromium installation (the one you get
 * from `npx playwright install chromium`).
 *
 * This is the **only** browser launch entry point for local PDF
 * generation.  Both `pdf.tsx` and `cover-letter-pdf.tsx` call this.
 */
export async function launchBrowser(): Promise<Browser> {
  return playwrightChromium.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    headless: true,
  });
}
