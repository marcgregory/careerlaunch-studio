/**
 * `parseCreateError` — lifted out of `use-create-resume.ts` so test suites
 * can import it without dragging the React-only `.tsx` chain (notably
 * `lib/navigation-overlay.tsx`) through Vitest's import-analysis pipeline.
 *
 * The build target is webpack (`next build --webpack` in package.json) and
 * uses oxc/Babel for JSX, so the runtime bundling is fine. Vitest's
 * import-analysis runs a raw JS parser on the file, so keeping the test-
 * touching types in a `.ts` file avoids JSX parse failures in test runs.
 */

export type CreateApiError = Error & { upgradeUrl?: string };

/**
 * Parse a non-OK create response into a structured Error. The 403 from
 * POST /api/resumes carries `{ error, feature, upgradeUrl }`; we lift
 * `upgradeUrl` onto the thrown Error so the caller's onError can branch on
 * it without re-parsing the response.
 */
export async function parseCreateError(
  res: Response,
  fallback: string
): Promise<CreateApiError> {
  const body = (await res
    .json()
    .catch(() => ({ error: fallback }))) as {
    error?: string;
    upgradeUrl?: string;
  };
  const error = new Error(body.error || fallback) as CreateApiError;
  if (body.upgradeUrl) error.upgradeUrl = body.upgradeUrl;
  return error;
}
