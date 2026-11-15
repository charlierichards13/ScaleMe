import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAnalysis } from "@/lib/ai/demo";
import { analyzeFit } from "./client";
import { toFitRequest } from "./draft";

// Exercise the real handler and browser adapter together. Replace the provider
// boundary so a regression can never make an AWS request from this suite.
const invokeBedrock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/bedrock", () => ({ invokeBedrock }));

import { POST } from "@/app/api/fit/analyze/route";

beforeEach(() => {
  invokeBedrock.mockReset();
  vi.stubEnv("FIT_LIVE_AI_ENABLED", undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("merged fit handler/browser contract", () => {
  it("consumes the actual no-AWS demo with live disabled and sends no drafts", async () => {
    const network = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe("/api/fit/analyze?demo=true");
      expect(init).not.toHaveProperty("body");
      const response = await POST(new Request(`http://localhost${url}`, init));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-ScaleMe-Mode")).toBe("demo");
      return response;
    });

    await expect(analyzeFit({ mode: "demo" }, { fetch: network })).resolves.toEqual({
      mode: "demo",
      analysis: demoAnalysis,
    });
    expect(network).toHaveBeenCalledOnce();
    expect(invokeBedrock).not.toHaveBeenCalled();
  });

  it("accepts prepared v0.1 drafts at the handler and safely maps its default-off 503", async () => {
    const input = toFitRequest({
      resume: "  Fictional candidate built an internal portal.  ",
      title: "  Fictional engineer  ",
      job: "  Fictional role requires web development.  ",
    });
    // Direct, in-process handler invocation only; the UI still cannot submit drafts.
    const response = await POST(new Request("http://localhost/api/fit/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
    expect(response.status).toBe(503);
    expect(await response.clone().json()).toMatchObject({
      error: { code: "AI_UNAVAILABLE", retryable: false },
    });
    const network = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(analyzeFit({ mode: "demo" }, { fetch: network })).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      retryable: false,
      message: "The analysis service is unavailable. No result was produced.",
    });
    expect(network).toHaveBeenCalledOnce();
    expect(invokeBedrock).not.toHaveBeenCalled();
  });
});
