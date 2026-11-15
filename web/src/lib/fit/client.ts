// Browser-safe v0.1 adapter. The existing schema module contains only Zod,
// constants and types; never import the server AI orchestrator here.
import { z } from "zod";
import {
  FitAnalysisSchema,
  type FitAnalysis,
  type FitRequest,
} from "@/lib/ai/schemas";

export type { FitAnalysis, FitRequest } from "@/lib/ai/schemas";
export type FitResult = { mode: "demo"; analysis: FitAnalysis };
export type FitClientErrorCode =
  | "LIVE_DISABLED"
  | "INVALID_REQUEST"
  | "INVALID_RESUME"
  | "INVALID_JOB"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INVALID_AI_RESPONSE"
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_RESPONSE"
  | "REQUEST_FAILED";

export class FitClientError extends Error {
  constructor(
    public code: FitClientErrorCode,
    message: string,
    public retryable = false,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "FitClientError";
  }
}

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
});
const responseSchema = z.object({ analysis: FitAnalysisSchema });

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

function responseError(
  status: number,
  body: unknown,
  delay?: number,
): FitClientError {
  const parsed = errorSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : undefined;
  const retryable = parsed.success
    ? parsed.data.error.retryable
    : status >= 500;
  // Never display raw server prose, document content, stack traces or provider errors.
  if (status === 429)
    return new FitClientError(
      "RATE_LIMITED",
      "Too many requests. Please wait before trying the fictional demo again.",
      true,
      delay ?? 30,
    );
  switch (code) {
    case "INVALID_REQUEST":
      return new FitClientError(
        code,
        "The request could not be accepted. Reset the result and try again.",
      );
    case "INVALID_RESUME":
      return new FitClientError(
        code,
        "The resume input was not accepted. Check its text and length.",
      );
    case "INVALID_JOB":
      return new FitClientError(
        code,
        "The job input was not accepted. Check the title, text and length.",
      );
    case "AI_UNAVAILABLE":
      return new FitClientError(
        code,
        "The analysis service is unavailable. No result was produced.",
        retryable,
        delay,
      );
    case "INVALID_AI_RESPONSE":
      return new FitClientError(
        code,
        "The service could not produce a usable analysis. No result was produced.",
        retryable,
        delay,
      );
    default:
      return new FitClientError(
        "REQUEST_FAILED",
        "The fictional demo could not be loaded. No result was produced.",
        retryable,
        delay,
      );
  }
}

/** Explicit demo selection only. Live requests are blocked before fetch, even
 * with valid input. Enabling live needs a separately authorized code change. */
export async function analyzeFit(
  request: { mode: "demo" } | { mode: "live"; input: FitRequest },
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<FitResult> {
  if (request.mode !== "demo") {
    throw new FitClientError(
      "LIVE_DISABLED",
      "Live analysis is not available yet. Your drafts have not been sent.",
    );
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  try {
    if (controller.signal.aborted)
      throw new FitClientError("CANCELLED", "Demo request cancelled.");
    const response = await (options.fetch ?? fetch)(
      "/api/fit/analyze?demo=true",
      {
        method: "POST",
        headers: { Accept: "application/json" },
        // The server ignores the body in demo mode. Send no applicant text or cookies.
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw responseError(
        response.status,
        body,
        retryAfter(response.headers.get("Retry-After")),
      );
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success || response.headers.get("X-ScaleMe-Mode") !== "demo") {
      throw new FitClientError(
        "INVALID_RESPONSE",
        "The service returned an unexpected result. It has not been displayed.",
        true,
      );
    }
    const analysis = parsed.data.analysis;
    const ids = analysis.assessments.map((a) => a.requirementId);
    if (
      new Set(ids).size !== ids.length ||
      !analysis.summary.startsWith("DEMO:") ||
      !analysis.disclaimer.startsWith("DEMO")
    ) {
      throw new FitClientError(
        "INVALID_RESPONSE",
        "The service did not identify a valid fictional demo. It has not been displayed.",
        true,
      );
    }
    // This endpoint accepts no interview history. Job quotes cannot establish
    // candidate support. Reject inconsistent provenance instead of inflating counts.
    if (
      analysis.assessments.some(
        (a) =>
          a.evidence.some((e) => e.source === "interview") ||
          (a.status === "supported" &&
            !a.evidence.some((e) => e.source === "resume")),
      )
    ) {
      throw new FitClientError(
        "INVALID_RESPONSE",
        "The result has inconsistent evidence sources. It has not been displayed.",
        true,
      );
    }
    return { mode: "demo", analysis };
  } catch (error) {
    if (controller.signal.aborted)
      throw new FitClientError(
        timedOut ? "TIMEOUT" : "CANCELLED",
        timedOut
          ? "The fictional demo took too long. Please try again."
          : "Demo request cancelled.",
        timedOut,
      );
    if (error instanceof FitClientError) throw error;
    throw new FitClientError(
      "NETWORK",
      "Could not reach the fictional demo. Check your connection and try again.",
      true,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
