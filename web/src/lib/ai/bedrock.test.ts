import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AWS SDK client so no network or credentials are involved.
const send = vi.fn();
const clientConfigs: unknown[] = [];
vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: class {
    send = send;
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { invokeBedrock } from "./bedrock";
import { getBedrockConfig } from "./config";

const awsError = (name: string) => Object.assign(new Error("raw AWS detail arn:aws:secret"), { name });

beforeEach(() => {
  send.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("BEDROCK_MODEL_ID", "test-model-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invokeBedrock", () => {
  it("returns the model text and sends the configured model id", async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: "{}" }] } } });
    await expect(invokeBedrock("sys", "user")).resolves.toBe("{}");
    expect(send.mock.calls[0][0].input.modelId).toBe("test-model-id");
  });

  it("builds the SDK client with maxAttempts 1 by default (no hidden paid retries)", async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: "{}" }] } } });
    await invokeBedrock("sys", "user");
    expect(clientConfigs.at(-1)).toMatchObject({ region: "us-east-1", maxAttempts: 1 });
  });

  it("our code sends once per request even when throttled (no app-level retry loop)", async () => {
    send.mockRejectedValue(awsError("ThrottlingException"));
    await invokeBedrock("s", "u").catch(() => {});
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the client when BEDROCK_MAX_ATTEMPTS changes", async () => {
    vi.stubEnv("BEDROCK_MAX_ATTEMPTS", "2");
    send.mockResolvedValue({ output: { message: { content: [{ text: "{}" }] } } });
    await invokeBedrock("s", "u");
    expect(clientConfigs.at(-1)).toMatchObject({ maxAttempts: 2 });
  });

  it("fails clearly when configuration is missing", async () => {
    vi.stubEnv("BEDROCK_MODEL_ID", "");
    await expect(invokeBedrock("s", "u")).rejects.toMatchObject({ code: "AI_UNAVAILABLE", retryable: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("treats empty model output as INVALID_AI_RESPONSE", async () => {
    send.mockResolvedValue({ output: { message: { content: [] } } });
    await expect(invokeBedrock("s", "u")).rejects.toMatchObject({ code: "INVALID_AI_RESPONSE" });
  });

  it.each([
    ["TimeoutError", 504, true],
    ["ThrottlingException", 503, true],
    ["AccessDeniedException", 503, false],
    ["ValidationException", 503, false],
    ["SomethingElse", 503, true],
  ])("maps %s to a safe error without the raw AWS message", async (name, status, retryable) => {
    send.mockRejectedValue(awsError(name));
    const err = await invokeBedrock("s", "u").catch((e) => e);
    expect(err).toMatchObject({ code: "AI_UNAVAILABLE", status, retryable });
    expect(err.message).not.toContain("arn:aws");
    expect(err.message).not.toMatch(/AWS_|BEDROCK_|credential/i); // troubleshooting stays server-side
    expect(err.internalReason ?? "").not.toContain("arn:aws");
  });
});

describe("usage metrics logging", () => {
  const CANARY = "CANARY-Jordan-Sample-resume-text";

  it("logs numeric token counts and latency only, never prompts or model output", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockResolvedValue({
      output: { message: { content: [{ text: `{"echo":"${CANARY}"}` }] } },
      usage: { inputTokens: 812, outputTokens: 256, totalTokens: 1068 },
      metrics: { latencyMs: 2345.6 },
      stopReason: "end_turn",
    });
    await invokeBedrock(`system ${CANARY}`, `user ${CANARY}`);
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line).toMatch(
      /^\[fit\/analyze\] Bedrock usage: inputTokens=812 outputTokens=256 totalTokens=1068 modelLatencyMs=2346 wallMs=\d+ truncated=0$/,
    );
    expect(line).not.toContain(CANARY);
    expect(line).not.toContain("test-model-id");
    info.mockRestore();
  });

  it("flags truncated output and tolerates missing or non-numeric metrics", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockResolvedValue({
      output: { message: { content: [{ text: "{}" }] } },
      usage: { inputTokens: "lots", outputTokens: Number.NaN },
      stopReason: "max_tokens",
    });
    await invokeBedrock("s", "u");
    expect(String(info.mock.calls[0][0])).toMatch(
      /inputTokens=n\/a outputTokens=n\/a totalTokens=n\/a modelLatencyMs=n\/a wallMs=\d+ truncated=1$/,
    );
    info.mockRestore();
  });

  it("logs usage even when the reply is empty, and only elapsed time on AWS errors", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockResolvedValueOnce({ output: { message: { content: [] } }, usage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 } });
    await invokeBedrock("s", "u").catch(() => {});
    expect(String(info.mock.calls[0][0])).toContain("inputTokens=5");

    send.mockRejectedValueOnce(awsError("ThrottlingException"));
    await invokeBedrock("s", "u").catch(() => {});
    const errLine = String(vi.mocked(console.error).mock.calls.at(-1)?.[0]);
    expect(errLine).toMatch(/^\[fit\/analyze\] Bedrock call failed: ThrottlingException wallMs=\d+$/);
    expect(errLine).not.toContain("arn:aws");
    info.mockRestore();
  });

  it("uses the caller's fixed log tag for usage and failure lines", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockResolvedValueOnce({ output: { message: { content: [{ text: "{}" }] } } });
    await invokeBedrock("s", "u", { logTag: "interview/next" });
    expect(String(info.mock.calls[0][0])).toMatch(/^\[interview\/next\] Bedrock usage:/);

    send.mockRejectedValueOnce(awsError("ThrottlingException"));
    await invokeBedrock("s", "u", { logTag: "interview/next" }).catch(() => {});
    expect(String(vi.mocked(console.error).mock.calls.at(-1)?.[0])).toMatch(/^\[interview\/next\] Bedrock call failed:/);
    info.mockRestore();
  });
});

describe("per-call output-token cap", () => {
  it("lowers maxTokens for the call but never raises it above BEDROCK_MAX_OUTPUT_TOKENS", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockResolvedValue({ output: { message: { content: [{ text: "{}" }] } } });
    await invokeBedrock("s", "u");
    expect(send.mock.lastCall?.[0].input.inferenceConfig.maxTokens).toBe(3000);
    await invokeBedrock("s", "u", { maxOutputTokens: 400 });
    expect(send.mock.lastCall?.[0].input.inferenceConfig.maxTokens).toBe(400);
    vi.stubEnv("BEDROCK_MAX_OUTPUT_TOKENS", "300");
    await invokeBedrock("s", "u", { maxOutputTokens: 400 });
    expect(send.mock.lastCall?.[0].input.inferenceConfig.maxTokens).toBe(300);
  });
});

describe("getBedrockConfig", () => {
  it("applies defaults and ignores invalid numeric overrides", () => {
    const cfg = getBedrockConfig({ AWS_REGION: "r", BEDROCK_MODEL_ID: "m", BEDROCK_TIMEOUT_MS: "abc" });
    expect(cfg).toMatchObject({ region: "r", modelId: "m", timeoutMs: 45_000 });
  });
});
