import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "playwright-core";

/* ------------------------------------------------------------------ */
/*  Cross-platform browser launcher (local dev + Vercel)               */
/* ------------------------------------------------------------------ */

const IS_WINDOWS = process.platform === "win32";
const IS_VERCEL = !!process.env.VERCEL;

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
        // @sparticuz/chromium module loaded but the binary path could
        // not be resolved (e.g. the binary wasn't bundled into the
        // Vercel deployment or the filesystem layout differs).
        // Do NOT fall through to playwright-core's own browser — it
        // doesn't exist in serverless environments and would produce
        // the confusing "Executable doesn't exist at ...ms-playwright"
        // error.  We'll throw a clear message instead.
      }
    }

    // On Vercel, the sparticuz binary is our only option.  If we
    // couldn't resolve it, give a clear error rather than letting
    // playwright-core search for its own browser (which is not
    // present in serverless deployments).
    if (IS_VERCEL && !executablePath) {
      throw new Error(
        "Cannot resolve Chromium binary on Vercel.  " +
          "@sparticuz/chromium module loaded but executablePath() " +
          "returned no binary.  Ensure @sparticuz/chromium@121 is " +
          "installed and the binary is included in the deployment.",
      );
    }
  }

  return playwrightChromium.launch({
    args: executablePath ? chromiumArgs : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
