const DEFAULT_RENDERER_REQUEST_TIMEOUT_MS = 55_000;

type RenderHtmlToPdfOptions = {
  rendererUrl: string;
  rendererToken?: string;
  html: string;
  requestId: string;
  watermarked?: boolean;
};

export class PdfRendererError extends Error {
  readonly status: number;
  readonly rendererStatus?: number;
  readonly rendererBody?: string;

  constructor(message: string, options: { status: number; rendererStatus?: number; rendererBody?: string }) {
    super(message);
    this.name = "PdfRendererError";
    this.status = options.status;
    this.rendererStatus = options.rendererStatus;
    this.rendererBody = options.rendererBody;
  }
}

export async function renderHtmlToPdfViaRenderer({
  rendererUrl,
  rendererToken,
  html,
  requestId,
  watermarked,
}: RenderHtmlToPdfOptions): Promise<ArrayBuffer> {
  const timeoutMs = getRendererRequestTimeoutMs();

  let res: Response;
  try {
    res = await fetch(rendererUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(rendererToken ? { Authorization: `Bearer ${rendererToken}` } : {}),
        "X-Request-ID": requestId,
      },
      body: JSON.stringify({ html, watermarked }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Timeout — includes both AbortSignal timeout and network-level failures
    // (e.g. Render.com cold start where the connection hangs and Fetch throws TypeError)
    if (isTimeoutError(error)) {
      throw new PdfRendererError(`PDF renderer request timed out after ${timeoutMs}ms`, { status: 504 });
    }
    if (isNetworkError(error)) {
      throw new PdfRendererError(
        `PDF renderer network failure: ${error instanceof Error ? error.message : "unknown"}`,
        { status: 504 },
      );
    }
    throw error;
  }

  if (!res.ok) {
    const rendererBody = await res.text().catch(() => "unknown");
    throw new PdfRendererError(`PDF renderer returned ${res.status}: ${rendererBody}`, {
      status: statusForRendererFailure(res.status),
      rendererStatus: res.status,
      rendererBody,
    });
  }

  return res.arrayBuffer();
}

export function pdfRendererErrorResponse(error: unknown): Response {
  if (error instanceof PdfRendererError) {
    const message =
      error.status === 504
        ? "PDF renderer timed out. Please try again."
        : error.status === 413
          ? "This document is too large to export as a PDF."
          : "PDF renderer is temporarily unavailable. Please try again.";

    return Response.json({ error: message }, { status: error.status });
  }

  return Response.json({ error: "PDF render failed" }, { status: 500 });
}

function statusForRendererFailure(rendererStatus: number): number {
  if (rendererStatus === 504) return 504;
  if (rendererStatus === 413) return 413;
  return 502;
}

function getRendererRequestTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.PDF_RENDERER_REQUEST_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RENDERER_REQUEST_TIMEOUT_MS;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** Detect network-level failures (e.g. Render.com cold start where the TCP
 *  connection hangs until Fetch throws a TypeError like "fetch failed") */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  // Node.js undici/fetch sometimes throws an AggregateError wrapping a TypeError
  if (error instanceof AggregateError && error.errors.some(e => e instanceof TypeError)) return true;
  return false;
}
