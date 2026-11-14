// Orchestrates one analysis: build prompt -> call model -> parse -> validate -> check evidence.

import { invokeBedrock, type ModelInvoker } from "./bedrock";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import {
  DISCLAIMER,
  FitAnalysisSchema,
  FitApiError,
  type FitAnalysis,
  type FitRequest,
} from "./schemas";

export async function analyzeFit(
  request: FitRequest,
  invoke: ModelInvoker = invokeBedrock,
): Promise<FitAnalysis> {
  const raw = await invoke(SYSTEM_PROMPT, buildUserPrompt(request));
  return validateModelOutput(raw, request);
}

export function validateModelOutput(raw: string, request: FitRequest): FitAnalysis {
  const parsed = parseJson(raw);
  const result = FitAnalysisSchema.safeParse(parsed);
  if (!result.success) throw invalidResponse();
  const analysis = result.data;

  // If the caller gave us requirement ids, the model may not make up others.
  if (request.job.requirements?.length) {
    const allowed = new Set(request.job.requirements.map((r) => r.id));
    if (analysis.assessments.some((a) => !allowed.has(a.requirementId))) throw invalidResponse();
  }

  // Keep only evidence whose quote really appears in the user's text.
  const sourceText = {
    resume: normalize(request.resume.text),
    job: normalize(`${request.job.title} ${request.job.company ?? ""} ${request.job.text}`),
  };

  const assessments = analysis.assessments.map((a) => {
    const evidence = a.evidence.filter(
      (e) => e.source !== "interview" && sourceText[e.source].includes(normalize(e.quote)),
    );
    // "supported" without a verifiable resume quote is not allowed: downgrade honestly.
    const hasResumeQuote = evidence.some((e) => e.source === "resume");
    if (a.status === "supported" && !hasResumeQuote) {
      return {
        ...a,
        status: "unclear" as const,
        explanation: `${a.explanation} (Downgraded: no verifiable resume quote was found for this claim.)`.slice(0, 1000),
        evidence,
      };
    }
    return { ...a, evidence };
  });

  // The disclaimer is fixed server-side; we do not trust the model to write it.
  return { ...analysis, assessments, disclaimer: DISCLAIMER };
}

function parseJson(raw: string): unknown {
  // Models sometimes wrap JSON in ```json fences or add a sentence; take the outermost braces.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw invalidResponse();
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw invalidResponse();
  }
}

// Ignore case and whitespace differences (PDF text often has odd line breaks).
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function invalidResponse(): FitApiError {
  // Never include the raw model output: it may contain resume text.
  return new FitApiError(
    "INVALID_AI_RESPONSE",
    "The AI returned an answer in an unexpected format. Please retry.",
    true,
    502,
  );
}
