import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserType } from "playwright";

/* ------------------------------------------------------------------ */
/*  Production browser launcher with executable-path fallback           */
/* ------------------------------------------------------------------ */

/**
 * Resolve the path to the Playwright Chromium executable.
 *
 * In production (Vercel, Railway, Docker), the `chromium_headless_shell`
 * binary that Playwright 1.61+ prefers may not be installed — only the
 * full Chromium browser channel.  We probe known cache locations and
 * fall back gracefully so that `.launch()` always has a valid binary.
 *
 * Set `PLAYWRIGHT_BROWSERS_PATH` to override the cache directory
 * (same env var Playwright itself respects).
 */
function resolveChromiumExecutable(): string | undefined {
  const cacheDir =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    (process.platform === "win32"
      ? join(
          process.env.USERPROFILE || "C:\\Users\\default",
          "AppData",
          "Local",
          "ms-playwright",
        )
      : join(process.env.HOME || "/root", ".cache", "ms-playwright"));

  // Try headless shell first (Playwright 1.61.x default)
  for (const dir of [
    "chromium_headless_shell-1228",
    "chromium_headless_shell-1194",
  ]) {
    const exe = join(
      cacheDir,
      dir,
      process.platform === "win32"
        ? "chrome-headless-shell-win64\\chrome-headless-shell.exe"
        : "chrome-headless-shell-linux64/chrome-headless-shell",
    );
    if (existsSync(exe)) return exe;
  }

  // Fall back to full Chromium
  for (const dir of ["chromium-1228", "chromium-1194", "chromium-1148"]) {
    const exe = join(
      cacheDir,
      dir,
      process.platform === "win32"
        ? "chrome-win64\\chrome.exe"
        : "chrome-linux/chrome",
    );
    if (existsSync(exe)) return exe;
  }

  return undefined;
}

/**
 * Launch a headless Chromium instance, automatically resolving the
 * executable path from the Playwright cache.
 *
 * Always passes `--no-sandbox` (required in Docker / CI / VPS environments).
 */
export async function launchChromium(
  browserType: BrowserType,
): Promise<Browser> {
  const executablePath = resolveChromiumExecutable();

  return browserType.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
