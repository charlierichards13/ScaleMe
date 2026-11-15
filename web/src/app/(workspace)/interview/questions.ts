/**
 * Fixed Mock Interview scripts.
 * Questions and practice prompts do not read the candidate's answers.
 */

export const SCRIPTED_LABEL = "Scripted Demo — Not Live AI";

export const SCRIPTED_NOTE =
  "These five questions are a fixed script. They do not change based on your answers, your resume, or a job description. No live model is called.";

export const INTERVIEW_MODES = ["technical", "behavioral"] as const;

export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_FOCUSES = ["context", "contribution", "tradeoffs", "impact", "reflection"] as const;

export type InterviewFocus = (typeof INTERVIEW_FOCUSES)[number];

export const FOCUS_LABEL: Record<InterviewFocus, string> = {
  context: "Context",
  contribution: "Your contribution",
  tradeoffs: "Trade-offs",
  impact: "What changed",
  reflection: "Reflection",
};

/** Same prompt for every candidate at this focus. Not a review of an answer. */
export const PRACTICE_PROMPTS: Record<InterviewFocus, string> = {
  context:
    "Restate the situation in plain language: who was involved, what you were asked to do, and what you are not sure about.",
  contribution:
    "List only actions you can attribute to yourself. If you are unsure who owned something, keep it as a question.",
  tradeoffs:
    "Name the options you remember and the reason you chose one. Do not add a result you have not confirmed.",
  impact:
    "Say what you checked and what changed. If there is no measurement, write that you do not have one.",
  reflection: "Write one thing you would explain more clearly next time. Treat this as a reminder to be specific, not as an evaluation.",
};

export type ScriptedQuestion = {
  id: string;
  focus: InterviewFocus;
  prompt: string;
  practicePrompt: string;
};

export const MODE_DETAILS: Record<InterviewMode, { title: string; summary: string }> = {
  technical: {
    title: "Technical",
    summary:
      "A fixed sequence about one project you choose: the problem, what you owned, a trade-off, how you checked it, and what you would clarify.",
  },
  behavioral: {
    title: "Behavioral",
    summary:
      "A fixed sequence about working with other people: the situation, your role, a constraint, a result you can confirm, and a lesson.",
  },
};

function question(id: string, focus: InterviewFocus, prompt: string): ScriptedQuestion {
  return Object.freeze({
    id,
    focus,
    prompt,
    practicePrompt: PRACTICE_PROMPTS[focus],
  });
}

export const QUESTIONS: Record<InterviewMode, readonly ScriptedQuestion[]> = {
  technical: Object.freeze([
    question(
      "technical-context",
      "context",
      "Walk through one technical project you actually worked on. What was the situation, and what problem were you trying to solve?",
    ),
    question(
      "technical-contribution",
      "contribution",
      "What did you personally design, build, or decide? Separate that from work other people owned.",
    ),
    question(
      "technical-tradeoffs",
      "tradeoffs",
      "Describe one technical choice or trade-off. What alternatives did you consider, and why did you pick the one you did?",
    ),
    question(
      "technical-impact",
      "impact",
      "How did you check that the work did what you intended, and what changed afterward? If you do not have a measurement, describe what you observed instead of inventing one.",
    ),
    question(
      "technical-reflection",
      "reflection",
      "What would you explain more clearly if you were asked about this project again?",
    ),
  ]),
  behavioral: Object.freeze([
    question(
      "behavioral-context",
      "context",
      "Tell me about a time you worked with other people on a shared goal. What was the situation?",
    ),
    question(
      "behavioral-contribution",
      "contribution",
      "What did you personally do, and what did the group do together?",
    ),
    question(
      "behavioral-tradeoffs",
      "tradeoffs",
      "Describe a disagreement, limit, or trade-off in that situation. How did you decide what to do?",
    ),
    question(
      "behavioral-impact",
      "impact",
      "What result can you actually point to? Leave out any number, title, or outcome you cannot confirm.",
    ),
    question(
      "behavioral-reflection",
      "reflection",
      "What did you take from that experience, and what would you handle differently next time?",
    ),
  ]),
};

export function isInterviewMode(value: string): value is InterviewMode {
  return (INTERVIEW_MODES as readonly string[]).includes(value);
}

export function questionsFor(mode: InterviewMode): readonly ScriptedQuestion[] {
  return QUESTIONS[mode];
}
