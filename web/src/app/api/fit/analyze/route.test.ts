import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goodModelOutput, syntheticRequest } from "@/lib/ai/fixtures";
import { resetSharedFitLimiter } from "@/lib/ai/rate-limit";
import { FitApiError } from "@/lib/ai/schemas";

// Replace the real AWS call. No credentials or network are used in these tests.
const invokeBedrock = vi.fn();
vi.mock("@/lib/ai/bedrock", () => ({ invokeBedrock: (...args: unknown[]) => invokeBedrock(...args) }));

import { POST } from "./route";

const call = (body: unknown, query = "", headers: Record<string, string> = {}) =>
  POST(
    new Request(`http://localhost/api/fit/analyze${query}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  invokeBedrock.mockReset();
  resetSharedFitLimiter();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Live mode explicitly enabled with synthetic (fake) AWS settings; the Bedrock call itself is mocked.
  vi.stubEnv("FIT_LIVE_AI_ENABLED", "true");
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("BEDROCK_MODEL_ID", "test-model-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("POST /api/fit/analyze", () => {
  it("returns { analysis } for a valid request", async () => {
    invokeBedrock.mockResolvedValue(JSON.stringify(goodModelOutput));
    const res = await call(syntheticRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-ScaleMe-Mode")).toBe("live");
    const json = await res.json();
    expect(json.analysis.assessments[0].requirementId).toBe("r1");
  });

  it("demo mode returns a labeled sample without calling AWS", async () => {
    const res = await call("not even json", "?demo=true");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-ScaleMe-Mode")).toBe("demo");
    const json = await res.json();
    expect(json.analysis.summary).toMatch(/^DEMO/);
    expect(json.analysis.disclaimer).toMatch(/DEMO/);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{oops", 400, "INVALID_REQUEST"],
    ["missing resume", { job: syntheticRequest.job }, 400, "INVALID_RESUME"],
    ["empty resume text", { ...syntheticRequest, resume: { id: "r", text: "   " } }, 400, "INVALID_RESUME"],
    ["missing job", { resume: syntheticRequest.resume }, 400, "INVALID_JOB"],
    ["oversized job", { ...syntheticRequest, job: { ...syntheticRequest.job, text: "x".repeat(20_001) } }, 400, "INVALID_JOB"],
    ["huge body", "x".repeat(250_000), 413, "INVALID_REQUEST"],
  ])("rejects %s without calling AWS", async (_name, body, status, code) => {
    const res = await call(body);
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("stops reading a chunked body without Content-Length once it passes the limit", async () => {
    const chunk = new TextEncoder().encode("x".repeat(100_000));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent++;
        controller.enqueue(chunk); // endless stream: only the size cap can stop us
      },
    });
    const req = new Request("http://localhost/api/fit/analyze", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(10);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("returns INVALID_AI_RESPONSE (502) for garbage model output without leaking it", async () => {
    invokeBedrock.mockResolvedValue("Alex Example secret resume text, not JSON");
    const res = await call(syntheticRequest);
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("INVALID_AI_RESPONSE");
    expect(text).not.toContain("Alex Example");
  });

  it("returns a safe 500 for unexpected errors and never logs resume text", async () => {
    invokeBedrock.mockRejectedValue(new Error("boom: Alex Example"));
    const res = await call(syntheticRequest);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Alex Example");
  });
});

// A model call we can finish by hand, to hold concurrency slots open.
function deferredCall() {
  let resolve!: (v: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const good = JSON.stringify(goodModelOutput);
const timeoutError = () => new FitApiError("AI_UNAVAILABLE", "The AI took too long to respond.", true, 504);

describe("POST /api/fit/analyze: live AI switch", () => {
  it.each([[undefined], ["false"], ["1"], ["yes"]])(
    "returns 503 and never calls Bedrock when FIT_LIVE_AI_ENABLED=%j",
    async (value) => {
      vi.stubEnv("FIT_LIVE_AI_ENABLED", value);
      const res = await call(syntheticRequest);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatchObject({ code: "AI_UNAVAILABLE", retryable: false });
      // Client gets a generic message; the reason is only in the server log.
      expect(json.error.message).not.toMatch(/FIT_|AWS_|BEDROCK_/);
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).toContain("live AI disabled");
      expect(invokeBedrock).not.toHaveBeenCalled();
    },
  );

  it("still validates input first when live AI is off (400, not 503)", async () => {
    vi.stubEnv("FIT_LIVE_AI_ENABLED", "false");
    expect((await call("{oops")).status).toBe(400);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("demo mode works with live AI off and no AWS settings at all", async () => {
    vi.stubEnv("FIT_LIVE_AI_ENABLED", undefined);
    vi.stubEnv("AWS_REGION", undefined);
    vi.stubEnv("BEDROCK_MODEL_ID", undefined);
    const res = await call(syntheticRequest, "?demo=true");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-ScaleMe-Mode")).toBe("demo");
    expect((await res.json()).analysis.summary).toMatch(/^DEMO/);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("missing AWS settings return 503 and do not use up the call budget", async () => {
    vi.stubEnv("FIT_DAILY_CALL_LIMIT", "1");
    vi.stubEnv("BEDROCK_MODEL_ID", "");
    for (let i = 0; i < 3; i++) expect((await call(syntheticRequest)).status).toBe(503);
    expect(invokeBedrock).not.toHaveBeenCalled();
    vi.stubEnv("BEDROCK_MODEL_ID", "test-model-id");
    invokeBedrock.mockResolvedValue(good);
    expect((await call(syntheticRequest)).status).toBe(200);
  });

  it("fails closed with 503 when a limit variable is invalid, without calling Bedrock", async () => {
    vi.stubEnv("FIT_MAX_CONCURRENT", "lots");
    const res = await call(syntheticRequest);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatchObject({ code: "AI_UNAVAILABLE", retryable: false });
    expect(json.error.message).not.toMatch(/lots|FIT_/);
    const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logs).toContain("invalid setting: FIT_MAX_CONCURRENT");
    expect(logs).not.toContain("lots");
    expect(invokeBedrock).not.toHaveBeenCalled();
  });
});

describe("POST /api/fit/analyze: cost guard", () => {
  it("allows a burst of 10 per minute (default), then returns 429 RATE_LIMITED without calling Bedrock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    invokeBedrock.mockResolvedValue(good);

    for (let i = 0; i < 10; i++) expect((await call(syntheticRequest)).status).toBe(200);
    const res = await call(syntheticRequest);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many analysis requests right now. Please wait and retry, or use the labeled demo.",
        retryable: true,
      },
    });
    expect(invokeBedrock).toHaveBeenCalledTimes(10);

    vi.setSystemTime(new Date("2026-11-14T12:01:00Z"));
    expect((await call(syntheticRequest)).status).toBe(200);
  });

  it("enforces the daily cap (default 50) across minutes and resets after 24 hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let t = Date.parse("2026-11-14T00:00:00Z");
    vi.setSystemTime(t);
    invokeBedrock.mockResolvedValue(good);

    for (let i = 0; i < 50; i++) {
      expect((await call(syntheticRequest)).status).toBe(200);
      t += 10_000; // 6 per minute: under the minute limit, so only the daily cap applies
      vi.setSystemTime(t);
    }
    const res = await call(syntheticRequest);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(23 * 3600);
    expect(invokeBedrock).toHaveBeenCalledTimes(50);

    vi.setSystemTime(Date.parse("2026-11-15T00:00:01Z"));
    expect((await call(syntheticRequest)).status).toBe(200);
  });

  it("allows only 2 concurrent model calls (default); the 3rd is rejected at once and a slot reopens", async () => {
    const first = deferredCall();
    const second = deferredCall();
    invokeBedrock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const p1 = call(syntheticRequest);
    const p2 = call(syntheticRequest);
    await flush();
    expect(invokeBedrock).toHaveBeenCalledTimes(2);

    const third = await call(syntheticRequest);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBe("5");
    expect(invokeBedrock).toHaveBeenCalledTimes(2);

    first.resolve(good);
    expect((await p1).status).toBe(200);

    invokeBedrock.mockResolvedValueOnce(good);
    expect((await call(syntheticRequest)).status).toBe(200);
    second.resolve(good);
    expect((await p2).status).toBe(200);
    expect(invokeBedrock).toHaveBeenCalledTimes(3);
  });

  it("a parallel flood of 25 requests makes at most 2 model calls", async () => {
    const pending = deferredCall();
    invokeBedrock.mockReturnValue(pending.promise);
    const all = Promise.all(Array.from({ length: 25 }, () => call(syntheticRequest)));
    await flush();
    expect(invokeBedrock).toHaveBeenCalledTimes(2);
    pending.resolve(good);
    const statuses = (await all).map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(23);
  });

  it.each([
    ["a Bedrock timeout", () => invokeBedrock.mockRejectedValueOnce(timeoutError()), 504],
    ["an AWS throttle", () => invokeBedrock.mockRejectedValueOnce(new FitApiError("AI_UNAVAILABLE", "busy", true, 503)), 503],
    ["invalid model output", () => invokeBedrock.mockResolvedValueOnce("not json"), 502],
    ["an unexpected exception", () => invokeBedrock.mockRejectedValueOnce(new TypeError("boom")), 500],
  ])("releases the concurrency slot after %s", async (_name, arrange, status) => {
    vi.stubEnv("FIT_MAX_CONCURRENT", "1");
    arrange();
    expect((await call(syntheticRequest)).status).toBe(status);
    invokeBedrock.mockResolvedValueOnce(good);
    expect((await call(syntheticRequest)).status).toBe(200);
  });

  it("counts failed model calls against the budget (they may still be billed)", async () => {
    vi.stubEnv("FIT_DAILY_CALL_LIMIT", "2");
    invokeBedrock.mockRejectedValue(timeoutError());
    expect((await call(syntheticRequest)).status).toBe(504);
    expect((await call(syntheticRequest)).status).toBe(504);
    expect((await call(syntheticRequest)).status).toBe(429);
    expect(invokeBedrock).toHaveBeenCalledTimes(2);
  });

  it("malformed, oversized and invalid requests do not use up the budget", async () => {
    vi.stubEnv("FIT_DAILY_CALL_LIMIT", "1");
    const bad = ["{oops", "x".repeat(250_000), { job: syntheticRequest.job }, { resume: syntheticRequest.resume }];
    for (let i = 0; i < 5; i++) for (const b of bad) expect((await call(b)).status).toBeGreaterThanOrEqual(400);
    expect(invokeBedrock).not.toHaveBeenCalled();
    invokeBedrock.mockResolvedValue(good);
    expect((await call(syntheticRequest)).status).toBe(200);
    expect((await call(syntheticRequest)).status).toBe(429);
  });

  it("ignores client-supplied IP headers: forging X-Forwarded-For cannot get a separate quota", async () => {
    vi.stubEnv("FIT_RATE_LIMIT_GLOBAL_PER_MIN", "2");
    invokeBedrock.mockResolvedValue(good);
    const forged = (ip: string) => ({ "x-forwarded-for": ip, "x-real-ip": ip, forwarded: `for=${ip}` });
    expect((await call(syntheticRequest, "", forged("203.0.113.1"))).status).toBe(200);
    expect((await call(syntheticRequest, "", forged("203.0.113.2"))).status).toBe(200);
    expect((await call(syntheticRequest, "", forged("203.0.113.3"))).status).toBe(429);
    expect(invokeBedrock).toHaveBeenCalledTimes(2);
  });

  it("demo mode keeps working when the live budget is exhausted, and does not count against it", async () => {
    vi.stubEnv("FIT_DAILY_CALL_LIMIT", "1");
    invokeBedrock.mockResolvedValue(good);
    expect((await call(syntheticRequest)).status).toBe(200);
    expect((await call(syntheticRequest)).status).toBe(429);
    for (let i = 0; i < 20; i++) expect((await call(syntheticRequest, "?demo=true")).status).toBe(200);
    expect(invokeBedrock).toHaveBeenCalledTimes(1);
  });

  it("logs only the limit type on 429: no IPs, headers or resume text", async () => {
    vi.stubEnv("FIT_RATE_LIMIT_GLOBAL_PER_MIN", "1");
    invokeBedrock.mockResolvedValue(good);
    await call(syntheticRequest, "", { "x-forwarded-for": "198.51.100.77" });
    const res = await call(syntheticRequest, "", { "x-forwarded-for": "198.51.100.77" });
    expect(res.status).toBe(429);
    const logs = JSON.stringify([vi.mocked(console.warn).mock.calls, vi.mocked(console.error).mock.calls]);
    expect(logs).toContain("Rate limited: minute");
    expect(logs).not.toContain("198.51.100.77");
    expect(logs).not.toContain(syntheticRequest.resume.text.slice(0, 20));
    // The client learns only that it was limited, not which limit or its size.
    expect(JSON.stringify(await res.json())).not.toMatch(/198\.51|minute|daily|concurren/i);
  });
});
