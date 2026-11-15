/**
 * In-memory Mock Interview session.
 * Pure transitions: no storage, no network, and no reading of answer text to pick the next question.
 */

import {
  isInterviewMode,
  questionsFor,
  type InterviewFocus,
  type InterviewMode,
} from "./questions";

/** Stored answers are trimmed. This limit applies after trimming. */
export const MAX_ANSWER_LENGTH = 2000;

export type SessionPhase = "select" | "question" | "complete";

export type RecordedAnswer = {
  questionId: string;
  focus: InterviewFocus;
  prompt: string;
  practicePrompt: string;
  answer: string;
};

export type InterviewSession = {
  phase: SessionPhase;
  mode: InterviewMode | null;
  /** Next question index while answering; equals the bank length once complete. */
  index: number;
  answers: readonly RecordedAnswer[];
};

export type AnswerError = "empty" | "too_long";

export type SubmitResult =
  | { ok: true; session: InterviewSession }
  | { ok: false; error: AnswerError | "inactive" };

export function createSession(): InterviewSession {
  return { phase: "select", mode: null, index: 0, answers: [] };
}

export function beginMode(mode: InterviewMode): InterviewSession {
  if (!isInterviewMode(mode)) return createSession();
  return { phase: "question", mode, index: 0, answers: [] };
}

export function validateAnswer(raw: string): { ok: true; answer: string } | { ok: false; error: AnswerError } {
  const answer = raw.trim();
  if (answer.length === 0) return { ok: false, error: "empty" };
  if (answer.length > MAX_ANSWER_LENGTH) return { ok: false, error: "too_long" };
  return { ok: true, answer };
}

export function answerErrorMessage(error: AnswerError): string {
  if (error === "empty") {
    return "Enter an answer before continuing. Whitespace alone is not an answer.";
  }
  return `Answers are limited to ${MAX_ANSWER_LENGTH} characters. Shorten this one and submit again.`;
}

export function submitAnswer(session: InterviewSession, raw: string): SubmitResult {
  if (session.phase !== "question" || session.mode === null) {
    return { ok: false, error: "inactive" };
  }
  const question = questionsFor(session.mode)[session.index];
  if (!question) return { ok: false, error: "inactive" };

  const validated = validateAnswer(raw);
  if (!validated.ok) return validated;

  const answers = [
    ...session.answers,
    {
      questionId: question.id,
      focus: question.focus,
      prompt: question.prompt,
      practicePrompt: question.practicePrompt,
      answer: validated.answer,
    },
  ];
  const index = session.index + 1;
  const finished = index >= questionsFor(session.mode).length;
  return {
    ok: true,
    session: {
      phase: finished ? "complete" : "question",
      mode: session.mode,
      index,
      answers,
    },
  };
}

/** Drops the practice and returns to mode selection. Previous answers are not copied. */
export function restartSession(): InterviewSession {
  return createSession();
}

/** Drops the practice the same way restart does. Navigation is the caller's job. */
export function exitSession(): InterviewSession {
  return restartSession();
}

export function currentQuestion(session: InterviewSession) {
  if (session.phase !== "question" || session.mode === null) return null;
  return questionsFor(session.mode)[session.index] ?? null;
}

export function sessionProgress(session: InterviewSession): { current: number; total: number; answered: number } {
  const total = session.mode ? questionsFor(session.mode).length : 0;
  const answered = session.answers.length;
  const current = session.phase === "question" ? session.index + 1 : session.phase === "complete" ? total : 0;
  return { current, total, answered };
}

/** Factual discard copy. Counts submitted answers; it does not judge them. */
export function discardMessage(session: InterviewSession, draft: string): string {
  const unsent = draft.trim().length > 0;
  const count = session.answers.length;
  const lead =
    count === 0 && unsent
      ? "Your unsent answer will be discarded."
      : count === 0
        ? "No answer has been submitted yet."
        : count === 1
          ? "1 submitted answer will be discarded."
          : `${count} submitted answers will be discarded.`;
  const draftNote = count > 0 && unsent ? " The unsent draft will be discarded too." : "";
  return `${lead}${draftNote} Nothing is saved, and discarded text cannot be recovered.`;
}
