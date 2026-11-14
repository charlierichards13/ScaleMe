// Thin wrapper around the official AWS SDK (Bedrock Runtime, Converse API).
// Converse works the same way across Bedrock text models, so the model is
// chosen purely by the BEDROCK_MODEL_ID environment variable.

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { getBedrockConfig } from "./config";
import { FitApiError } from "./schemas";

// Tests replace this function with a mock. Nothing here needs real credentials until it runs.
export type ModelInvoker = (system: string, userPrompt: string) => Promise<string>;

let cachedClient: { region: string; client: BedrockRuntimeClient } | undefined;

function getClient(region: string): BedrockRuntimeClient {
  if (cachedClient?.region !== region) {
    // No credentials passed on purpose: the SDK's default provider chain finds them server-side.
    cachedClient = { region, client: new BedrockRuntimeClient({ region }) };
  }
  return cachedClient.client;
}

export const invokeBedrock: ModelInvoker = async (system, userPrompt) => {
  const config = getBedrockConfig();
  const client = getClient(config.region);

  let output: ConverseCommandOutput;
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
    throw toApiError(err);
  }

  const text = output.output?.message?.content
    ?.map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new FitApiError("INVALID_AI_RESPONSE", "The AI returned an empty response. Please retry.", true, 502);
  }
  return text;
};

// Map AWS errors to stable, safe messages. We never forward the raw AWS message
// (it can contain account details) and never log request content.
function toApiError(err: unknown): FitApiError {
  const name = err instanceof Error ? err.name : "UnknownError";
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  console.error(`[fit/analyze] Bedrock call failed: ${name}${status ? ` (HTTP ${status})` : ""}`);

  if (name === "TimeoutError" || name === "AbortError") {
    return new FitApiError("AI_UNAVAILABLE", "The AI took too long to respond. Please retry.", true, 504);
  }
  if (name === "ThrottlingException" || name === "ServiceQuotaExceededException") {
    return new FitApiError("AI_UNAVAILABLE", "The AI service is busy. Please retry in a moment.", true, 503);
  }
  if (name === "AccessDeniedException" || name === "CredentialsProviderError" || name === "UnrecognizedClientException") {
    return new FitApiError(
      "AI_UNAVAILABLE",
      "The server is not authorized to use the AI model. Check AWS credentials and model access, or use the labeled demo.",
      false,
      503,
    );
  }
  if (name === "ResourceNotFoundException" || name === "ValidationException") {
    return new FitApiError(
      "AI_UNAVAILABLE",
      "The configured AI model could not be used. Check BEDROCK_MODEL_ID and AWS_REGION.",
      false,
      503,
    );
  }
  return new FitApiError("AI_UNAVAILABLE", "AI analysis is temporarily unavailable. Please retry.", true, 503);
}
