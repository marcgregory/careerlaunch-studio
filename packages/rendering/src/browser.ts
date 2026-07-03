import { dirname } from "node:path";
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
 * binary with GPU disabled and `LD_LIBRARY_PATH` set so the dynamic linker
 * can find the bundled `.so` shared libraries (fixes "libnss3.so not found").
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

  /*
   * ── Platform detection ──────────────────────────────────────────────
   *
   * On Windows, @sparticuz/chromium's brotli-compressed binary is
   * incompatible with the OS.  Skip it entirely and let Playwright find
   * its own locally-installed Chromium (from `npx playwright install
   * chromium`).
   *
   * On Linux / macOS we use @sparticuz/chromium on Vercel and fall back
   * to Playwright's local install when it isn't available.
   */
  if (!IS_WINDOWS) {
    const sparticuz = await getSparticuzChromium();

    if (sparticuz) {
      try {
        executablePath = await sparticuz.executablePath();
        // Disable GPU/rendering features — not needed for PDF generation
        // and reduces the shared-library surface area on serverless runtimes.
        sparticuz.setGraphicsMode = false;
        chromiumArgs = sparticuz.args;
      } catch {
        // @sparticuz/chromium binary unavailable (local dev without the
        // sparticuz Chromium installed). Let playwright-core discover its
        // own browser.
      }
    }
  }

  /*
   * ── LD_LIBRARY_PATH (Vercel / Linux only) ───────────────────────────
   *
   * On Vercel, @sparticuz/chromium extracts to /tmp and its .so files
   * must be discoverable by the dynamic linker.
   */
  if (!IS_WINDOWS && executablePath) {
    process.env.LD_LIBRARY_PATH = [
      dirname(executablePath),
      "/tmp",
      process.env.LD_LIBRARY_PATH,
    ]
      .filter(Boolean)
      .join(":");
  }

  return playwrightChromium.launch({
    args: executablePath ? chromiumArgs : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
