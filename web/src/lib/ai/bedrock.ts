// Thin wrapper around the official AWS SDK (Bedrock Runtime, Converse API).
// Converse works the same way across Bedrock text models, so the model is
// chosen purely by the BEDROCK_MODEL_ID environment variable.

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { getBedrockConfig } from "./config";
import { FitApiError, LIVE_AI_UNAVAILABLE_MESSAGE } from "./schemas";

// Tests replace this function with a mock. Nothing here needs real credentials until it runs.
export type ModelInvoker = (system: string, userPrompt: string) => Promise<string>;

let cachedClient: { region: string; maxAttempts: number; client: BedrockRuntimeClient } | undefined;

function getClient(region: string, maxAttempts: number): BedrockRuntimeClient {
  if (cachedClient?.region !== region || cachedClient.maxAttempts !== maxAttempts) {
    // No credentials passed on purpose: the SDK's default provider chain finds them server-side.
    // maxAttempts defaults to 1: the SDK would otherwise retry on its own (default 3 attempts),
    // turning one request into several paid model calls.
    cachedClient = { region, maxAttempts, client: new BedrockRuntimeClient({ region, maxAttempts }) };
  }
  return cachedClient.client;
}

export const invokeBedrock: ModelInvoker = async (system, userPrompt) => {
  const config = getBedrockConfig();
  const client = getClient(config.region, config.maxAttempts);

  let output: ConverseCommandOutput;
  const startedAt = performance.now();
  try {
    output = await client.send(
      new ConverseCommand({
        modelId: config.modelId,
        system: [{ text: system }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens: config.maxOutputTokens, temperature: 0.2 },
      }),
      { abortSignal: AbortSignal.timeout(config.timeoutMs) },
    );
  } catch (err) {
    throw toApiError(err, performance.now() - startedAt);
  }

  logUsage(output, performance.now() - startedAt);

  const text = output.output?.message?.content
    ?.map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new FitApiError("INVALID_AI_RESPONSE", "The AI returned an empty response. Please retry.", true, 502);
  }
  return text;
};

// Usage metrics for cost tracking: NUMBERS ONLY. Never log prompts, resume/job text,
// model output, model or account identifiers, or anything about the caller.
function logUsage(output: ConverseCommandOutput, wallMs: number): void {
  const truncated = output.stopReason === "max_tokens" ? 1 : 0;
  console.info(
    `[fit/analyze] Bedrock usage: inputTokens=${metric(output.usage?.inputTokens)} ` +
      `outputTokens=${metric(output.usage?.outputTokens)} totalTokens=${metric(output.usage?.totalTokens)} ` +
      `modelLatencyMs=${metric(output.metrics?.latencyMs)} wallMs=${metric(wallMs)} truncated=${truncated}`,
  );
}

/** A non-negative finite number, rounded; anything else (missing, string, NaN) becomes "n/a". */
export function metric(value: unknown): number | "n/a" {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : "n/a";
}

// Map AWS errors to stable, safe messages. We never forward the raw AWS message
// (it can contain account details) and never log request content.
function toApiError(err: unknown, wallMs: number): FitApiError {
  const name = err instanceof Error ? err.name : "UnknownError";
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  console.error(
    `[fit/analyze] Bedrock call failed: ${name}${status ? ` (HTTP ${status})` : ""} wallMs=${metric(wallMs)}`,
  );

  if (name === "TimeoutError" || name === "AbortError") {
    return new FitApiError("AI_UNAVAILABLE", "The AI took too long to respond. Please retry.", true, 504);
  }
  if (name === "ThrottlingException" || name === "ServiceQuotaExceededException") {
    return new FitApiError("AI_UNAVAILABLE", "The AI service is busy. Please retry in a moment.", true, 503);
  }
  if (name === "AccessDeniedException" || name === "CredentialsProviderError" || name === "UnrecognizedClientException") {
    // Generic to the client; the AWS error name is already in the server log above.
    return new FitApiError("AI_UNAVAILABLE", LIVE_AI_UNAVAILABLE_MESSAGE, false, 503,
      "not authorized: check the server's AWS credentials and Bedrock model access");
  }
  if (name === "ResourceNotFoundException" || name === "ValidationException") {
    return new FitApiError("AI_UNAVAILABLE", LIVE_AI_UNAVAILABLE_MESSAGE, false, 503,
      "model unusable: check BEDROCK_MODEL_ID and AWS_REGION");
  }
  return new FitApiError("AI_UNAVAILABLE", "AI analysis is temporarily unavailable. Please retry.", true, 503);
}
