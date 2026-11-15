"use client";

import { useEffect, useReducer, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import {
  initialOnboardingState,
  onboardingReducer,
  stepProgress,
  summarizeAnswers,
  type OnboardingAnswers,
  type StepId,
} from "@/lib/onboarding/state";
import { routes } from "@/lib/routes";
import { useActiveResume } from "@/lib/resume/active-resume";
import { useResumeUpload } from "@/lib/resume/use-resume-upload";
import { StepProgress } from "./StepProgress";
import { GoalsStep, PersonalizeStep, PreferencesStep, ResumeStep } from "./steps";

const copy: Record<Exclude<StepId, "done">, { label: string; title: string; description: string }> = {
  resume: {
    label: "Resume",
    title: "Let's start with your experience.",
    description: "A resume helps ScaleMe understand what you've done. You can skip this and add one later.",
  },
  goals: {
    label: "Goals",
    title: "What would you like to accomplish?",
    description: "Choose as many as you like. Every tool stays available whatever you pick.",
  },
  preferences: {
    label: "Preferences",
    title: "What does your ideal opportunity look like?",
    description: "Answer what you know and leave the rest blank.",
  },
  personalize: {
    label: "Personalize",
    title: "One last thing: make ScaleMe yours.",
    description: "Optional support you can turn on now or ignore.",
  },
};

const primaryButton = cx(
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-strong",
  buttonStyles.focusRing,
);
const quietButton = cx(
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink",
  buttonStyles.focusRing,
);

/**
 * Guest-only first-time setup (Issue #43). All answers live in this
 * component's memory and are discarded on reload or navigation. There is no
 * account or storage. Explicit private PDF extraction uses the shared uploader.
 * When auth (Issue #42) and persistence
 * exist, completion should save these answers server-side and returning users
 * should skip this route.
 */
export function OnboardingFlow() {
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const upload = useResumeUpload();
  const resume = useActiveResume();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new question so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [state.step]);

  const { current, total } = stepProgress(state.step);

  if (state.step === "done") {
    return (
      <Shell progress={<StepProgress current={total} total={total} label="Complete" />}>
        <DoneScreen answers={state.answers} resumeStatus={resume ? "Extracted · available in this tab" : upload.file ? "PDF selected locally · not extracted" : "Not added yet"} hasParsedResume={!!resume} headingRef={headingRef} onBack={() => dispatch({ type: "back" })} />
      </Shell>
    );
  }

  const step = copy[state.step];
  const isFirst = state.step === "resume";
  const isLast = state.step === "personalize";
  const continueLabel =
    state.step === "resume" && !upload.file && !resume ? "Continue without a resume" : isLast ? "Finish setup" : "Continue";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.step === "resume" && (upload.phase === "processing" || upload.phase === "checking")) upload.cancel();
    dispatch({ type: "next" });
  }

  return (
    <Shell progress={<StepProgress current={current} total={total} label={step.label} />}>
      <form onSubmit={onSubmit} noValidate aria-labelledby="onboarding-step-title" key={state.step} className="sm-step-in">
        <h1
          id="onboarding-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-[-0.02em] text-ink outline-none sm:text-[2rem] sm:leading-tight"
        >
          {step.title}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">{step.description}</p>

        <div className="mt-8">
          {state.step === "resume" && <ResumeStep upload={upload} />}
          {state.step === "goals" && <GoalsStep answers={state.answers} dispatch={dispatch} />}
          {state.step === "preferences" && <PreferencesStep answers={state.answers} dispatch={dispatch} />}
          {state.step === "personalize" && <PersonalizeStep answers={state.answers} dispatch={dispatch} />}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
          {!isFirst && (
            <button type="button" onClick={() => dispatch({ type: "back" })} className={quietButton}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => { if (state.step === "resume") upload.clear(); dispatch({ type: "skip" }); }} className={quietButton}>
              Skip for now
            </button>
            <button type="submit" className={primaryButton}>
              {continueLabel}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ progress, children }: { progress: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {progress}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-10">{children}</div>
    </div>
  );
}

function DoneScreen({
  answers,
  headingRef,
  onBack,
  resumeStatus,
  hasParsedResume,
}: {
  answers: OnboardingAnswers;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  resumeStatus: string;
  hasParsedResume: boolean;
}) {
  const summary = summarizeAnswers(answers);
  const support = [
    answers.internationalGuidance && "International student guidance",
    answers.jobUpdates && "Job updates (when available)",
  ].filter(Boolean) as string[];

  return (
    <div className="sm-step-in">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-card">
        <Check className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-ink outline-none sm:text-[2rem] sm:leading-tight"
      >
        Your career workspace is ready.
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-muted">
        Here&apos;s what you shared. Because this is a guest preview, your answers stay in this tab only. They aren&apos;t
        saved to an account, and the dashboard doesn&apos;t use them yet.
      </p>

      <dl className="mt-8 divide-y divide-line rounded-2xl border border-line">
        {summary.map((row) => (
          <div key={row.label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-muted">{row.label}</dt>
            <dd className="break-words text-sm text-ink">{row.label === "Resume" ? resumeStatus : row.value}</dd>
          </div>
        ))}
        <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-muted">Extra support</dt>
          <dd className="text-sm text-ink">{support.length ? support.join(", ") : "None selected"}</dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
        <Link href={routes.resumeLab} className={quietButton}>Open Resume Lab</Link>
        {hasParsedResume && <Link href={routes.fitInsights} className={quietButton}>Open Fit Explorer</Link>}
        <button type="button" onClick={onBack} className={quietButton}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Edit answers
        </button>
        <Link href={routes.dashboard} className={cx(primaryButton, "ml-auto")}>
          Go to Dashboard
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
