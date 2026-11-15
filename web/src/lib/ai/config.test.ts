import { describe, expect, it } from "vitest";
import { getBedrockConfig, getFitGuardConfig, GUARD_DEFAULTS } from "./config";
import { FitApiError, LIVE_AI_UNAVAILABLE_MESSAGE } from "./schemas";

const aws = { AWS_REGION: "us-east-1", BEDROCK_MODEL_ID: "test-model-id" };

describe("getFitGuardConfig", () => {
  it("defaults to live AI OFF with conservative limits", () => {
    expect(getFitGuardConfig({})).toEqual({ liveEnabled: false, ...GUARD_DEFAULTS });
    expect(GUARD_DEFAULTS).toEqual({ globalPerMinute: 10, dailyLimit: 50, maxConcurrent: 2 });
  });

  it.each(["true", "TRUE", " true "])("enables live AI only for %j", (v) => {
    expect(getFitGuardConfig({ FIT_LIVE_AI_ENABLED: v }).liveEnabled).toBe(true);
  });

  it.each(["", "false", "1", "yes", "on", "truee"])("keeps live AI off for %j", (v) => {
    expect(getFitGuardConfig({ FIT_LIVE_AI_ENABLED: v }).liveEnabled).toBe(false);
  });

  it("accepts valid overrides", () => {
    const cfg = getFitGuardConfig({
      FIT_RATE_LIMIT_GLOBAL_PER_MIN: "3",
      FIT_DAILY_CALL_LIMIT: "20",
      FIT_MAX_CONCURRENT: "1",
    });
    expect(cfg).toMatchObject({ globalPerMinute: 3, dailyLimit: 20, maxConcurrent: 1 });
  });

  it.each([
    ["FIT_RATE_LIMIT_GLOBAL_PER_MIN", "0"],
    ["FIT_RATE_LIMIT_GLOBAL_PER_MIN", "601"],
    ["FIT_RATE_LIMIT_GLOBAL_PER_MIN", "-5"],
    ["FIT_DAILY_CALL_LIMIT", "1.5"],
    ["FIT_DAILY_CALL_LIMIT", "10abc"],
    ["FIT_DAILY_CALL_LIMIT", "1e3"],
    ["FIT_DAILY_CALL_LIMIT", "10001"],
    ["FIT_MAX_CONCURRENT", "unlimited"],
    ["FIT_MAX_CONCURRENT", "21"],
  ])("fails closed (503, not retryable) for %s=%j with a generic client message", (name, value) => {
    let err: unknown;
    try {
      getFitGuardConfig({ [name]: value });
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "AI_UNAVAILABLE", status: 503, retryable: false });
    const e = err as FitApiError;
    expect(e.message).toBe(LIVE_AI_UNAVAILABLE_MESSAGE); // no variable names or values for clients
    // Server log names the variable and range in a fixed shape, so the set value cannot be echoed.
    expect(e.internalReason).toMatch(new RegExp(`^invalid setting: ${name} must be an integer from \\d+ to \\d+$`));
  });
});

describe("getBedrockConfig maxAttempts", () => {
  it("defaults to 1 (no automatic SDK retries)", () => {
    expect(getBedrockConfig(aws).maxAttempts).toBe(1);
  });

  it("allows 2 but rejects larger or invalid values", () => {
    expect(getBedrockConfig({ ...aws, BEDROCK_MAX_ATTEMPTS: "2" }).maxAttempts).toBe(2);
    for (const v of ["3", "0"]) {
      expect(() => getBedrockConfig({ ...aws, BEDROCK_MAX_ATTEMPTS: v })).toThrow(FitApiError);
      try {
        getBedrockConfig({ ...aws, BEDROCK_MAX_ATTEMPTS: v });
      } catch (e) {
        expect((e as FitApiError).internalReason).toContain("BEDROCK_MAX_ATTEMPTS");
      }
    }
  });
});
