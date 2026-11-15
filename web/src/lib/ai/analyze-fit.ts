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

  // Advice lists are model prose. Drop (never rewrite) items that state numbers the inputs
  // do not contain, or that tell the candidate to add experience without a "true for you" condition.
  // Requirement ids (e.g. "r1") and requirement descriptions may be quoted in advice without
  // counting as invented numbers.
  const requirementText = (request.job.requirements ?? []).map((r) => `${r.id} ${r.description}`).join(" ");
  const ids = analysis.assessments.map((a) => a.requirementId);
  const resumeNumbers = numbersIn(sourceText.resume);
  const inputNumbers = new Set([...resumeNumbers, ...numbersIn(`${sourceText.job} ${requirementText}`)]);
  const known = (item: string, allowed: Set<string>) => onlyKnownNumbers(withoutIds(item, ids), allowed);
  const strengths = analysis.strengths.filter((s) => known(s, resumeNumbers));
  const clarificationQuestions = analysis.clarificationQuestions.filter((q) => known(q, inputNumbers));
  const growthSuggestions = analysis.growthSuggestions.filter(
    (g) => known(g, inputNumbers) && !suggestsUnconditionalClaim(g),
  );

  // The disclaimer is fixed server-side; we do not trust the model to write it.
  return { ...analysis, assessments, strengths, clarificationQuestions, growthSuggestions, disclaimer: DISCLAIMER };
}

// Digit sequences such as 40, 3.5 or 2027 (a trailing % or $ prefix does not matter).
function numbersIn(text: string): Set<string> {
  return new Set(text.match(/\d+(?:[.,]\d+)*/g) ?? []);
}

function withoutIds(item: string, ids: string[]): string {
  return ids.reduce((text, id) => text.split(id).join(" "), item);
}

/** True when every number in `item` also appears in the allowed source text. */
function onlyKnownNumbers(item: string, allowed: Set<string>): boolean {
  return [...numbersIn(item)].every((n) => allowed.has(n));
}

// "Add/list/highlight ... experience/skills/achievements/metrics ..." with no condition such as
// "if you have" tells the candidate to claim something the resume does not show.
const CLAIM_VERB = /\b(add|adding|include|including|list|listing|mention|mentioning|highlight|highlighting|claim|claiming|showcase|showcasing)\b/i;
const CLAIM_OBJECT = /\b(experience|experiences|skills?|expertise|proficiency|achievements?|accomplishments?|metrics?|results?|numbers?)\b/i;
const CONDITION = /\b(if|whether|only when|assuming)\b/i;

function suggestsUnconditionalClaim(suggestion: string): boolean {
  const verb = suggestion.search(CLAIM_VERB);
  if (verb === -1 || CONDITION.test(suggestion)) return false;
  return CLAIM_OBJECT.test(suggestion.slice(verb));
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
