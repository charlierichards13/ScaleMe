// POST /api/fit/analyze  { resume, job } -> { analysis: FitAnalysis }
// POST /api/fit/analyze?demo=true        -> a labeled synthetic sample (no AWS call, input ignored)
// Errors always use the shared ApiError shape from docs/api-contract.md.

import { analyzeFit } from "@/lib/ai/analyze-fit";
import { demoAnalysis, DEMO_LABEL } from "@/lib/ai/demo";
import { FitApiError, FitRequestSchema, LIMITS, type ApiError } from "@/lib/ai/schemas";

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

    const analysis = await analyzeFit(parsed.data);
    return Response.json({ analysis }, { headers: { "X-ScaleMe-Mode": "live" } });
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
  if (err instanceof FitApiError) {
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
