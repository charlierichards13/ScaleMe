import { requirePrivateAi } from "@/lib/private-ai/access";
import { getBedrockConfig, getFitGuardConfig } from "@/lib/ai/config";
import { errorResponse } from "@/lib/ai/http";
import { invokeBedrock } from "@/lib/ai/bedrock";
import { getSharedFitLimiter, RateLimitedError } from "@/lib/ai/rate-limit";
import { FitApiError } from "@/lib/ai/schemas";
import { CoachRequestSchema, COACH_LIMITS } from "@/lib/coach/schema";
import { buildCoachPrompt, COACH_SYSTEM, parseCoachOutput, validateCoachSafety } from "@/lib/coach/server";

const headers = { "Cache-Control": "no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request): Promise<Response> {
  // Defense in depth: direct route invocation also rejects before body, budget or provider.
  const rejected = requirePrivateAi(request);
  if (rejected) return rejected;
  try {
    if (process.env.COACH_LIVE_AI_ENABLED?.trim().toLowerCase() !== "true") {
      throw new FitApiError("AI_UNAVAILABLE", "Private Career Coach is unavailable on this server.", false, 503);
    }
    if (new URL(request.url).search || request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new FitApiError("INVALID_REQUEST", "Use JSON without query parameters. Coach has no demo mode.", false, 400);
    }
    const body = await readCoachBody(request);
    const parsed = CoachRequestSchema.safeParse(body);
    if (!parsed.success) throw new FitApiError("INVALID_REQUEST", "Check consent, alternating messages and context length limits.", false, 400);
    validateCoachSafety(parsed.data);
    const guard = getFitGuardConfig();
    const config = getBedrockConfig();
    // Preserve a single paid attempt and a bounded provider timeout, even with broader fit settings.
    if (config.maxAttempts !== 1 || config.timeoutMs > 45000) {
      throw new FitApiError("AI_UNAVAILABLE", "Private Career Coach configuration is unavailable.", false, 503);
    }
    const decision = getSharedFitLimiter(guard).tryAcquire();
    if (!decision.allowed) throw new RateLimitedError(decision.reason, decision.retryAfterSeconds);
    try {
      // The only new inference call lives inside this authorized, quota-owning handler.
      const output = await invokeBedrock(COACH_SYSTEM, buildCoachPrompt(parsed.data), {
        logTag: "coach/message", maxOutputTokens: COACH_LIMITS.outputTokens,
      });
      const result = parseCoachOutput(parsed.data, output);
      return Response.json(result, { headers: { ...headers, "X-ScaleMe-Mode": "live" } });
    } finally { decision.release(); }
  } catch (error) {
    const response = errorResponse(error instanceof FitApiError ? error :
      new FitApiError("AI_UNAVAILABLE", "Private Career Coach is temporarily unavailable.", true, 503), "coach/message");
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
}

/** Streaming byte bound and independent whole-body deadline; no document values in errors. */
async function readCoachBody(request: Request): Promise<unknown> {
  const tooLarge = () => new FitApiError("INVALID_REQUEST", "The coach request is too large.", false, 413);
  if (Number(request.headers.get("content-length")) > COACH_LIMITS.bodyBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new FitApiError("INVALID_REQUEST", "A JSON body is required.", false, 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FitApiError("INVALID_REQUEST", "The request took too long to arrive.", true, 408)), COACH_LIMITS.bodyTimeoutMs);
  });
  try {
    for (;;) {
      const chunk = await Promise.race([reader.read(), timeout]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > COACH_LIMITS.bodyBytes) throw tooLarge();
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new FitApiError("INVALID_REQUEST", "The body must be valid JSON.", false, 400); }
  } finally {
    clearTimeout(timer);
    // Do not let an uncooperative source delay the safe error response.
    void reader.cancel().catch(() => {});
  }
}
