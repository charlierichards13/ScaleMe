// Orchestrates one interview coach turn:
// plan (deterministic, server) -> prompt -> one model call -> parse -> validate -> response.
// Focus, target requirement and canFinish always come from the server plan. The model only
// supplies `coachMessage`, and that text must pass the checks below or the turn fails with a
// safe 502. There is no scripted substitute for rejected live output.

import { normalize, numbersIn, parseJson } from "./analyze-fit";
import { invokeBedrock, type ModelInvoker } from "./bedrock";
import { selectNextTurn, type SelectedTurn } from "./interview-plan";
import { buildInterviewPrompt, INTERVIEW_SYSTEM_PROMPT } from "./interview-prompt";
import {
  INTERVIEW_LIMITS,
  InterviewModelOutputSchema,
  type InterviewRequest,
  type InterviewResponse,
} from "./interview-schemas";
import { FitApiError } from "./schemas";

export const INTERVIEW_LOG_TAG = "interview/next";

export async function nextInterviewTurn(
  request: InterviewRequest,
  invoke: ModelInvoker = invokeBedrock,
  selected: SelectedTurn = selectNextTurn(request),
): Promise<InterviewResponse> {
  const raw = await invoke(INTERVIEW_SYSTEM_PROMPT, buildInterviewPrompt(request, selected), {
    logTag: INTERVIEW_LOG_TAG,
    maxOutputTokens: INTERVIEW_LIMITS.maxOutputTokens,
  });
  return validateInterviewOutput(raw, request, selected);
}

// Hiring-outcome or scoring language the coach must never use (unless the inputs contain it).
const OUTCOME_CLAIM =
  /\b(hiring (probability|chances?|odds|likelihood)|chances? of (getting|being) (hired|an offer|selected)|likel(y|ihood) (to|of) (be(ing)? )?hired|hireab\w*|fit score|match score|guarantee[ds]?)\b/i;

export function validateInterviewOutput(
  raw: string,
  request: InterviewRequest,
  selected: SelectedTurn,
): InterviewResponse {
  const parsed = InterviewModelOutputSchema.safeParse(parseJson(raw));
  if (!parsed.success) throw rejected("output did not match the interview schema");
  const coachMessage = parsed.data.coachMessage.replace(/\s+/g, " ").trim();

  const questionMarks = (coachMessage.match(/\?/g) ?? []).length;
  if (selected.turn.kind === "question" && questionMarks !== 1) throw rejected("coach message must ask exactly one question");
  if (selected.turn.kind === "closing" && questionMarks !== 0) throw rejected("closing message must not ask a question");

  // Every number must already appear in candidate-provided text, the job, or the requirement
  // list. This blocks invented metrics ("about 40% faster?") and suggested figures. Requirement
  // ids ("r2") are removed first so they are not mistaken for numbers.
  const requirements = request.job.requirements ?? [];
  const sources = [
    request.resume.text,
    request.job.title,
    request.job.company ?? "",
    request.job.text,
    ...requirements.map((r) => r.description),
    ...request.history.map((t) => t.content),
  ].join(" ");
  const allowedNumbers = numbersIn(sources);
  const withoutIds = requirements.reduce(
    (text, r) => text.replace(new RegExp(`(?<![\\w.-])${escapeRegExp(r.id)}(?![\\w.-])`, "g"), " "),
    coachMessage,
  );
  if ([...numbersIn(withoutIds)].some((n) => !allowedNumbers.has(n))) {
    throw rejected("coach message contains a number not present in the inputs");
  }

  const outcome = coachMessage.match(OUTCOME_CLAIM);
  if (outcome && !normalize(sources).includes(normalize(outcome[0]))) {
    throw rejected("coach message contains hiring-outcome or score language");
  }

  const turn: InterviewResponse = {
    coachMessage,
    focus: selected.turn.focus,
    canFinish: selected.canFinish,
  };
  if (selected.turn.kind === "question" && selected.turn.target) {
    turn.targetRequirementId = selected.turn.target.id;
  }
  return turn;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rejected(internalReason: string): FitApiError {
  // Fixed reason strings only: never the model output, which may quote the resume or answers.
  return new FitApiError(
    "INVALID_AI_RESPONSE",
    "The AI returned an interview question that did not pass safety checks. Please retry.",
    true,
    502,
    `interview output rejected: ${internalReason}`,
  );
}
