const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * Extract or generate a request ID for correlation across services.
 *
 * Priority:
 * 1. Existing `X-Request-ID` header from the incoming request (e.g. from a
 *    reverse proxy or the PDF renderer's response).
 * 2. A new random UUID, which is also used as the outgoing header value
 *    when calling downstream services.
 *
 * Usage:
 *   const requestId = getRequestId(request);
 *   // pass as X-Request-ID to downstream services
 */
export function getRequestId(request: Request): string {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER);
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}
