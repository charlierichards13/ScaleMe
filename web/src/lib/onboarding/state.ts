/**
 * First-time onboarding state (Issue #43).
 *
 * Pure and deterministic so it can be unit-tested without a DOM and so the
 * first render matches between server prerender and hydration. Answers live
 * only in React component memory: nothing here touches storage, the network
 * or an account. Production auth and persistence are future work (see
 * docs/WELCOME_ONBOARDING.md).
 */

export const stepIds = ["resume", "goals", "preferences", "personalize", "done"] as const;
export type StepId = (typeof stepIds)[number];

/** Steps that ask a question (the "done" screen isn't counted in progress). */
export const questionSteps = stepIds.filter((id): id is Exclude<StepId, "done"> => id !== "done");

export const goalOptions = [
  { id: "internship", label: "Find an internship" },
  { id: "full-time", label: "Find a full-time job" },
  { id: "resume", label: "Improve my resume" },
  { id: "interviews", label: "Prepare for interviews" },
  { id: "explore", label: "Explore career opportunities" },
] as const;
export type GoalId = (typeof goalOptions)[number]["id"];

export const workArrangementOptions = [
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "on-site", label: "On-site" },
] as const;
export type WorkArrangement = (typeof workArrangementOptions)[number]["id"];

/**
 * Timing choices are labeled periods, not invented calendar dates. The user
 * picks the closest fit; specific dates can be added in settings later.
 */
export const timingOptions = [
  { id: "asap", label: "As soon as possible" },
  { id: "summer", label: "A summer term" },
  { id: "fall", label: "A fall semester" },
  { id: "spring", label: "A spring semester" },
  { id: "after-graduation", label: "After I graduate" },
  { id: "unsure", label: "Not sure yet" },
] as const;
export type TimingId = (typeof timingOptions)[number]["id"];

export const MAX_TEXT_LENGTH = 100;

/** Metadata only. The file's contents are never read into this state. */
export type ResumeSelection = { name: string; sizeBytes: number };

export type OnboardingAnswers = {
  resume: ResumeSelection | null;
  goals: GoalId[];
  role: string;
  location: string;
  arrangements: WorkArrangement[];
  timing: TimingId | null;
  internationalGuidance: boolean;
  jobUpdates: boolean;
};

export type OnboardingState = {
  step: StepId;
  answers: OnboardingAnswers;
  /** Steps the user explicitly skipped, for the summary screen. */
  skipped: StepId[];
};

export const emptyAnswers: OnboardingAnswers = {
  resume: null,
  goals: [],
  role: "",
  location: "",
  arrangements: [],
  timing: null,
  internationalGuidance: false,
  jobUpdates: false,
};

export const initialOnboardingState: OnboardingState = {
  step: "resume",
  answers: emptyAnswers,
  skipped: [],
};

export type OnboardingAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "skip" }
  | { type: "selectResume"; selection: ResumeSelection }
  | { type: "clearResume" }
  | { type: "toggleGoal"; goal: GoalId }
  | { type: "toggleArrangement"; arrangement: WorkArrangement }
  | { type: "setText"; field: "role" | "location"; value: string }
  | { type: "setTiming"; timing: TimingId | null }
  | { type: "setSupport"; field: "internationalGuidance" | "jobUpdates"; value: boolean };

function stepOffset(step: StepId, delta: number): StepId {
  const index = stepIds.indexOf(step);
  const next = Math.min(Math.max(index + delta, 0), stepIds.length - 1);
  return stepIds[next];
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Resets the answers that belong to one step (used by Skip). */
function clearStep(answers: OnboardingAnswers, step: StepId): OnboardingAnswers {
  switch (step) {
    case "resume":
      return { ...answers, resume: null };
    case "goals":
      return { ...answers, goals: [] };
    case "preferences":
      return { ...answers, role: "", location: "", arrangements: [], timing: null };
    case "personalize":
      return { ...answers, internationalGuidance: false, jobUpdates: false };
    case "done":
      return answers;
  }
}

/** Trims input and enforces the length cap. Text is rendered as escaped React text. */
export function sanitizeText(value: string): string {
  return value.replace(/\s+/g, " ").trimStart().slice(0, MAX_TEXT_LENGTH);
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "next": {
      if (state.step === "done") return state;
      return {
        ...state,
        step: stepOffset(state.step, 1),
        skipped: state.skipped.filter((id) => id !== state.step),
      };
    }
    case "back":
      return { ...state, step: stepOffset(state.step, -1) };
    case "skip": {
      if (state.step === "done") return state;
      return {
        step: stepOffset(state.step, 1),
        answers: clearStep(state.answers, state.step),
        skipped: state.skipped.includes(state.step) ? state.skipped : [...state.skipped, state.step],
      };
    }
    case "selectResume":
      return { ...state, answers: { ...state.answers, resume: action.selection } };
    case "clearResume":
      return { ...state, answers: { ...state.answers, resume: null } };
    case "toggleGoal":
      return { ...state, answers: { ...state.answers, goals: toggle(state.answers.goals, action.goal) } };
    case "toggleArrangement":
      return {
        ...state,
        answers: { ...state.answers, arrangements: toggle(state.answers.arrangements, action.arrangement) },
      };
    case "setText":
      return { ...state, answers: { ...state.answers, [action.field]: sanitizeText(action.value) } };
    case "setTiming":
      return { ...state, answers: { ...state.answers, timing: action.timing } };
    case "setSupport":
      return { ...state, answers: { ...state.answers, [action.field]: action.value } };
  }
}

/** 1-based position among the four question steps; the done screen reports 4 of 4. */
export function stepProgress(step: StepId): { current: number; total: number } {
  const total = questionSteps.length;
  if (step === "done") return { current: total, total };
  return { current: questionSteps.indexOf(step) + 1, total };
}

/** Plain-language summary lines for the completion screen. */
export function summarizeAnswers(answers: OnboardingAnswers): Array<{ label: string; value: string }> {
  const labelOf = <T extends { id: string; label: string }>(options: readonly T[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id;

  return [
    {
      label: "Resume",
      value: answers.resume
        ? "PDF chosen, kept on your device and not uploaded"
        : "Not added yet",
    },
    {
      label: "Goals",
      value: answers.goals.length ? answers.goals.map((id) => labelOf(goalOptions, id)).join(", ") : "Not chosen yet",
    },
    { label: "Role or field", value: answers.role.trim() || "Not specified" },
    { label: "Location", value: answers.location.trim() || "Not specified" },
    {
      label: "Work arrangement",
      value: answers.arrangements.length
        ? answers.arrangements.map((id) => labelOf(workArrangementOptions, id)).join(", ")
        : "No preference given",
    },
    { label: "Timing", value: answers.timing ? labelOf(timingOptions, answers.timing) : "Not specified" },
  ];
}
