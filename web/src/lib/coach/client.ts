import { CoachRequestSchema, CoachResponseSchema, COACH_LIMITS, type CoachRequest } from "./schema";

export class CoachError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0, public retryable = false) { super(message); }
}
const statusMessage: Record<number, string> = {
  400: "The coach could not accept this context. Check the length limits and remove instruction-like requests.",
  401: "Private access was rejected. Enter a valid owner-provided code.",
  403: "Access denied. Open the private workspace on its own origin.",
  408: "The request took too long to arrive. You may retry manually.",
  413: "This session is too large. Shorten your context or clear and start again.",
  429: "The shared AI request limit was reached. Wait, then retry manually.",
  502: "The model response could not be accepted. No reply was added.",
  503: "Private Career Coach is unavailable. An enabled, configured private server is required.",
  504: "The model timed out. It may still have incurred a charge. Retry only when ready.",
};

export async function requestCoach(input: CoachRequest, token: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new CoachError(401, statusMessage[401]);
  const parsed = CoachRequestSchema.safeParse(input);
  if (!parsed.success) throw new CoachError(400, statusMessage[400]);
  const payload = JSON.stringify(parsed.data);
  if (new TextEncoder().encode(payload).length > COACH_LIMITS.bodyBytes) throw new CoachError(413, statusMessage[413]);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(cancel, 55000);
  try {
    if (controller.signal.aborted) throw new Error("cancelled");
    const response = await fetcher("/api/coach/message", { method: "POST", cache: "no-store", credentials: "omit", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: payload, signal: controller.signal });
    const reader = response.body?.getReader();
    if (!reader) throw new CoachError(502, statusMessage[502], 0, true);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 16000) throw new CoachError(502, statusMessage[502], 0, true);
        chunks.push(chunk.value);
      }
    } finally { void reader.cancel().catch(() => {}); }
    if (controller.signal.aborted) throw new Error("cancelled");
    if (!response.ok) {
      const raw = response.headers.get("Retry-After");
      const seconds = raw && /^\d+$/.test(raw) ? Math.min(86400, Math.max(1, Number(raw))) : 1;
      throw new CoachError(response.status, statusMessage[response.status] ?? "The request failed. No reply was added.", response.status === 429 ? seconds : 0,
        response.status === 429 || response.status >= 500 || response.status === 408);
    }
    let json: unknown;
    const all = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    try { json = JSON.parse(new TextDecoder().decode(all)); } catch { throw new CoachError(502, statusMessage[502], 0, true); }
    const result = CoachResponseSchema.safeParse(json);
    if (response.headers.get("X-ScaleMe-Mode") !== "live" || !result.success) throw new CoachError(502, statusMessage[502], 0, true);
    return result.data;
  } catch (error) {
    if (error instanceof CoachError) throw error;
    throw new CoachError(0, signal.aborted
      ? "Request cancelled. An admitted model call may still complete and be billed."
      : controller.signal.aborted ? "The request timed out. It may have completed on the server. Retry manually only when ready."
      : "Could not reach the private server. Check your connection and retry manually.", 0, true);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", cancel); }
}
