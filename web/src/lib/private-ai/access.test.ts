import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { proxy, config } from "@/proxy";
import { requirePrivateAi } from "./access";
const token = "fictional_private_gate_test_token_123456";
const env = { FIT_LIVE_AI_ENABLED: "true", SCALEME_PRIVATE_AI_TOKEN: token };
const request = (headers: Record<string, string> = {}) => new Request("https://private.example/api/interview/next", { method: "POST", headers });
afterEach(() => vi.unstubAllEnvs());

describe("private paid-AI boundary", () => {
  it.each([undefined, "false", "1", "yes"])("fails closed when the live switch is %s", async setting => {
    const response = requirePrivateAi(request({ Authorization: `Bearer ${token}` }), { ...env, FIT_LIVE_AI_ENABLED: setting });
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([undefined, "", "short", "x".repeat(257), " ".repeat(40)])("fails closed for invalid private configuration", setting => {
    expect(requirePrivateAi(request(), { ...env, SCALEME_PRIVATE_AI_TOKEN: setting })?.status).toBe(503);
  });
  it.each<Record<string, string>>([{}, { Authorization: `Bearer ${"z".repeat(40)}` }, { "X-Private-Ai-Token": token }, { Cookie: `access=${token}` }, { "X-Forwarded-For": "127.0.0.1" }])("rejects anonymous, wrong or spoofed access", headers => {
    expect(requirePrivateAi(request(headers), env)?.status).toBe(401);
  });
  it("accepts the valid code and same origin, rejects cross-origin callers", () => {
    expect(requirePrivateAi(request({ Authorization: `Bearer ${token}`, Origin: "https://private.example" }), env)).toBeNull();
    expect(requirePrivateAi(request({ Authorization: `Bearer ${token}`, Origin: "https://evil.example" }), env)?.status).toBe(403);
    expect(requirePrivateAi(request({ Authorization: `Bearer ${token}`, "Sec-Fetch-Site": "cross-site" }), env)?.status).toBe(403);
  });
  it("matches all paid endpoints and leaves unrelated navigation alone", () => {
    for (const url of ["/api/fit/analyze", "/api/interview/next", "/api/interview/next/", "/api/practice/access"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
    }
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/interview" })).toBe(false);
  });
  it("permits only explicit free demos without access; access checks cannot bypass using demo=true", () => {
    vi.stubEnv("FIT_LIVE_AI_ENABLED", "false");
    for (const path of ["/api/fit/analyze?demo=true", "/api/interview/next?demo=true&step=0"]) {
      expect(proxy(new NextRequest(`https://private.example${path}`)).headers.get("x-middleware-next")).toBe("1");
    }
    expect(proxy(new NextRequest("https://private.example/api/practice/access?demo=true")).status).toBe(503);
  });
});
