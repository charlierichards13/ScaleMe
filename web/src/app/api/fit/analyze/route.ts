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
import { errorResponse, readJsonBody } from "@/lib/ai/http";
import { getSharedFitLimiter, RateLimitedError } from "@/lib/ai/rate-limit";
import { FitApiError, FitRequestSchema, LIVE_AI_UNAVAILABLE_MESSAGE } from "@/lib/ai/schemas";

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
    return errorResponse(err, "fit/analyze");
  }
}
