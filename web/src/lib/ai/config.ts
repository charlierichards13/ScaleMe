// Server-only configuration. Values come from environment variable NAMES;
// no model ID or credential is hardcoded. AWS credentials are NOT read here:
// the AWS SDK finds them itself (profile, SSO, or an attached role).

import { FitApiError, LIVE_AI_UNAVAILABLE_MESSAGE } from "./schemas";

export type BedrockConfig = {
  region: string;
  modelId: string;
  timeoutMs: number;
  maxOutputTokens: number;
  /** Total AWS SDK attempts per request (1 = no automatic retry). */
  maxAttempts: number;
};

/** Cost guard for live (paid) model calls. Limits are per server process: see docs/security/THREAT_MODEL.md. */
export type FitGuardConfig = {
  liveEnabled: boolean;
  globalPerMinute: number;
  dailyLimit: number;
  maxConcurrent: number;
};

type Env = Record<string, string | undefined>;

export function getBedrockConfig(env: Env = process.env): BedrockConfig {
  const region = env.AWS_REGION?.trim();
  const modelId = env.BEDROCK_MODEL_ID?.trim();

  if (!region || !modelId) {
    // Generic client message; the server log names the missing variables (never their values).
    throw new FitApiError(
      "AI_UNAVAILABLE",
      LIVE_AI_UNAVAILABLE_MESSAGE,
      false,
      503,
      "not configured: AWS_REGION and BEDROCK_MODEL_ID are required",
    );
  }

  return {
    region,
    modelId,
    timeoutMs: positiveInt(env.BEDROCK_TIMEOUT_MS, 45_000),
    maxOutputTokens: positiveInt(env.BEDROCK_MAX_OUTPUT_TOKENS, 3_000),
    maxAttempts: boundedInt(env, "BEDROCK_MAX_ATTEMPTS", 1, 1, 2),
  };
}

// Defaults are deliberately conservative for a private hackathon demo.
export const GUARD_DEFAULTS = { globalPerMinute: 10, dailyLimit: 50, maxConcurrent: 2 } as const;

export function getFitGuardConfig(env: Env = process.env): FitGuardConfig {
  return {
    // Real Bedrock calls need explicit activation: only the exact value "true" turns them on.
    liveEnabled: env.FIT_LIVE_AI_ENABLED?.trim().toLowerCase() === "true",
    globalPerMinute: boundedInt(env, "FIT_RATE_LIMIT_GLOBAL_PER_MIN", GUARD_DEFAULTS.globalPerMinute, 1, 600),
    dailyLimit: boundedInt(env, "FIT_DAILY_CALL_LIMIT", GUARD_DEFAULTS.dailyLimit, 1, 10_000),
    maxConcurrent: boundedInt(env, "FIT_MAX_CONCURRENT", GUARD_DEFAULTS.maxConcurrent, 1, 20),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Unset/blank -> default. Set but not an integer within [min, max] -> fail closed:
// a typo in a cost limit must not silently fall back to "allow".
function boundedInt(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < min || n > max) {
    // Log the variable NAME and allowed range only, never the value that was set.
    throw new FitApiError(
      "AI_UNAVAILABLE",
      LIVE_AI_UNAVAILABLE_MESSAGE,
      false,
      503,
      `invalid setting: ${name} must be an integer from ${min} to ${max}`,
    );
  }
  return n;
}
