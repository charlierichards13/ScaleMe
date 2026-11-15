"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Code, LogOut, MessagesSquare, Mic, RotateCcw, type LucideIcon } from "lucide-react";
import { Badge, Card, DemoBadge, EmptyState, buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";
import {
  FOCUS_LABEL,
  INTERVIEW_FOCUSES,
  INTERVIEW_MODES,
  MODE_DETAILS,
  SCRIPTED_LABEL,
  SCRIPTED_NOTE,
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
  type AnswerError,
  type InterviewSession,
  type RecordedAnswer,
} from "./session";

type Pending = { kind: "restart" } | { kind: "exit" } | { kind: "switch"; mode: InterviewMode };

const MODE_ICONS: Record<InterviewMode, LucideIcon> = {
  technical: Code,
  behavioral: MessagesSquare,
};

const fieldClass =
  "w-full resize-y rounded-xl border border-line bg-surface px-3 py-3 text-base leading-6 text-ink shadow-card outline-none transition-colors placeholder:text-slate-400 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand";

export function MockInterviewWorkspace() {
  const router = useRouter();
  const titleId = useId();
  const [session, setSession] = useState<InterviewSession>(createSession);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<AnswerError | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const completeRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    if (session.phase === "question") questionRef.current?.focus();
    else if (session.phase === "complete") completeRef.current?.focus();
    else titleRef.current?.focus();
  }, [session.phase, session.index, session.mode]);

  useEffect(() => {
    if (pending || !restoreFocus.current) return;
    restoreFocus.current = false;
    returnFocus.current?.focus();
  }, [pending]);

  function openPending(next: Pending, opener: HTMLElement) {
    returnFocus.current = opener;
    setPending(next);
  }

  function closePending() {
    restoreFocus.current = true;
    setPending(null);
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "switch") {
      setSession(beginMode(pending.mode));
      setDraft("");
      setError(null);
      setPending(null);
      return;
    }
    const goDashboard = pending.kind === "exit";
    setSession(pending.kind === "restart" ? restartSession() : exitSession());
    setDraft("");
    setError(null);
    setPending(null);
    if (goDashboard) router.push(routes.dashboard);
  }

  function handleSubmit() {
    const result = submitAnswer(session, draft);
    if (!result.ok) {
      if (result.error === "inactive") return;
      setError(result.error);
      textareaRef.current?.focus();
      return;
    }
    setSession(result.session);
    setDraft("");
    setError(null);
  }

  const otherMode: InterviewMode | null =
    session.mode === "technical" ? "behavioral" : session.mode === "behavioral" ? "technical" : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Mic className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="scroll-mt-20 rounded-sm text-xl font-bold tracking-tight text-ink focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas sm:text-2xl"
          >
            Mock Interview
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted">Practice one question at a time, then reread exactly what you wrote.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DemoBadge label={SCRIPTED_LABEL} />
        <p className="max-w-3xl text-sm leading-6 text-muted">{SCRIPTED_NOTE}</p>
        <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-slate-600 shadow-card ring-1 ring-line">
          <span className="font-semibold text-ink">Not saved.</span> Answers exist only while you stay on this page. Restart, exit,
          refresh, and opening another page — including the sidebar — discard them. Nothing is uploaded or sent to a model.
        </p>
      </div>

      <div className="mt-6" inert={pending ? true : undefined}>
        {session.phase === "select" && <ModeSelect onStart={(mode) => { setSession(beginMode(mode)); setDraft(""); setError(null); }} />}
        {session.phase === "question" && (
          <QuestionStep
            session={session}
            draft={draft}
            error={error}
            questionRef={questionRef}
            textareaRef={textareaRef}
            otherMode={otherMode}
            onDraft={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            onSubmit={handleSubmit}
            onRestart={(opener) => openPending({ kind: "restart" }, opener)}
            onExit={(opener) => openPending({ kind: "exit" }, opener)}
            onSwitch={(mode, opener) => openPending({ kind: "switch", mode }, opener)}
          />
        )}
        {session.phase === "complete" && session.mode && (
          <Recap
            mode={session.mode}
            answers={session.answers}
            headingRef={completeRef}
            onRestart={(opener) => openPending({ kind: "restart" }, opener)}
            onExit={(opener) => openPending({ kind: "exit" }, opener)}
          />
        )}
      </div>

      {pending && (
        <DiscardDialog
          pending={pending}
          message={discardMessage(session, draft)}
          onCancel={closePending}
          onConfirm={confirmPending}
        />
      )}
    </div>
  );
}

function ModeSelect({ onStart }: { onStart: (mode: InterviewMode) => void }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">Choose a practice</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
        Both modes ask five questions in this order. The order stays the same no matter what you type.
      </p>
      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Question order">
        {INTERVIEW_FOCUSES.map((focus, index) => (
          <li key={focus} className="flex items-center gap-2 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-line">
            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
              {index + 1}
            </span>
            {FOCUS_LABEL[focus]}
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {INTERVIEW_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode];
          return (
          <button
            key={mode}
            type="button"
            onClick={() => onStart(mode)}
            className={cx(
              "flex h-full flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card-hover",
              buttonStyles.focusRing,
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <Badge tone="brand">{MODE_DETAILS[mode].title}</Badge>
            </span>
            <span className="mt-4 text-[15px] font-semibold text-ink">Start {MODE_DETAILS[mode].title.toLowerCase()} practice</span>
            <span className="mt-1.5 flex-1 text-sm leading-6 text-muted">{MODE_DETAILS[mode].summary}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              Begin question 1
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </button>
          );
        })}
      </div>

      <div className="mt-6">
        <Link href={routes.dashboard} className={buttonStyles.secondary}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function QuestionStep({
  session,
  draft,
  error,
  questionRef,
  textareaRef,
  otherMode,
  onDraft,
  onSubmit,
  onRestart,
  onExit,
  onSwitch,
}: {
  session: InterviewSession;
  draft: string;
  error: AnswerError | null;
  questionRef: RefObject<HTMLHeadingElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  otherMode: InterviewMode | null;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onRestart: (opener: HTMLElement) => void;
  onExit: (opener: HTMLElement) => void;
  onSwitch: (mode: InterviewMode, opener: HTMLElement) => void;
}) {
  const question = currentQuestion(session);
  const progress = sessionProgress(session);
  const answerId = useId();
  const hintId = useId();
  const countId = useId();
  const errorId = useId();
  const trimmedLength = draft.trim().length;
  const overLimit = trimmedLength > MAX_ANSWER_LENGTH;
  if (!question || !session.mode) return null;

  const describedBy = [hintId, countId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{MODE_DETAILS[session.mode].title} practice</p>
            <p className="mt-0.5 text-xs font-medium text-muted">
              Question {progress.current} of {progress.total}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, focus: </span>
              {FOCUS_LABEL[question.focus]}
            </p>
          </div>
          {otherMode && (
            <button
              type="button"
              className={buttonStyles.ghost}
              onClick={(event) => onSwitch(otherMode, event.currentTarget)}
            >
              Switch to {MODE_DETAILS[otherMode].title.toLowerCase()}
            </button>
          )}
        </div>

        <div
          className="mt-4 flex gap-1.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.answered}
          aria-valuetext={`${progress.answered} of ${progress.total} answers submitted`}
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cx(
                "h-1.5 flex-1 rounded-full",
                index < progress.answered ? "bg-brand" : index === session.index ? "bg-brand/40" : "bg-brand-soft",
              )}
            />
          ))}
        </div>

        <h2
          ref={questionRef}
          tabIndex={-1}
          className="mt-5 scroll-mt-20 rounded-sm border-l-4 border-brand pl-4 text-lg font-semibold leading-7 tracking-tight text-ink focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface sm:text-xl"
        >
          {question.prompt}
        </h2>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex items-end justify-between gap-3">
            <label htmlFor={answerId} className="text-sm font-semibold text-ink">
              Your answer
            </label>
            <p id={countId} className={cx("text-xs tabular-nums", overLimit ? "font-semibold text-amber-800" : "text-muted")}>
              <span className="sr-only">Answer length </span>
              {trimmedLength} / {MAX_ANSWER_LENGTH}
              <span className="sr-only"> characters</span>
            </p>
          </div>
          <textarea
            ref={textareaRef}
            id={answerId}
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onSubmit();
              }
            }}
            rows={7}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            placeholder="Write what you would say. Include only what you actually did."
            className={cx(fieldClass, "mt-2 min-h-40", error && "border-amber-400")}
          />
          <p id={hintId} className="mt-2 text-xs leading-5 text-muted">
            Leading and trailing spaces are removed. Ctrl or ⌘ + Enter submits. The next question is the next line in the script.
          </p>
          {error && (
            <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-amber-900">
              {answerErrorMessage(error)}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className={cx(buttonStyles.ghost, "w-full sm:w-auto")} onClick={(event) => onExit(event.currentTarget)}>
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Exit
              </button>
              <button
                type="button"
                className={cx(buttonStyles.secondary, "w-full sm:w-auto")}
                onClick={(event) => onRestart(event.currentTarget)}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Restart
              </button>
            </div>
            <button type="submit" className={cx(buttonStyles.primary, "w-full sm:w-auto")}>
              {progress.current === progress.total ? "Submit and finish" : "Submit answer"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </Card>

      <History answers={session.answers} />
    </div>
  );
}

function History({ answers }: { answers: readonly RecordedAnswer[] }) {
  return (
    <Card aria-labelledby="history-heading" className="lg:max-h-[40rem] lg:overflow-y-auto">
      <h2 id="history-heading" className="text-base font-semibold text-ink">
        Interview history
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">Submitted answers from this practice, in order.</p>
      {answers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Mic className="h-5 w-5" />}
            title="No answers yet"
            description="Each answer appears here after you submit it. This list is cleared when you restart, exit, or leave the page."
          />
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {answers.map((item, index) => (
            <li key={item.questionId} className="rounded-xl bg-canvas px-3 py-3">
              <p className="text-xs font-semibold text-brand-strong">
                Question {index + 1}
                <span className="font-medium text-muted"> · {FOCUS_LABEL[item.focus]}</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-ink">{item.prompt}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.answer}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Recap({
  mode,
  answers,
  headingRef,
  onRestart,
  onExit,
}: {
  mode: InterviewMode;
  answers: readonly RecordedAnswer[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRestart: (opener: HTMLElement) => void;
  onExit: (opener: HTMLElement) => void;
}) {
  return (
    <div>
      <Card>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-20 rounded-sm text-lg font-semibold tracking-tight text-ink focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface">
              Practice complete
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {MODE_DETAILS[mode].title} script, {answers.length} answers. This recap repeats your words. It does not score you, measure
              improvement, or add achievements.
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 ring-1 ring-amber-200">
          Practice prompts below are prewritten and identical for every session. They are not feedback on what you typed.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={cx(buttonStyles.primary, "w-full sm:w-auto")} onClick={(event) => onRestart(event.currentTarget)}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Restart
          </button>
          <button type="button" className={cx(buttonStyles.secondary, "w-full sm:w-auto")} onClick={(event) => onExit(event.currentTarget)}>
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Exit to dashboard
          </button>
        </div>
      </Card>

      <ol className="mt-4 space-y-4">
        {answers.map((item, index) => (
          <li key={item.questionId}>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Question {index + 1} · {FOCUS_LABEL[item.focus]}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-6 text-ink">{item.prompt}</h3>
              <div className="mt-4">
                <p className="text-xs font-semibold text-ink">Your answer</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.answer}</p>
              </div>
              <div className="mt-4 rounded-xl bg-canvas px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Scripted practice prompt</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{item.practicePrompt}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DiscardDialog({
  pending,
  message,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const title =
    pending.kind === "restart" ? "Restart and discard answers?" : pending.kind === "exit" ? "Exit and discard answers?" : "Switch mode and discard answers?";
  const consequence =
    pending.kind === "restart"
      ? "You will return to mode selection."
      : pending.kind === "exit"
        ? "You will leave Mock Interview and return to the dashboard."
        : `You will start the ${MODE_DETAILS[pending.mode].title.toLowerCase()} script from question 1.`;
  const confirmLabel =
    pending.kind === "restart" ? "Discard and restart" : pending.kind === "exit" ? "Discard and exit" : "Discard and switch";

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" tabIndex={-1} aria-label="Stay in this practice" className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40" onClick={onCancel} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-card-hover sm:p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-slate-700">
          {message} {consequence}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className={cx(buttonStyles.secondary, "w-full sm:w-auto")} onClick={onCancel}>
            Keep practicing
          </button>
          <button
            type="button"
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 sm:w-auto",
              buttonStyles.focusRing,
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
