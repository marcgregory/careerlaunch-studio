import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "playwright-core";

/* ------------------------------------------------------------------ */
/*  Cross-platform browser launcher (local dev + Vercel)               */
/* ------------------------------------------------------------------ */

/**
 * Detect whether we are running on Windows so we can skip the
 * `@sparticuz/chromium` serverless binary (which is not compatible).
 * On Windows we rely on the Playwright-managed Chromium installation
 * (`npx playwright install chromium`).
 */
const IS_WINDOWS = process.platform === "win32";

/**
 * Lazy-import @sparticuz/chromium so the module doesn't crash at
 * load-time on platforms where it isn't compatible.
 */
async function getSparticuzChromium(): Promise<typeof import("@sparticuz/chromium") | null> {
  if (IS_WINDOWS) return null;
  try {
    const mod = await import("@sparticuz/chromium");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Launch a headless Chromium instance for PDF generation.
 *
 * **Vercel (production):** uses the `@sparticuz/chromium` serverless-optimized
 * binary with its recommended default args (GPU/rendering features already
 * disabled by the package).
 *
 * **Local Windows / macOS / Linux dev:** uses the Playwright-managed Chromium
 * installation. Run `npx playwright install chromium` to ensure it is present.
 *
 * This is the **only** browser launch entry point for PDF generation.
 * Both `pdf.tsx` and `cover-letter-pdf.tsx` must call this function.
 */
export async function launchBrowser(): Promise<Browser> {
  let executablePath: string | undefined;
  let chromiumArgs: string[] = [];

  if (!IS_WINDOWS) {
    const sparticuz = await getSparticuzChromium();

    if (sparticuz) {
      try {
        executablePath = await sparticuz.executablePath();
        chromiumArgs = sparticuz.args;
      } catch {
        // @sparticuz/chromium binary unavailable (local dev without the
        // sparticuz Chromium installed). Let playwright-core discover its
        // own browser.
      }
    }
  }

  return playwrightChromium.launch({
    args: executablePath ? chromiumArgs : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
