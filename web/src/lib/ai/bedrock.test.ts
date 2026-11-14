import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AWS SDK client so no network or credentials are involved.
const send = vi.fn();
vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: class {
    send = send;
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

describe("invokeBedrock", () => {
  it("returns the model text and sends the configured model id", async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: "{}" }] } } });
    await expect(invokeBedrock("sys", "user")).resolves.toBe("{}");
    expect(send.mock.calls[0][0].input.modelId).toBe("test-model-id");
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
  });
});

describe("getBedrockConfig", () => {
  it("applies defaults and ignores invalid numeric overrides", () => {
    const cfg = getBedrockConfig({ AWS_REGION: "r", BEDROCK_MODEL_ID: "m", BEDROCK_TIMEOUT_MS: "abc" });
    expect(cfg).toMatchObject({ region: "r", modelId: "m", timeoutMs: 45_000 });
  });
});
