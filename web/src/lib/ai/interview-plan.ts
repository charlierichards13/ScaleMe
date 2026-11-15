// Deterministic interview planning. The SERVER decides which requirement each coach turn
// targets and with what focus; the model only words the question. The plan is a pure function
// of the job requirements and the client's (untrusted) fit statuses, and turn k of a session is
// plan[k]. No server-side session state is needed, and nothing the model returns can change it.
//
// Client-supplied fit statuses are NOT verified evidence: they only order the questions. A client
// that lies about them can change question order, nothing else.

import type { InterviewFocus, InterviewRequest } from "./interview-schemas";
import { FitApiError, type JobPosting } from "./schemas";

/** Questions per targeted requirement: an opening question, then one narrower follow-up. */
export const QUESTIONS_PER_REQUIREMENT = 2;
/** Requirement-targeted question slots before the final reflection question. */
export const MAX_TARGETED_SLOTS = 5;
/** Candidate answers after which the client may offer "finish" (acceptance: 4–5 turns). */
export const MIN_ANSWERS_TO_FINISH = 4;

export type PriorStatus = "not_evidenced" | "unclear" | "not_assessed";

export type PlannedTarget = {
  id: string;
  description: string;
  importance: "required" | "preferred" | "unspecified";
  /** From the client's fit result (unverified), or "not_assessed" if none was sent. */
  priorStatus: PriorStatus;
};

export type PlannedTurn =
  | { kind: "question"; focus: InterviewFocus; target?: PlannedTarget; followUp: boolean }
  | { kind: "closing"; focus: "reflection" };

export type InterviewPlan = {
  /** "general": no structured requirements, or none is unresolved. No turn has a target. */
  targeting: "requirement" | "general";
  generalReason?: "no_structured_requirements" | "no_unresolved_requirements";
  /** Question turns in order. The turn after the last question is a closing turn. */
  questions: PlannedTurn[];
};

export type SelectedTurn = {
  plan: InterviewPlan;
  /** Index of the coach turn being generated (= number of coach turns already in history). */
  index: number;
  turn: PlannedTurn;
  canFinish: boolean;
};

const GENERAL_FOCUSES: InterviewFocus[] = ["context", "contribution", "tradeoffs", "impact", "reflection"];
const STATUS_RANK: Record<PriorStatus, number> = { not_evidenced: 0, unclear: 1, not_assessed: 2 };
const IMPORTANCE_RANK = { required: 0, preferred: 1, unspecified: 2 } as const;

export function buildPlan(job: JobPosting, fit: InterviewRequest["fit"]): InterviewPlan {
  const requirements = job.requirements ?? [];

  if (new Set(requirements.map((r) => r.id)).size !== requirements.length) {
    throw new FitApiError("INVALID_JOB", "Each job requirement must have a unique id.", false, 400);
  }

  if (fit) {
    // Without structured requirements we cannot check the ids the client sends back
    // (fit analysis invents "r1", "r2"... for unstructured jobs and returns no descriptions).
    if (requirements.length === 0) {
      throw invalidFit("Fit assessments can only be used when the job includes structured requirements with ids.");
    }
    const known = new Set(requirements.map((r) => r.id));
    const seen = new Set<string>();
    for (const a of fit.assessments) {
      if (!known.has(a.requirementId)) throw invalidFit("A fit assessment refers to a requirement id that is not in this job.");
      if (seen.has(a.requirementId)) throw invalidFit("Each requirement may have at most one fit assessment.");
      seen.add(a.requirementId);
    }
  }

  if (requirements.length === 0) {
    return { targeting: "general", generalReason: "no_structured_requirements", questions: generalQuestions() };
  }

  const status = new Map(fit?.assessments.map((a) => [a.requirementId, a.status]) ?? []);
  const unresolved: PlannedTarget[] = requirements
    .map((r) => ({ ...r, priorStatus: (status.get(r.id) ?? "not_assessed") as PriorStatus | "supported" }))
    .filter((r): r is typeof r & { priorStatus: PriorStatus } => r.priorStatus !== "supported")
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        STATUS_RANK[a.r.priorStatus] - STATUS_RANK[b.r.priorStatus] ||
        IMPORTANCE_RANK[a.r.importance] - IMPORTANCE_RANK[b.r.importance] ||
        a.i - b.i,
    )
    .map(({ r }) => ({ id: r.id, description: r.description, importance: r.importance, priorStatus: r.priorStatus }));

  if (unresolved.length === 0) {
    return { targeting: "general", generalReason: "no_unresolved_requirements", questions: generalQuestions() };
  }

  const questions: PlannedTurn[] = unresolved
    .flatMap((target) =>
      Array.from({ length: QUESTIONS_PER_REQUIREMENT }, (_, n) => ({
        kind: "question" as const,
        focus: (n === 0 ? "contribution" : "impact") as InterviewFocus,
        target,
        followUp: n > 0,
      })),
    )
    .slice(0, MAX_TARGETED_SLOTS);
  questions.push({ kind: "question", focus: "reflection", followUp: false });
  return { targeting: "requirement", questions };
}

/**
 * Validate the shape of `history` against the plan and choose the next coach turn.
 * Throws INVALID_HISTORY / INVALID_FIT_CONTEXT / INVALID_JOB (400) before any model call.
 */
export function selectNextTurn(request: InterviewRequest): SelectedTurn {
  const plan = buildPlan(request.job, request.fit);
  const { history } = request;

  // Coach speaks first, roles alternate, and the latest turn is the candidate's answer.
  if (history.length % 2 !== 0) {
    throw invalidHistory("History must alternate coach and candidate turns and end with a candidate answer.");
  }
  history.forEach((turn, i) => {
    const expected = i % 2 === 0 ? "coach" : "candidate";
    if (turn.role !== expected) {
      throw invalidHistory("History must alternate coach and candidate turns, starting with the coach.");
    }
    if (turn.role === "candidate" && turn.targetRequirementId !== undefined) {
      throw invalidHistory("Only coach turns may carry a targetRequirementId.");
    }
  });

  const index = history.length / 2;
  // turns[0..n-1] are questions; turns[n] is the closing turn. No coach turn exists after it.
  if (index > plan.questions.length) {
    throw invalidHistory("This interview session is already complete. Start a new session to continue practicing.");
  }

  // Echoed targetRequirementIds are optional (v0.1 clients omit them) but, when present,
  // must match what this server would have planned for that turn. A mismatch means the
  // history came from a different job/fit input or was edited.
  history.forEach((turn, i) => {
    if (turn.role !== "coach" || turn.targetRequirementId === undefined) return;
    const planned = plan.questions[i / 2];
    const plannedId = planned.kind === "question" ? planned.target?.id : undefined;
    if (turn.targetRequirementId !== plannedId) {
      throw invalidHistory("A coach turn's targetRequirementId does not match this job and fit context.");
    }
  });

  const turn: PlannedTurn = plan.questions[index] ?? { kind: "closing", focus: "reflection" };
  const answers = index; // one candidate answer per earlier coach turn
  const canFinish = turn.kind === "closing" || turn.focus === "reflection" || answers >= MIN_ANSWERS_TO_FINISH;
  return { plan, index, turn, canFinish };
}

function generalQuestions(): PlannedTurn[] {
  return GENERAL_FOCUSES.map((focus) => ({ kind: "question" as const, focus, followUp: false }));
}

function invalidHistory(message: string): FitApiError {
  return new FitApiError("INVALID_HISTORY", message, false, 400);
}

function invalidFit(message: string): FitApiError {
  return new FitApiError("INVALID_FIT_CONTEXT", message, false, 400);
}
