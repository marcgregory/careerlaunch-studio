import { chromium as playwrightChromium } from "playwright-core";
import type { Browser } from "playwright-core";

/* ------------------------------------------------------------------ */
/*  Cross-platform browser launcher (local dev + Vercel)               */
/* ------------------------------------------------------------------ */

const IS_WINDOWS = process.platform === "win32";
const IS_VERCEL = !!process.env.VERCEL;

/**
 * Lazy-import @sparticuz/chromium-min so the module doesn't crash at
 * load-time on platforms where it isn't compatible.
 */
async function getSparticuzChromiumMin(): Promise<{
  args: readonly string[];
  executablePath(input?: string): Promise<string>;
} | null> {
  if (IS_WINDOWS) return null;
  try {
    const mod: { default?: { args: readonly string[]; executablePath(input?: string): Promise<string> } } =
      await import("@sparticuz/chromium-min");
    return (mod.default ?? mod) as {
      args: readonly string[];
      executablePath(input?: string): Promise<string>;
    };
  } catch {
    return null;
  }
}

/**
 * Launch a headless Chromium instance for PDF generation.
 *
 * **Vercel (production):** uses the `@sparticuz/chromium-min` serverless-
 * optimized binary fetcher.  The actual Chromium binary is downloaded from
 * a hosted pack URL (set via `CHROMIUM_PACK_URL`).  This avoids the Vercel
 * bundling/tracing problems that plague the full `@sparticuz/chromium`
 * package.
 *
 * **Local Windows / macOS / Linux dev:** uses the Playwright-managed
 * Chromium installation.  Run `npx playwright install chromium` to ensure
 * it is present.
 *
 * This is the **only** browser launch entry point for PDF generation.
 * Both `pdf.tsx` and `cover-letter-pdf.tsx` must call this function.
 */
export async function launchBrowser(): Promise<Browser> {
  let executablePath: string | undefined;
  let chromiumArgs: string[] = [];

  if (!IS_WINDOWS) {
    const sparticuz = await getSparticuzChromiumMin();

    if (sparticuz) {
      try {
        const packUrl = process.env.CHROMIUM_PACK_URL;
        if (!packUrl) {
          throw new Error("CHROMIUM_PACK_URL environment variable is not set.");
        }
        executablePath = await sparticuz.executablePath(packUrl);
        chromiumArgs = [...sparticuz.args];
      } catch {
        // @sparticuz/chromium-min loaded but executablePath() failed
        // (binary download failed, pack URL unreachable, etc.).
      }
    }

    // On Vercel, the sparticuz binary is our only option.
    if (IS_VERCEL && !executablePath) {
      throw new Error(
        "Cannot resolve Chromium binary on Vercel.  " +
          "@sparticuz/chromium-min module loaded but executablePath() " +
          "returned no binary.  Ensure CHROMIUM_PACK_URL is set correctly.",
      );
    }
  }

  return playwrightChromium.launch({
    args: executablePath ? [...chromiumArgs] : ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath,
    headless: true,
  });
}
