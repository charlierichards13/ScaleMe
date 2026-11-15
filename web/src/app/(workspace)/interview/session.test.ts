import { describe, expect, it } from "vitest";
import {
  INTERVIEW_FOCUSES,
  INTERVIEW_MODES,
  MODE_DETAILS,
  PRACTICE_PROMPTS,
  QUESTIONS,
  SCRIPTED_LABEL,
  SCRIPTED_NOTE,
  questionsFor,
  type InterviewMode,
} from "./questions";
import {
  MAX_ANSWER_LENGTH,
  answerErrorMessage,
  beginMode,
  createSession,
  currentQuestion,
  discardMessage,
  exitSession,
  restartSession,
  sessionProgress,
  submitAnswer,
  validateAnswer,
  type InterviewSession,
} from "./session";

function answerAll(mode: InterviewMode): InterviewSession {
  let session = beginMode(mode);
  for (let index = 0; index < questionsFor(mode).length; index += 1) {
    const result = submitAnswer(session, `Answer ${index + 1} for ${mode}.`);
    if (!result.ok) throw new Error(result.error);
    session = result.session;
  }
  return session;
}

describe("scripted interview banks", () => {
  it("offers two modes with five fixed questions in the same focus order", () => {
    expect(INTERVIEW_MODES).toEqual(["technical", "behavioral"]);
    expect(SCRIPTED_LABEL).toBe("Scripted Demo — Not Live AI");
    expect(SCRIPTED_NOTE).toMatch(/do not change based on your answers/i);
    expect(SCRIPTED_NOTE).toMatch(/no live model/i);
    expect(SCRIPTED_NOTE).toMatch(/stay in memory/i);
    expect(SCRIPTED_NOTE).toMatch(/not uploaded/i);
    expect(SCRIPTED_NOTE).toMatch(/discarded when you leave or refresh/i);

    for (const mode of INTERVIEW_MODES) {
      const questions = questionsFor(mode);
      expect(questions).toHaveLength(5);
      expect(questions.map((item) => item.focus)).toEqual([...INTERVIEW_FOCUSES]);
      expect(new Set(questions.map((item) => item.id)).size).toBe(5);
      expect(MODE_DETAILS[mode].title.length).toBeGreaterThan(0);
      for (const item of questions) {
        expect(item.practicePrompt).toBe(PRACTICE_PROMPTS[item.focus]);
        expect(item.prompt.length).toBeGreaterThan(0);
      }
    }

    const ids = INTERVIEW_MODES.flatMap((mode) => questionsFor(mode).map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(questionsFor("technical")).toBe(QUESTIONS.technical);
    expect(questionsFor("behavioral")[0].id).not.toBe(questionsFor("technical")[0].id);
  });

  it("keeps practice prompts reflective and free of scores or invented results", () => {
    const banned = /score|%\s|hired|excellent|strong candidate|40%|improved by|years of experience/i;
    for (const prompt of Object.values(PRACTICE_PROMPTS)) {
      expect(prompt).not.toMatch(banned);
    }
    for (const mode of INTERVIEW_MODES) {
      for (const item of questionsFor(mode)) {
        expect(item.prompt).not.toMatch(banned);
        expect(item.practicePrompt).not.toMatch(/\byou demonstrated\b/i);
      }
    }
  });
});

describe("interview session", () => {
  it("starts on mode selection and begins the chosen script at question 1", () => {
    expect(createSession()).toEqual({ phase: "select", mode: null, index: 0, answers: [] });
    const technical = beginMode("technical");
    const behavioral = beginMode("behavioral");
    expect(technical).toMatchObject({ phase: "question", mode: "technical", index: 0, answers: [] });
    expect(behavioral.mode).toBe("behavioral");
    expect(currentQuestion(technical)?.id).toBe("technical-context");
    expect(currentQuestion(behavioral)?.id).toBe("behavioral-context");
    expect(sessionProgress(technical)).toEqual({ current: 1, total: 5, answered: 0 });
    expect(beginMode("voice" as InterviewMode)).toEqual(createSession());
  });

  it("rejects empty and whitespace-only answers without advancing", () => {
    const session = beginMode("technical");
    for (const raw of ["", " ", "\n", "\t", " \n\t "]) {
      expect(validateAnswer(raw)).toEqual({ ok: false, error: "empty" });
      const result = submitAnswer(session, raw);
      expect(result).toEqual({ ok: false, error: "empty" });
      expect(answerErrorMessage("empty")).toMatch(/whitespace/i);
    }
    expect(session.answers).toEqual([]);
    expect(session.index).toBe(0);
  });

  it("trims surrounding whitespace and keeps internal spacing verbatim", () => {
    const session = beginMode("behavioral");
    const result = submitAnswer(session, "  I scheduled\n  the review.  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.answers[0].answer).toBe("I scheduled\n  the review.");
    expect(result.session.answers[0].prompt).toBe(questionsFor("behavioral")[0].prompt);
  });

  it("enforces the answer length limit on the trimmed text", () => {
    const atLimit = "a".repeat(MAX_ANSWER_LENGTH);
    const over = "b".repeat(MAX_ANSWER_LENGTH + 1);
    expect(validateAnswer(atLimit)).toEqual({ ok: true, answer: atLimit });
    expect(validateAnswer(`  ${atLimit}  `)).toEqual({ ok: true, answer: atLimit });
    expect(validateAnswer(over)).toEqual({ ok: false, error: "too_long" });
    expect(validateAnswer(` ${over} `)).toEqual({ ok: false, error: "too_long" });
    expect(answerErrorMessage("too_long")).toContain(String(MAX_ANSWER_LENGTH));

    const session = beginMode("technical");
    expect(submitAnswer(session, over)).toEqual({ ok: false, error: "too_long" });
    expect(session.index).toBe(0);
    const accepted = submitAnswer(session, `  ${atLimit}  `);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.session.answers[0].answer).toHaveLength(MAX_ANSWER_LENGTH);
  });

  it("advances one question at a time and completes on the fifth answer", () => {
    let session = beginMode("technical");
    const seen: string[] = [];
    for (let step = 0; step < 5; step += 1) {
      expect(session.phase).toBe("question");
      expect(currentQuestion(session)?.id).toBe(questionsFor("technical")[step].id);
      const before = JSON.stringify(session);
      const result = submitAnswer(session, `  Step ${step} answer  `);
      expect(JSON.stringify(session)).toBe(before);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      seen.push(result.session.answers[step].answer);
      expect(result.session.answers.map((item) => item.answer)).toEqual(seen);
      expect(result.session.answers[step].practicePrompt).toBe(PRACTICE_PROMPTS[INTERVIEW_FOCUSES[step]]);
      session = result.session;
      if (step < 4) {
        expect(session.phase).toBe("question");
        expect(session.index).toBe(step + 1);
        expect(sessionProgress(session).current).toBe(step + 2);
      }
    }
    expect(session.phase).toBe("complete");
    expect(session.index).toBe(5);
    expect(session.answers).toHaveLength(5);
    expect(currentQuestion(session)).toBeNull();
    expect(sessionProgress(session)).toEqual({ current: 5, total: 5, answered: 5 });
    expect(submitAnswer(session, "another answer")).toEqual({ ok: false, error: "inactive" });
    expect(submitAnswer(createSession(), "too early")).toEqual({ ok: false, error: "inactive" });
  });

  it("switches mode by replacing the session instead of merging answers", () => {
    const technical = beginMode("technical");
    const answered = submitAnswer(technical, "I wrote the form validation.");
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;

    const behavioral = beginMode("behavioral");
    expect(behavioral).toMatchObject({ phase: "question", mode: "behavioral", index: 0, answers: [] });
    expect(technical.answers).toEqual([]);
    expect(answered.session.mode).toBe("technical");
    expect(answered.session.answers.map((item) => item.answer)).toEqual(["I wrote the form validation."]);
    expect(behavioral.answers).not.toBe(answered.session.answers);

    const behavioralAnswer = submitAnswer(behavioral, "I asked for a written agenda.");
    expect(behavioralAnswer.ok).toBe(true);
    if (!behavioralAnswer.ok) return;
    expect(behavioralAnswer.session.answers[0].questionId).toBe("behavioral-context");
    expect(answered.session.answers[0].questionId).toBe("technical-context");

    const restartedTechnical = beginMode("technical");
    expect(restartedTechnical.answers).toEqual([]);
    expect(behavioralAnswer.session.answers).toHaveLength(1);
  });

  it("restarts and exits back to an empty selection without mutating the old session", () => {
    const finished = answerAll("behavioral");
    const before = JSON.stringify(finished);

    expect(restartSession()).toEqual(createSession());
    expect(exitSession()).toEqual(createSession());
    expect(JSON.stringify(finished)).toBe(before);
    expect(finished.answers).toHaveLength(5);
    expect(restartSession()).not.toBe(exitSession());
    expect(sessionProgress(restartSession())).toEqual({ current: 0, total: 0, answered: 0 });
  });

  it("keeps two in-progress sessions isolated", () => {
    const left = beginMode("technical");
    const right = beginMode("behavioral");
    const leftNext = submitAnswer(left, "Left session only");
    const rightNext = submitAnswer(right, "Right session only");
    expect(leftNext.ok && rightNext.ok).toBe(true);
    if (!leftNext.ok || !rightNext.ok) return;

    const tampered = [...leftNext.session.answers, { ...leftNext.session.answers[0], answer: "tamper" }];
    expect(tampered).toHaveLength(2);
    expect(leftNext.session.answers.map((item) => item.answer)).toEqual(["Left session only"]);
    expect(rightNext.session.answers.map((item) => item.answer)).toEqual(["Right session only"]);
    expect(leftNext.session.answers).not.toBe(rightNext.session.answers);
    expect(left.answers).toEqual([]);
    expect(right.answers).toEqual([]);
    expect(leftNext.session.mode).not.toBe(rightNext.session.mode);
  });

  it("describes discard counts without judging the answers", () => {
    const started = beginMode("technical");
    expect(discardMessage(started, "   ")).toBe(
      "No answer has been submitted yet. Nothing is saved, and discarded text cannot be recovered.",
    );
    expect(discardMessage(started, " draft ")).toBe(
      "Your unsent answer will be discarded. Nothing is saved, and discarded text cannot be recovered.",
    );

    const once = submitAnswer(started, "One answer");
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(discardMessage(once.session, "")).toBe(
      "1 submitted answer will be discarded. Nothing is saved, and discarded text cannot be recovered.",
    );
    expect(discardMessage(once.session, "still typing")).toContain("The unsent draft will be discarded too.");

    const completed = answerAll("technical");
    expect(discardMessage(completed, "")).toBe(
      "5 submitted answers will be discarded. Nothing is saved, and discarded text cannot be recovered.",
    );
    expect(discardMessage(completed, "")).not.toMatch(/score|excellent|improved/i);
  });
});
