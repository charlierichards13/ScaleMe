// POST /api/interview/next  { resume, job, history, fit? } -> { turn: InterviewResponse }
// POST /api/interview/next?demo=true&step=N              -> fixed labeled DEMO step (no AWS, body not read)
// Errors always use the shared ApiError shape from docs/api-contract.md.
//
// Order for a live request (each step rejects before any AWS call):
//   1. bounded body read + schema validation                     (400 / 413)
//   2. deterministic plan: requirement ids, fit context, history (400)
//   3. FIT_LIVE_AI_ENABLED must be "true"                         (503, not retryable)
//   4. cost-guard and AWS settings must be valid                  (503, not retryable)
//   5. SAME shared cost guard as /api/fit/analyze                 (429 + Retry-After)
//   6. one Bedrock call, slot always released afterwards; output checks or safe 502
//
// Stateless: nothing about the session is stored on the server. Interview history is
// re-sent by the client each turn and never logged.

import { getBedrockConfig, getFitGuardConfig } from "@/lib/ai/config";
import { errorResponse, readJsonBody } from "@/lib/ai/http";
import { INTERVIEW_LOG_TAG, nextInterviewTurn } from "@/lib/ai/interview";
import { DEMO_LABEL, demoInterviewStep } from "@/lib/ai/interview-demo";
import { selectNextTurn } from "@/lib/ai/interview-plan";
import { InterviewRequestSchema } from "@/lib/ai/interview-schemas";
import { getSharedFitLimiter, RateLimitedError } from "@/lib/ai/rate-limit";
import { FitApiError, LIVE_AI_UNAVAILABLE_MESSAGE } from "@/lib/ai/schemas";

// Route handlers run on the Node.js runtime by default, which the AWS SDK needs.
// (Do not add `export const runtime`: it is incompatible with cacheComponents in this Next.js config.)

const INVALID_PART: Record<string, [string, string]> = {
  resume: ["INVALID_RESUME", "The resume is missing or invalid (text is required, max 30,000 characters)."],
  job: ["INVALID_JOB", "The job posting is missing or invalid (title and text are required, text max 20,000 characters)."],
  history: [
    "INVALID_HISTORY",
    "The interview history is missing or invalid (an array of at most 12 coach/candidate turns, each 1-2,000 characters).",
  ],
  fit: ["INVALID_FIT_CONTEXT", "The fit context is invalid (assessments need a requirementId and a valid status)."],
};

export async function POST(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("demo") === "true") {
      const step = demoInterviewStep(url.searchParams.get("step"));
      if (!step) throw new FitApiError("INVALID_REQUEST", "Unknown demo step.", false, 400);
      return Response.json(
        { turn: step.turn },
        { headers: { "X-ScaleMe-Mode": "demo", "X-ScaleMe-Demo-Label": DEMO_LABEL } },
      );
    }

    const body = await readJsonBody(request);
    const parsed = InterviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Report only WHICH part is invalid, never the submitted values.
      const part = String(parsed.error.issues[0]?.path[0] ?? "");
      const [code, message] = INVALID_PART[part] ?? ["INVALID_REQUEST", "The request body is invalid."];
      throw new FitApiError(code, message, false, 400);
    }

    // Deterministic, free checks of ids and history before any live-AI gate or budget use.
    const selected = selectNextTurn(parsed.data);

    const guard = getFitGuardConfig();
    if (!guard.liveEnabled) {
      throw new FitApiError("AI_UNAVAILABLE", LIVE_AI_UNAVAILABLE_MESSAGE, false, 503, "live AI disabled: FIT_LIVE_AI_ENABLED is not true");
    }
    getBedrockConfig();

    // Shared with fit analysis: one per-process budget for every paid model call.
    const decision = getSharedFitLimiter(guard).tryAcquire();
    if (!decision.allowed) throw new RateLimitedError(decision.reason, decision.retryAfterSeconds);

    try {
      const turn = await nextInterviewTurn(parsed.data, undefined, selected);
      return Response.json({ turn }, { headers: { "X-ScaleMe-Mode": "live" } });
    } finally {
      decision.release();
    }
  } catch (err) {
    return errorResponse(err, INTERVIEW_LOG_TAG);
  }
}
