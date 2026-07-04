import { PostHog } from "posthog-node";

/**
 * Server-side analytics helper.
 *
 * Captures events from API routes. No-ops outside production.
 * Uses fire-and-forget pattern — does not block the response.
 * The PostHog client is only instantiated when the API key is set.
 */
function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  // Cache the client on the module singleton
  if (!_client) {
    _client = new PostHog(key, {
      host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    });
  }
  return _client;
}

let _client: PostHog | null = null;

export function captureServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== "production") return;

  const client = getClient();
  if (!client) return;

  client.capture({
    distinctId,
    event,
    properties,
  });
  // Fire-and-forget — do not await shutdown in a request handler
  client._shutdown().catch(() => {});
}
