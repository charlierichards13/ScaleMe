import { FitAnalysisSchema, LIMITS, type FitAnalysis, type FitRequest } from "@/lib/ai/schemas";
import { InterviewRequestSchema, type InterviewTurn } from "@/lib/ai/interview-schemas";
import { TurnResponseSchema, fitContext } from "./session";

export class ConversationError extends Error {
  constructor(public code: string, message: string, public retryable = false, public retryAfter = 0) { super(message); }
}
const messages: Record<string, string> = {
  AI_UNAVAILABLE: "Live AI is unavailable. Your session is still here. Try again only when the private environment is ready.",
  PRIVATE_ACCESS_REQUIRED: "Private access was rejected. Clear the session and unlock again with a valid code.",
  INVALID_HISTORY: "The conversation could not be continued. Finish to review collected answers, or clear and start again.",
  INVALID_FIT_CONTEXT: "The requirements and analysis do not match. Clear and analyze the job again.",
  INVALID_AI_RESPONSE: "The AI response could not be verified. Your submitted answer is retained; you can retry.",
  RATE_LIMITED: "The AI request limit was reached. Wait before manually retrying.",
  INVALID_RESUME: "Check the resume text and its length.", INVALID_JOB: "Check the job title, description and requirements.",
};
export function retrySeconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(0, seconds)) : 0;
}

export async function privateRequest(path: string, token: string, body: unknown, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new ConversationError("PRIVATE_ACCESS_REQUIRED", messages.PRIVATE_ACCESS_REQUIRED);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload && new TextEncoder().encode(payload).length > LIMITS.requestBodyBytes) {
    throw new ConversationError("TOO_LARGE", "This combined session exceeds the request limit. Shorten the resume or job and start again.");
  }
  let timedOut = false;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 55000);
  try {
    const response = await fetcher(path, { method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: payload, signal: controller.signal });
    // Bound the decoded response too, including malformed/untrusted upstream output.
    const reader = response.body?.getReader();
    let text = "", bytes = 0;
    const decoder = new TextDecoder();
    if (!reader) throw new ConversationError("INVALID_AI_RESPONSE", messages.INVALID_AI_RESPONSE, true);
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 200000) { await reader.cancel(); throw new ConversationError("INVALID_AI_RESPONSE", messages.INVALID_AI_RESPONSE, true); }
        text += decoder.decode(chunk.value, { stream: true });
      }
    } finally { reader.releaseLock(); }
    text += decoder.decode();
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new ConversationError("INVALID_AI_RESPONSE", messages.INVALID_AI_RESPONSE, true); }
    if (!response.ok) {
      const error = (json as { error?: { code?: string; retryable?: boolean } })?.error;
      const code = typeof error?.code === "string" && Object.hasOwn(messages, error.code) ? error.code : "REQUEST_FAILED";
      throw new ConversationError(code, messages[code] ?? "The request failed. Your session is retained.",
        typeof error?.retryable === "boolean" ? error.retryable : response.status >= 500 || response.status === 429,
        response.status === 429 ? Math.max(1, retrySeconds(response.headers.get("Retry-After"))) : 0);
    }
    if (path !== "/api/practice/access" && response.headers.get("X-ScaleMe-Mode") !== "live") {
      throw new ConversationError("INVALID_AI_RESPONSE", "The response was not labeled live. It has not been added to this interview.", true);
    }
    return json;
  } catch (error) {
    if (error instanceof ConversationError) throw error;
    if (signal.aborted) throw new ConversationError("CANCELLED", "Request cancelled. A request already received by the server may still complete.", true);
    throw new ConversationError(timedOut ? "TIMEOUT" : "NETWORK", timedOut
      ? "The request timed out. It may have completed on the server. Retry only when you are ready."
      : "Could not reach the server. Your session is retained; check your connection and retry.", true);
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); }
}

export async function analyzeContext(context: FitRequest, token: string, signal: AbortSignal, fetcher?: typeof fetch) {
  const json = await privateRequest("/api/fit/analyze", token, context, signal, fetcher);
  const parsed = FitAnalysisSchema.safeParse((json as { analysis?: unknown })?.analysis);
  if (!parsed.success) throw invalid();
  const ids = context.job.requirements?.map(r => r.id) ?? [];
  const got = parsed.data.assessments.map(a => a.requirementId);
  if (got.length !== ids.length || new Set(got).size !== got.length || got.some(id => !ids.includes(id))) throw invalid();
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  for (const a of parsed.data.assessments) {
    if (a.evidence.some(e => e.source === "interview" || !norm(e.source === "resume" ? context.resume.text : `${context.job.title} ${context.job.company ?? ""} ${context.job.text}`).includes(norm(e.quote)))) throw invalid();
    if (a.status === "supported" && !a.evidence.some(e => e.source === "resume")) throw invalid();
  }
  return parsed.data;
}

export async function nextQuestion(context: FitRequest, analysis: FitAnalysis, history: InterviewTurn[], token: string, signal: AbortSignal, fetcher?: typeof fetch) {
  const request = InterviewRequestSchema.safeParse({ ...context, fit: fitContext(analysis), history });
  if (!request.success) throw new ConversationError("INVALID_HISTORY", messages.INVALID_HISTORY);
  const json = await privateRequest("/api/interview/next", token, request.data, signal, fetcher);
  const parsed = TurnResponseSchema.safeParse(json);
  if (!parsed.success || (parsed.data.turn.targetRequirementId &&
    !context.job.requirements?.some(r => r.id === parsed.data.turn.targetRequirementId))) throw invalid();
  return parsed.data.turn;
}
function invalid() { return new ConversationError("INVALID_AI_RESPONSE", messages.INVALID_AI_RESPONSE, true); }
