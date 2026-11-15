// Server-only configuration. Values come from environment variable NAMES;
// no model ID or credential is hardcoded. AWS credentials are NOT read here:
// the AWS SDK finds them itself (profile, SSO, or an attached role).

import { FitApiError } from "./schemas";

export type BedrockConfig = {
  region: string;
  modelId: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

export function getBedrockConfig(env: Record<string, string | undefined> = process.env): BedrockConfig {
  const region = env.AWS_REGION?.trim();
  const modelId = env.BEDROCK_MODEL_ID?.trim();

  if (!region || !modelId) {
    // Safe message: names the variables, never their values.
    throw new FitApiError(
      "AI_UNAVAILABLE",
      "AI analysis is not configured on this server (AWS_REGION and BEDROCK_MODEL_ID are required). You can try the labeled demo instead.",
      false,
      503,
    );
  }

  return {
    region,
    modelId,
    timeoutMs: positiveInt(env.BEDROCK_TIMEOUT_MS, 45_000),
    maxOutputTokens: positiveInt(env.BEDROCK_MAX_OUTPUT_TOKENS, 3_000),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
