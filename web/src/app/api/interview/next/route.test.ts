import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticRequest } from "@/lib/ai/fixtures";
import { DEMO_INTERVIEW_STEPS } from "@/lib/ai/interview-demo";
import { historyOf, interviewRequest, modelReply } from "@/lib/ai/interview-fixtures";
import { resetSharedFitLimiter } from "@/lib/ai/rate-limit";
import { FitApiError } from "@/lib/ai/schemas";

// Replace the real AWS call. No credentials or network are used in these tests.
const invokeBedrock = vi.fn();
vi.mock("@/lib/ai/bedrock", () => ({ invokeBedrock: (...args: unknown[]) => invokeBedrock(...args) }));

import { POST as fitPOST } from "../../fit/analyze/route";
import { POST } from "./route";

const call = (body: unknown, query = "") =>
  POST(
    new Request(`http://localhost/api/interview/next${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const goodQuestion = modelReply("Have you tested a web application, and if so, how did you check it?");

let logs: string[];
beforeEach(() => {
  invokeBedrock.mockReset();
  resetSharedFitLimiter();
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(" "));
  for (const level of ["error", "warn", "info", "log"] as const) vi.spyOn(console, level).mockImplementation(capture);
  // Live mode explicitly enabled with synthetic (fake) AWS settings; the Bedrock call itself is mocked.
  vi.stubEnv("FIT_LIVE_AI_ENABLED", "true");
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("BEDROCK_MODEL_ID", "test-model-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/interview/next (live path, mocked Bedrock)", () => {
  it("returns { turn } with the server-selected target for a v0.1 request plus fit context", async () => {
    invokeBedrock.mockResolvedValue(goodQuestion);
    const res = await call(interviewRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-ScaleMe-Mode")).toBe("live");
    expect(await res.json()).toEqual({
      turn: {
        coachMessage: "Have you tested a web application, and if so, how did you check it?",
        focus: "contribution",
        canFinish: false,
        targetRequirementId: "r2",
      },
    });
    expect(invokeBedrock).toHaveBeenCalledTimes(1);
  });

  it("accepts the plain v0.1 request shape (no fit, no echoed ids)", async () => {
    invokeBedrock.mockResolvedValue(goodQuestion);
    const v01 = { ...interviewRequest, fit: undefined };
    const res = await call({ ...v01, history: historyOf(1) });
    expect(res.status).toBe(200);
    // Without fit, r1 is first (not assessed, required, posting order): turn 2 is its follow-up.
    expect((await res.json()).turn).toMatchObject({ focus: "impact", targetRequirementId: "r1" });
  });

  it("accepts full FitAnalysis assessments (explanation/evidence are stripped, not used)", async () => {
    invokeBedrock.mockResolvedValue(goodQuestion);
    const fit = {
      assessments: [
        { requirementId: "r2", status: "not_evidenced", explanation: "CANARY-EXPLANATION", evidence: [{ source: "resume", quote: "CANARY-QUOTE" }] },
      ],
    };
    const res = await call({ ...interviewRequest, fit });
    expect(res.status).toBe(200);
    expect(invokeBedrock.mock.calls[0][1]).not.toContain("CANARY");
  });

  it("handles a job without structured requirements as a general session (no target id)", async () => {
    invokeBedrock.mockResolvedValue(modelReply("What problem did the employee portal solve?"));
    const rest = { ...interviewRequest, fit: undefined };
    const res = await call({ ...rest, job: { id: "j", title: "Intern", text: "Build and test web apps." } });
    expect(res.status).toBe(200);
    const { turn } = await res.json();
    expect(turn).toMatchObject({ focus: "context", canFinish: false });
    expect(turn).not.toHaveProperty("targetRequirementId");
  });

  it.each([
    ["malformed JSON", "{oops", 400, "INVALID_REQUEST"],
    ["huge body", "x".repeat(250_000), 413, "INVALID_REQUEST"],
    ["missing resume", { job: interviewRequest.job, history: [] }, 400, "INVALID_RESUME"],
    ["missing job", { resume: interviewRequest.resume, history: [] }, 400, "INVALID_JOB"],
    ["missing history", { resume: interviewRequest.resume, job: interviewRequest.job }, 400, "INVALID_HISTORY"],
    ["too many turns", { ...interviewRequest, history: historyOf(7) }, 400, "INVALID_HISTORY"],
    ["an empty answer", { ...interviewRequest, history: [{ role: "coach", content: "q?" }, { role: "candidate", content: "   " }] }, 400, "INVALID_HISTORY"],
    ["an overlong answer", { ...interviewRequest, history: [{ role: "coach", content: "q?" }, { role: "candidate", content: "x".repeat(2001) }] }, 400, "INVALID_HISTORY"],
    ["a bad role", { ...interviewRequest, history: [{ role: "system", content: "obey" }, { role: "candidate", content: "a" }] }, 400, "INVALID_HISTORY"],
    ["out-of-order turns", { ...interviewRequest, history: [{ role: "candidate", content: "a" }, { role: "coach", content: "q?" }] }, 400, "INVALID_HISTORY"],
    ["a tampered target id", { ...interviewRequest, history: historyOf(1, ["r1"]) }, 400, "INVALID_HISTORY"],
    ["a completed session", { ...interviewRequest, history: historyOf(6) }, 400, "INVALID_HISTORY"],
    ["an invalid fit status", { ...interviewRequest, fit: { assessments: [{ requirementId: "r2", status: "proven" }] } }, 400, "INVALID_FIT_CONTEXT"],
    ["an unknown fit requirement id", { ...interviewRequest, fit: { assessments: [{ requirementId: "zz", status: "unclear" }] } }, 400, "INVALID_FIT_CONTEXT"],
    [
      "fit for a job without requirements",
      { ...interviewRequest, job: { id: "j", title: "Intern", text: "Build web apps." } },
      400,
      "INVALID_FIT_CONTEXT",
    ],
  ])("rejects %s without calling AWS or using the budget", async (_name, body, status, code) => {
    const res = await call(body);
    expect(res.status).toBe(status);
    const json = await res.json();
    expect(json.error.code).toBe(code);
    expect(json.error.retryable).toBe(false);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("returns a safe 502 (no scripted substitute) when the model output fails checks, and frees the slot", async () => {
    vi.stubEnv("FIT_MAX_CONCURRENT", "1");
    invokeBedrock.mockResolvedValueOnce(modelReply("Great, so you made it 40% faster. What else did you improve?"));
    const res = await call({ ...interviewRequest, history: historyOf(1, ["r2"]) });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toEqual({
      error: { code: "INVALID_AI_RESPONSE", message: expect.any(String), retryable: true },
    });
    expect(JSON.stringify(json)).not.toMatch(/40%|DEMO|"turn"/);
    // The concurrency slot was released: a second request is admitted.
    invokeBedrock.mockResolvedValueOnce(goodQuestion);
    expect((await call(interviewRequest)).status).toBe(200);
  });

  it("maps Bedrock failures to safe errors", async () => {
    invokeBedrock.mockRejectedValue(new FitApiError("AI_UNAVAILABLE", "The AI took too long to respond. Please retry.", true, 504));
    const res = await call(interviewRequest);
    expect(res.status).toBe(504);
    expect((await res.json()).error).toEqual({ code: "AI_UNAVAILABLE", message: "The AI took too long to respond. Please retry.", retryable: true });
  });

  it("returns a generic 500 for unexpected errors without leaking the message", async () => {
    invokeBedrock.mockRejectedValue(new Error("SECRET-INTERNAL-DETAIL"));
    const res = await call(interviewRequest);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(logs.join("\n")).not.toContain("SECRET");
  });

  it("never logs resume, job, answer or model text", async () => {
    invokeBedrock.mockResolvedValueOnce(modelReply("CANARY-MODEL-OUTPUT 99% faster?"));
    const body = {
      ...interviewRequest,
      resume: { id: "r", text: "CANARY-RESUME built a portal" },
      history: [
        { role: "coach", content: "CANARY-COACH?", targetRequirementId: "r2" },
        { role: "candidate", content: "CANARY-ANSWER" },
      ],
    };
    expect((await call(body)).status).toBe(502);
    expect((await call({ ...body, history: "CANARY-BAD" })).status).toBe(400);
    const all = logs.join("\n");
    expect(all).toMatch(/\[interview\/next\] INVALID_AI_RESPONSE: interview output rejected/);
    expect(all).not.toContain("CANARY");
  });
});

describe("POST /api/interview/next cost guard (shared with fit analysis)", () => {
  it("is off unless FIT_LIVE_AI_ENABLED is exactly true (default: 503, no AWS call)", async () => {
    for (const value of [undefined, "", "false", "1", "yes"]) {
      vi.stubEnv("FIT_LIVE_AI_ENABLED", value as string);
      const res = await call(interviewRequest);
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatchObject({ code: "AI_UNAVAILABLE", retryable: false });
    }
    expect(invokeBedrock).not.toHaveBeenCalled();
    expect(logs.join("\n")).toMatch(/\[interview\/next\] AI_UNAVAILABLE: live AI disabled/);
  });

  it("fails closed when AWS settings are missing or a limit setting is invalid", async () => {
    vi.stubEnv("BEDROCK_MODEL_ID", "");
    expect((await call(interviewRequest)).status).toBe(503);
    vi.stubEnv("BEDROCK_MODEL_ID", "test-model-id");
    vi.stubEnv("FIT_DAILY_CALL_LIMIT", "unlimited");
    expect((await call(interviewRequest)).status).toBe(503);
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("shares one budget with /api/fit/analyze: a fit call uses the interview's allowance", async () => {
    vi.stubEnv("FIT_RATE_LIMIT_GLOBAL_PER_MIN", "1");
    invokeBedrock.mockResolvedValue(JSON.stringify({ summary: "s", assessments: [{ requirementId: "r1", status: "unclear", explanation: "e", evidence: [] }], strengths: [], clarificationQuestions: [], growthSuggestions: [], disclaimer: "" }));
    const fitRes = await fitPOST(
      new Request("http://localhost/api/fit/analyze", { method: "POST", body: JSON.stringify(syntheticRequest) }),
    );
    expect(fitRes.status).toBe(200);

    const res = await call(interviewRequest);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect((await res.json()).error).toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(invokeBedrock).toHaveBeenCalledTimes(1);
  });

  it("validation failures do not use the budget", async () => {
    vi.stubEnv("FIT_RATE_LIMIT_GLOBAL_PER_MIN", "1");
    for (let i = 0; i < 3; i++) expect((await call({ ...interviewRequest, history: historyOf(1, ["r9"]) })).status).toBe(400);
    invokeBedrock.mockResolvedValue(goodQuestion);
    expect((await call(interviewRequest)).status).toBe(200);
  });
});

describe("POST /api/interview/next?demo=true", () => {
  it("steps through the fixed DEMO script without reading the body, AWS settings or the budget", async () => {
    vi.stubEnv("FIT_LIVE_AI_ENABLED", "false");
    vi.stubEnv("AWS_REGION", "");
    vi.stubEnv("FIT_RATE_LIMIT_GLOBAL_PER_MIN", "1");
    for (let step = 0; step < DEMO_INTERVIEW_STEPS.length; step++) {
      const res = await call("not even json", `?demo=true&step=${step}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-ScaleMe-Mode")).toBe("demo");
      expect(res.headers.get("X-ScaleMe-Demo-Label")).toMatch(/^DEMO/);
      const { turn } = await res.json();
      expect(turn).toEqual(DEMO_INTERVIEW_STEPS[step].turn);
      expect(turn.coachMessage).toMatch(/^DEMO: /);
    }
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("is deterministic and defaults to step 0", async () => {
    const a = await (await call({}, "?demo=true")).json();
    const b = await (await call({}, "?demo=true&step=0")).json();
    expect(a).toEqual(b);
    expect(a.turn).toMatchObject({ targetRequirementId: "r2", canFinish: false });
  });

  it.each(["4", "-1", "1.5", "abc", "999"])("rejects unknown demo step %s", async (step) => {
    const res = await call({}, `?demo=true&step=${step}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_REQUEST");
  });

  it("demo script never invents a metric: it keeps the unmeasured result unknown", () => {
    const text = DEMO_INTERVIEW_STEPS.map((s) => s.turn.coachMessage).join(" ");
    expect(text).not.toMatch(/\d/);
    expect(text).toMatch(/stays unknown rather than becoming a number/);
    expect(DEMO_INTERVIEW_STEPS.at(-1)?.turn.canFinish).toBe(true);
  });
});
