// Shared request/response helpers for the server-only AI route handlers
// (POST /api/fit/analyze and POST /api/interview/next).
// Errors always use the ApiError shape from docs/api-contract.md and never echo request content.

import { RateLimitedError } from "./rate-limit";
import { FitApiError, LIMITS, type ApiError } from "./schemas";

/**
 * Read and parse a JSON body, enforcing the byte limit while streaming so a body without
 * a Content-Length header (e.g. chunked) cannot make the server buffer unbounded memory.
 */
export async function readJsonBody(request: Request, maxBytes: number = LIMITS.requestBodyBytes): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge();

  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(text);
  } catch {
    throw new FitApiError("INVALID_REQUEST", "The request body must be valid JSON.", false, 400);
  }
}

function tooLarge(): FitApiError {
  return new FitApiError("INVALID_REQUEST", "The request body is too large.", false, 413);
}

/** Turn any thrown value into a safe ApiError response. `tag` is a fixed route label for logs. */
export function errorResponse(err: unknown, tag: string): Response {
  if (err instanceof RateLimitedError) {
    // Log only the limit type: no IPs, headers, keys or request content.
    console.warn(`[${tag}] Rate limited: ${err.reason}`);
    const body: ApiError = { error: { code: err.code, message: err.message, retryable: true } };
    return Response.json(body, { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } });
  }
  if (err instanceof FitApiError) {
    // internalReason is a fixed string or variable NAME (see schemas.ts); it never reaches the client.
    if (err.internalReason) console.warn(`[${tag}] ${err.code}: ${err.internalReason}`);
    const body: ApiError = { error: { code: err.code, message: err.message, retryable: err.retryable } };
    return Response.json(body, { status: err.status });
  }
  // Unknown failure: log only the error type (never the message or request content).
  console.error(`[${tag}] Unexpected error: ${err instanceof Error ? err.name : "unknown"}`);
  const body: ApiError = {
    error: { code: "AI_UNAVAILABLE", message: "Something went wrong. Please retry.", retryable: true },
  };
  return Response.json(body, { status: 500 });
}
