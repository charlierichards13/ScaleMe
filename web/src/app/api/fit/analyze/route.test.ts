import { beforeEach, describe, expect, it, vi } from "vitest";
import { goodModelOutput, syntheticRequest } from "@/lib/ai/fixtures";

// Replace the real AWS call. No credentials or network are used in these tests.
const invokeBedrock = vi.fn();
vi.mock("@/lib/ai/bedrock", () => ({ invokeBedrock: (...args: unknown[]) => invokeBedrock(...args) }));

import { POST } from "./route";

const call = (body: unknown, query = "") =>
  POST(
    new Request(`http://localhost/api/fit/analyze${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  invokeBedrock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
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
