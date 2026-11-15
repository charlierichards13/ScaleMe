// POST /api/fit/analyze  { resume, job } -> { analysis: FitAnalysis }
// POST /api/fit/analyze?demo=true        -> a labeled synthetic sample (no AWS call, input ignored)
// Errors always use the shared ApiError shape from docs/api-contract.md.
//
// Order for a live request (each step rejects before any AWS call):
//   1. bounded body read + schema validation   (400 / 413)
//   2. FIT_LIVE_AI_ENABLED must be "true"       (503, not retryable)
//   3. cost-guard and AWS settings must be valid (503, not retryable)
//   4. shared cost guard: day, minute, concurrency (429 + Retry-After)
//   5. one Bedrock call (SDK maxAttempts defaults to 1), slot always released afterwards

import { analyzeFit } from "@/lib/ai/analyze-fit";
import { getBedrockConfig, getFitGuardConfig } from "@/lib/ai/config";
import { demoAnalysis, DEMO_LABEL } from "@/lib/ai/demo";
import { getSharedFitLimiter, RateLimitedError } from "@/lib/ai/rate-limit";
import { FitApiError, FitRequestSchema, LIMITS, LIVE_AI_UNAVAILABLE_MESSAGE, type ApiError } from "@/lib/ai/schemas";

// Route handlers run on the Node.js runtime by default, which the AWS SDK needs.
// (Do not add `export const runtime`: it is incompatible with cacheComponents in this Next.js config.)

export async function POST(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).searchParams.get("demo") === "true") {
      return Response.json(
        { analysis: demoAnalysis },
        { headers: { "X-ScaleMe-Mode": "demo", "X-ScaleMe-Demo-Label": DEMO_LABEL } },
      );
    }

    const body = await readJsonBody(request);
    const parsed = FitRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Report only WHICH part is invalid, never the submitted values.
      const resumeBad = parsed.error.issues.some((i) => i.path[0] === "resume");
      throw resumeBad
        ? new FitApiError("INVALID_RESUME", "The resume is missing or invalid (text is required, max 30,000 characters).", false, 400)
        : new FitApiError("INVALID_JOB", "The job posting is missing or invalid (title and text are required, text max 20,000 characters).", false, 400);
    }

    const guard = getFitGuardConfig();
    if (!guard.liveEnabled) {
      throw new FitApiError("AI_UNAVAILABLE", LIVE_AI_UNAVAILABLE_MESSAGE, false, 503, "live AI disabled: FIT_LIVE_AI_ENABLED is not true");
    }
    // Fail fast on missing AWS settings so a misconfigured server never uses up the call budget.
    getBedrockConfig();

    const decision = getSharedFitLimiter(guard).tryAcquire();
    if (!decision.allowed) throw new RateLimitedError(decision.reason, decision.retryAfterSeconds);

    try {
      const analysis = await analyzeFit(parsed.data);
      return Response.json({ analysis }, { headers: { "X-ScaleMe-Mode": "live" } });
    } finally {
      decision.release();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LIMITS.requestBodyBytes) throw tooLarge();

  // Read in chunks and stop early, so a body without a Content-Length header
  // (e.g. chunked) cannot make the server buffer an unbounded amount of memory.
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITS.requestBodyBytes) {
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

function errorResponse(err: unknown): Response {
  if (err instanceof RateLimitedError) {
    // Log only the limit type: no IPs, headers, keys or request content.
    console.warn(`[fit/analyze] Rate limited: ${err.reason}`);
    const body: ApiError = { error: { code: err.code, message: err.message, retryable: true } };
    return Response.json(body, { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } });
  }
  if (err instanceof FitApiError) {
    // internalReason is a fixed string or variable NAME (see schemas.ts); it never reaches the client.
    if (err.internalReason) console.warn(`[fit/analyze] ${err.code}: ${err.internalReason}`);
    const body: ApiError = { error: { code: err.code, message: err.message, retryable: err.retryable } };
    return Response.json(body, { status: err.status });
  }
  // Unknown failure: log only the error type (never the message or request content).
  console.error(`[fit/analyze] Unexpected error: ${err instanceof Error ? err.name : "unknown"}`);
  const body: ApiError = {
    error: { code: "AI_UNAVAILABLE", message: "Something went wrong. Please retry.", retryable: true },
  };
  return Response.json(body, { status: 500 });
}
